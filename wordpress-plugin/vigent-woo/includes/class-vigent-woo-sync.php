<?php
/**
 * Delta queue, WooCommerce hooks and batched catalogue sync.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit;
}

class Vigent_Woo_Sync {

        const DELTA_QUEUE_OPTION = 'vigent_woo_delta_queue';
        const SYNC_STATE_OPTION  = 'vigent_woo_sync_state';
        const QUEUE_LOCK_OPTION  = 'vigent_woo_delta_queue_lock';
        const FLUSH_LOCK_OPTION  = 'vigent_woo_delta_flush_lock';
        const MAX_QUEUE_SIZE     = 5000;
        const MAX_BATCH_SIZE     = 50;
        /**
         * Maximum number of orders to sync during a full push.
         *
         * Some stores have tens of thousands of historical orders. Syncing all of
         * them is slow (20+ batches of 50), uses bandwidth, and the old orders are
         * rarely useful for Vigent's order-tracking use case. We cap the full-sync
         * to the most recent MAX_ORDERS_TO_SYNC orders (newest first, since the
         * query uses ORDER BY date DESC).
         *
         * New orders created after the initial push still arrive in real-time via
         * the delta queue hooks — this cap only applies to the one-time "send all
         * products/orders" wizard.
         *
         * The Vigent panel enforces its own retention (deletes oldest orders when
         * a workspace exceeds 2000), so even if the store has more than 1000 recent
         * orders, the panel stays bounded.
         */
        const MAX_ORDERS_TO_SYNC = 1000;
        /**
         * Vigent answers a body larger than 4MB with HTTP 413. Fifty products with
         * long descriptions can pass that, and the old code retried the very same
         * oversized batch every five minutes forever, so the queue never drained.
         * Batches are now split to stay well under the server limit.
         */
        const MAX_BATCH_BYTES    = 2097152;
        /**
         * A change that the server keeps rejecting (permanent 4xx, conflicting
         * delivery, oversized single product) used to sit at the head of the queue
         * and block every later change. After this many failed flushes it is
         * dead-lettered and reported on the settings screen; a full push recovers it.
         */
        const MAX_DELTA_ATTEMPTS = 12;

        private static $instance = null;

        public static function instance() {
                if ( null === self::$instance ) {
                        self::$instance = new self();
                }
                return self::$instance;
        }

        private function __construct() {
                add_action( 'woocommerce_new_product', array( $this, 'on_product_new' ), 10, 2 );
                add_action( 'woocommerce_update_product', array( $this, 'on_product_update' ), 10, 2 );
                add_action( 'woocommerce_new_product_variation', array( $this, 'on_product_variation_change' ), 10, 2 );
                add_action( 'woocommerce_update_product_variation', array( $this, 'on_product_variation_change' ), 10, 2 );
                add_action( 'woocommerce_trash_product', array( $this, 'on_product_delete' ) );
                add_action( 'before_delete_post', array( $this, 'on_product_delete' ) );

                add_action( 'woocommerce_new_order', array( $this, 'on_order_new' ), 10, 2 );
                add_action( 'woocommerce_update_order', array( $this, 'on_order_update' ), 10, 2 );
                add_action( 'woocommerce_order_status_changed', array( $this, 'on_order_status_changed' ), 10, 4 );
                add_action( 'vigent_woo_enqueue_delta_retry', array( $this, 'enqueue_delta' ), 10, 4 );
        }

        private function core() {
                return Vigent_Woo_Core::instance();
        }

        public function on_product_new( $product_id, $product = null ) {
                $this->queue_product( $product_id, 'product.created' );
        }

        public function on_product_update( $product_id, $product = null ) {
                $this->queue_product( $product_id, 'product.updated' );
        }

        public function on_product_variation_change( $variation_id, $variation = null ) {
                if ( ! $variation && function_exists( 'wc_get_product' ) ) {
                        $variation = wc_get_product( $variation_id );
                }
                $parent_id = $variation && method_exists( $variation, 'get_parent_id' ) ? $variation->get_parent_id() : wp_get_post_parent_id( $variation_id );
                if ( $parent_id ) {
                        $this->queue_product( $parent_id, 'product.updated' );
                }
        }

        private function queue_product( $product_id, $topic ) {
                $product_id = absint( $product_id );
                if ( ! $product_id || ! $this->core()->sync_products_enabled() ) {
                        return;
                }
                if ( wp_is_post_revision( $product_id ) || wp_is_post_autosave( $product_id ) ) {
                        return;
                }
                $this->enqueue_delta( 'product', $product_id, $topic );
        }

        public function on_product_delete( $post_id ) {
                $post_id = absint( $post_id );
                if ( ! $post_id || ! $this->core()->has_wc() || ! $this->core()->sync_products_enabled() ) {
                        return;
                }
                $post_type = get_post_type( $post_id );
                if ( 'product_variation' === $post_type ) {
                        $parent_id = wp_get_post_parent_id( $post_id );
                        if ( $parent_id ) {
                                $this->queue_product( $parent_id, 'product.updated' );
                        }
                        return;
                }
                if ( 'product' !== $post_type ) {
                        return;
                }

                $product = wc_get_product( $post_id );
                $payload = array( 'id' => $post_id );
                if ( $product ) {
                        $payload['sku']  = $product->get_sku();
                        $payload['name'] = $product->get_name();
                }
                $this->enqueue_delta( 'product', $post_id, 'product.deleted', $payload );
        }

        public function on_order_new( $order_id, $order = null ) {
                $this->queue_order( $order_id, 'order.created' );
        }

        public function on_order_update( $order_id, $order = null ) {
                $this->queue_order( $order_id, 'order.updated' );
        }

        public function on_order_status_changed( $order_id, $old_status, $new_status, $order = null ) {
                $this->queue_order( $order_id, 'order.updated' );
        }

        private function queue_order( $order_id, $topic ) {
                $order_id = absint( $order_id );
                if ( ! $order_id || ! $this->core()->sync_orders_enabled() ) {
                        return;
                }
                $this->enqueue_delta( 'order', $order_id, $topic );
        }

        /**
         * Add or coalesce an entity change. Hooks only write locally; the cron flush
         * sends at most one request for the latest state of each changed entity.
         */
        public function enqueue_delta( $entity, $entity_id, $topic, $data = null ) {
                if ( ! in_array( $entity, array( 'product', 'order' ), true ) ) {
                        return false;
                }
                if ( 'product' === $entity && ! $this->core()->sync_products_enabled() ) {
                        return false;
                }
                if ( 'order' === $entity && ! $this->core()->sync_orders_enabled() ) {
                        return false;
                }
                $entity_id = absint( $entity_id );
                if ( ! $entity_id ) {
                        return false;
                }

                if ( ! $this->acquire_lock( self::QUEUE_LOCK_OPTION, 5 ) ) {
                        wp_schedule_single_event( time() + 5, 'vigent_woo_enqueue_delta_retry', array( $entity, $entity_id, $topic, $data ) );
                        return false;
                }
                $queue = $this->get_delta_queue();
                $key   = $entity . ':' . $entity_id;
                $old   = isset( $queue[ $key ] ) && is_array( $queue[ $key ] ) ? $queue[ $key ] : array();

                // A create followed by edits is still a create. A delete always wins;
                // recreating a deleted entity becomes a fresh create.
                if ( ! empty( $old['topic'] ) ) {
                        if ( false !== strpos( $old['topic'], '.created' ) && false !== strpos( $topic, '.updated' ) ) {
                                $topic = $old['topic'];
                        } elseif ( false !== strpos( $old['topic'], '.deleted' ) && false === strpos( $topic, '.created' ) ) {
                                // A late update hook can fire during trash/delete. Keep the tombstone;
                                // only an explicit create is allowed to resurrect the entity.
                                $topic = $old['topic'];
                                $data  = isset( $old['data'] ) && is_array( $old['data'] ) ? $old['data'] : $data;
                        }
                }

                $queue[ $key ] = array(
                        'event_id'  => wp_generate_uuid4(),
                        'entity'    => $entity,
                        'entity_id' => $entity_id,
                        'topic'     => sanitize_text_field( $topic ),
                        'data'      => is_array( $data ) ? $data : null,
                        'changed_at'=> gmdate( 'c' ),
                        'attempts'  => isset( $old['attempts'] ) ? (int) $old['attempts'] : 0,
                        'last_error'=> isset( $old['last_error'] ) ? (string) $old['last_error'] : '',
                );

                while ( count( $queue ) > self::MAX_QUEUE_SIZE ) {
                        array_shift( $queue );
                }
                $this->save_delta_queue( $queue );
                $this->release_lock( self::QUEUE_LOCK_OPTION );
                return true;
        }

        public function get_delta_queue() {
                $queue = get_option( self::DELTA_QUEUE_OPTION, array() );
                return is_array( $queue ) ? $queue : array();
        }

        private function save_delta_queue( $queue ) {
                if ( false === get_option( self::DELTA_QUEUE_OPTION, false ) ) {
                        add_option( self::DELTA_QUEUE_OPTION, $queue, '', 'no' );
                        return;
                }
                update_option( self::DELTA_QUEUE_OPTION, $queue, false );
        }

        public function get_delta_status() {
                $state = get_option( self::SYNC_STATE_OPTION, array() );
                if ( ! is_array( $state ) ) {
                        $state = array();
                }
                return array_merge(
                        array(
                                'queue_count'        => count( $this->get_delta_queue() ),
                                'last_attempt'       => null,
                                'last_success'       => null,
                                'last_error'         => '',
                                'dropped_total'      => 0,
                                'last_dropped'       => null,
                                'last_dropped_error' => '',
                        ),
                        $state
                );
        }

        /**
         * Flush up to 50 coalesced changes in one signed `sync.batch` request.
         */
        public function flush_delta_queue( $limit = self::MAX_BATCH_SIZE ) {
                $limit = max( 1, min( self::MAX_BATCH_SIZE, absint( $limit ) ) );
                if ( ! $this->core()->is_configured() || ! $this->core()->has_wc() ) {
                        return array( 'success' => false, 'sent' => 0, 'remaining' => count( $this->get_delta_queue() ), 'message' => __( 'اتصال یا ووکامرس آماده نیست.', 'vigent-woo' ) );
                }
                if ( ! $this->acquire_lock( self::FLUSH_LOCK_OPTION, 120 ) ) {
                        return array( 'success' => true, 'sent' => 0, 'remaining' => count( $this->get_delta_queue() ), 'message' => __( 'ارسال دیگری در حال انجام است.', 'vigent-woo' ) );
                }

                $queue = $this->get_delta_queue();
                $slice = array_slice( $queue, 0, $limit, true );
                if ( empty( $slice ) ) {
                        $this->release_lock( self::FLUSH_LOCK_OPTION );
                        return array( 'success' => true, 'sent' => 0, 'remaining' => 0, 'message' => __( 'تغییری برای ارسال نیست.', 'vigent-woo' ) );
                }

                $events = array();
                $stale  = array();
                foreach ( $slice as $key => $entry ) {
                        $event = $this->materialize_delta( $entry );
                        if ( $event ) {
                                $events[ $key ] = $event;
                        } else {
                                // Nothing left to send (sync switched off, order deleted): these
                                // leave the queue immediately instead of riding along with a batch.
                                $stale[ $key ] = $entry;
                        }
                }
                if ( ! empty( $stale ) ) {
                        $this->remove_unchanged_entries( $stale );
                }

                if ( empty( $events ) ) {
                        $this->release_lock( self::FLUSH_LOCK_OPTION );
                        return array( 'success' => true, 'sent' => 0, 'remaining' => count( $this->get_delta_queue() ), 'message' => __( 'مورد معتبری برای ارسال نبود.', 'vigent-woo' ) );
                }

                // Send only as much as fits the server body limit; the rest keeps its place
                // in the queue and goes out on the next flush.
                $chunks = $this->chunk_events_by_budget( $events );
                $events = empty( $chunks ) ? array() : $chunks[0];
                $slice  = array_intersect_key( $slice, $events );

                $result   = $this->core()->send_batch_events( array_values( $events ), false );
                $previous = get_option( self::SYNC_STATE_OPTION, array() );
                if ( ! is_array( $previous ) ) {
                        $previous = array();
                }
                $state = array(
                        'last_attempt' => current_time( 'mysql' ),
                        'last_success' => null,
                        'last_error'   => '',
                        // Dead-letter counters survive both outcomes so the settings screen can
                        // keep warning until a full push clears the backlog.
                        'dropped_total'      => isset( $previous['dropped_total'] ) ? (int) $previous['dropped_total'] : 0,
                        'last_dropped'       => isset( $previous['last_dropped'] ) ? $previous['last_dropped'] : null,
                        'last_dropped_error' => isset( $previous['last_dropped_error'] ) ? (string) $previous['last_dropped_error'] : '',
                );

                if ( ! empty( $result['success'] ) ) {
                        $this->remove_unchanged_entries( $slice );
                        $state['last_success'] = current_time( 'mysql' );
                        if ( ! empty( $previous['last_success'] ) ) {
                                $state['previous_success'] = $previous['last_success'];
                        }
                } else {
                        $state['last_error'] = isset( $result['body'] ) ? wp_strip_all_tags( (string) $result['body'] ) : __( 'خطای نامشخص', 'vigent-woo' );
                        $dropped             = $this->mark_failed_entries( $slice, $state['last_error'] );
                        if ( $dropped > 0 ) {
                                $state['dropped_total']     += $dropped;
                                $state['last_dropped']       = current_time( 'mysql' );
                                $state['last_dropped_error'] = substr( $state['last_error'], 0, 500 );
                        }
                        if ( ! empty( $previous['last_success'] ) ) {
                                $state['last_success'] = $previous['last_success'];
                        }
                }

                update_option( self::SYNC_STATE_OPTION, $state, false );
                $this->release_lock( self::FLUSH_LOCK_OPTION );
                $remaining = count( $this->get_delta_queue() );
                return array(
                        'success'   => ! empty( $result['success'] ),
                        'sent'      => ! empty( $result['success'] ) ? count( $events ) : 0,
                        'remaining' => $remaining,
                        'message'   => ! empty( $result['success'] ) ? __( 'تغییرات با موفقیت ارسال شد.', 'vigent-woo' ) : $state['last_error'],
                );
        }

        private function materialize_delta( $entry ) {
                $topic     = isset( $entry['topic'] ) ? (string) $entry['topic'] : '';
                $entity    = isset( $entry['entity'] ) ? (string) $entry['entity'] : '';
                $entity_id = isset( $entry['entity_id'] ) ? absint( $entry['entity_id'] ) : 0;
                $data      = isset( $entry['data'] ) && is_array( $entry['data'] ) ? $entry['data'] : null;
                if ( 'product' === $entity && ! $this->core()->sync_products_enabled() ) {
                        return false;
                }
                if ( 'order' === $entity && ! $this->core()->sync_orders_enabled() ) {
                        return false;
                }

                if ( false === strpos( $topic, '.deleted' ) ) {
                        if ( 'product' === $entity ) {
                                $product = wc_get_product( $entity_id );
                                if ( $product ) {
                                        $data = $this->core()->product_to_payload( $product );
                                } else {
                                        $topic = 'product.deleted';
                                        $data  = array( 'id' => $entity_id );
                                }
                        } elseif ( 'order' === $entity ) {
                                $order = wc_get_order( $entity_id );
                                if ( ! $order ) {
                                        return false;
                                }
                                $data = $this->core()->order_to_payload( $order );
                        }
                }

                if ( ! is_array( $data ) ) {
                        $data = array( 'id' => $entity_id );
                }
                return array(
                        'event_id'  => isset( $entry['event_id'] ) ? $entry['event_id'] : wp_generate_uuid4(),
                        'topic'     => $topic,
                        'data'      => $data,
                        'changed_at'=> isset( $entry['changed_at'] ) ? $entry['changed_at'] : gmdate( 'c' ),
                );
        }

        private function remove_unchanged_entries( $sent_entries ) {
                if ( ! $this->acquire_lock( self::QUEUE_LOCK_OPTION, 5 ) ) {
                        return false;
                }
                $queue = $this->get_delta_queue();
                foreach ( $sent_entries as $key => $sent ) {
                        if ( isset( $queue[ $key ]['event_id'], $sent['event_id'] ) && hash_equals( (string) $queue[ $key ]['event_id'], (string) $sent['event_id'] ) ) {
                                unset( $queue[ $key ] );
                        }
                }
                $this->save_delta_queue( $queue );
                $this->release_lock( self::QUEUE_LOCK_OPTION );
                return true;
        }

        /**
         * Count a failed attempt against each entry and dead-letter the ones that can
         * never succeed, so one poisoned change cannot block the whole queue.
         *
         * @return int Number of entries removed from the queue.
         */
        private function mark_failed_entries( $failed_entries, $error ) {
                if ( ! $this->acquire_lock( self::QUEUE_LOCK_OPTION, 5 ) ) {
                        return 0;
                }
                $queue   = $this->get_delta_queue();
                $dropped = 0;
                foreach ( $failed_entries as $key => $failed ) {
                        if ( ! isset( $queue[ $key ]['event_id'], $failed['event_id'] ) ) {
                                continue;
                        }
                        if ( ! hash_equals( (string) $queue[ $key ]['event_id'], (string) $failed['event_id'] ) ) {
                                continue;
                        }
                        $attempts = isset( $queue[ $key ]['attempts'] ) ? (int) $queue[ $key ]['attempts'] + 1 : 1;
                        if ( $attempts >= self::MAX_DELTA_ATTEMPTS ) {
                                unset( $queue[ $key ] );
                                $dropped++;
                                continue;
                        }
                        $queue[ $key ]['attempts']   = $attempts;
                        $queue[ $key ]['last_error'] = substr( (string) $error, 0, 500 );
                }
                $this->save_delta_queue( $queue );
                $this->release_lock( self::QUEUE_LOCK_OPTION );
                return $dropped;
        }

        /**
         * Split events into request-sized groups, preserving keys.
         *
         * A single event bigger than the budget is still returned on its own — the
         * server decides, and repeated rejections dead-letter it rather than stalling
         * every other change behind it.
         */
        private function chunk_events_by_budget( $events ) {
                $chunks  = array();
                $current = array();
                $bytes   = 0;
                foreach ( $events as $key => $event ) {
                        $encoded = wp_json_encode( $event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
                        $size    = false === $encoded ? 0 : strlen( $encoded );
                        if ( ! empty( $current ) && ( $bytes + $size ) > self::MAX_BATCH_BYTES ) {
                                $chunks[] = $current;
                                $current  = array();
                                $bytes    = 0;
                        }
                        $current[ $key ] = $event;
                        $bytes          += $size;
                }
                if ( ! empty( $current ) ) {
                        $chunks[] = $current;
                }
                return $chunks;
        }

        private function acquire_lock( $option, $ttl ) {
                $now = time();
                for ( $attempt = 0; $attempt < 5; $attempt++ ) {
                        if ( add_option( $option, $now, '', 'no' ) ) {
                                return true;
                        }
                        $created = (int) get_option( $option, 0 );
                        if ( ! $created || ( $now - $created ) > $ttl ) {
                                delete_option( $option );
                                continue;
                        }
                        usleep( 20000 );
                }
                return false;
        }

        private function release_lock( $option ) {
                delete_option( $option );
        }

        public function count_items( $kind, $filter = array() ) {
                if ( ! $this->core()->has_wc() ) {
                        return 0;
                }
                if ( 'products' === $kind && empty( $filter['category'] ) ) {
                        $counts = wp_count_posts( 'product' );
                        return isset( $counts->publish ) ? (int) $counts->publish : 0;
                }

                $args = array( 'limit' => 1, 'page' => 1, 'paginate' => true, 'return' => 'ids' );
                if ( 'products' === $kind ) {
                        $args['status'] = 'publish';
                        if ( ! empty( $filter['category'] ) ) {
                                $term = get_term( absint( $filter['category'] ), 'product_cat' );
                                if ( $term && ! is_wp_error( $term ) ) {
                                        $args['category'] = array( $term->slug );
                                }
                        }
                        $result = wc_get_products( $args );
                } elseif ( 'orders' === $kind ) {
                        if ( ! empty( $filter['status'] ) ) {
                                $args['status'] = array( sanitize_text_field( $filter['status'] ) );
                        }
                        // Only count real orders, not refunds. Without this the total
                        // includes shop_order_refund posts, which inflates the count and
                        // makes the progress bar show more pages than actually exist.
                        $args['type'] = 'shop_order';
                        $result = wc_get_orders( $args );
                        $total  = is_object( $result ) && isset( $result->total ) ? (int) $result->total : 0;
                        // Cap the sync-able orders to MAX_ORDERS_TO_SYNC. The progress bar
                        // and the $done flag in sync_batch both read this count, so capping
                        // here makes the wizard stop after the most recent 1000 orders
                        // instead of grinding through the entire history.
                        if ( $total > self::MAX_ORDERS_TO_SYNC ) {
                                $total = self::MAX_ORDERS_TO_SYNC;
                        }
                        return $total;
                } else {
                        return 0;
                }
        }

        /** Send one full-sync page as a single request (maximum 50 events). */
        public function sync_batch( $kind, $offset, $batch_size = self::MAX_BATCH_SIZE, $filter = array() ) {
                $offset     = max( 0, absint( $offset ) );
                $batch_size = max( 1, min( self::MAX_BATCH_SIZE, absint( $batch_size ) ) );
                if ( ! $this->core()->has_wc() ) {
                        return array( 'sent' => 0, 'errors' => array( __( 'ووکامرس فعال نیست.', 'vigent-woo' ) ), 'total' => 0, 'done' => true );
                }

                $args = array(
                        'limit'   => $batch_size,
                        'offset'  => $offset,
                        'orderby' => 'date',
                        'order'   => 'DESC',
                        'return'  => 'objects',
                );
                $events = array();
                $items  = array();

                if ( 'products' === $kind ) {
                        $args['status'] = 'publish';
                        if ( ! empty( $filter['category'] ) ) {
                                $term = get_term( absint( $filter['category'] ), 'product_cat' );
                                if ( $term && ! is_wp_error( $term ) ) {
                                        $args['category'] = array( $term->slug );
                                }
                        }
                        $items = wc_get_products( $args );
                        foreach ( $items as $product ) {
                                $events[] = $this->make_event( 'product.updated', $this->core()->product_to_payload( $product ) );
                        }
                } elseif ( 'orders' === $kind ) {
                        if ( ! empty( $filter['status'] ) ) {
                                $args['status'] = array( sanitize_text_field( $filter['status'] ) );
                        }
                        // Only fetch real orders, not refunds. wc_get_orders() can return
                        // OrderRefund objects mixed in with WC_Order, and OrderRefund does
                        // not implement get_order_number() etc. — building a payload from
                        // it crashes the whole batch. Filtering at the query level is more
                        // efficient than filtering in the foreach loop.
                        $args['type'] = 'shop_order';
                        $items = wc_get_orders( $args );
                        foreach ( $items as $order ) {
                                // Second-line defense: even with type=shop_order, some WC
                                // versions/configurations may still return non-WC_Order
                                // objects. This is_a check is cheap and prevents a crash.
                                if ( ! is_a( $order, 'WC_Order' ) ) {
                                        continue;
                                }
                                if ( 'shop_order_refund' === $order->get_type() ) {
                                        continue;
                                }
                                $events[] = $this->make_event( 'order.updated', $this->core()->order_to_payload( $order ) );
                        }
                } else {
                        return array( 'sent' => 0, 'errors' => array( __( 'نوع همگام‌سازی نامعتبر است.', 'vigent-woo' ) ), 'total' => 0, 'done' => true );
                }

                $total = $this->count_items( $kind, $filter );
                $done  = ( $offset + count( $items ) ) >= $total || count( $items ) < $batch_size;
                // Hard cap for orders: never sync more than MAX_ORDERS_TO_SYNC, even
                // if count_items returned a higher number (shouldn't happen since we
                // cap there too, but this is a second-line defense). Once the offset
                // reaches the cap, we're done regardless of what the DB still holds.
                if ( 'orders' === $kind && ( $offset + count( $items ) ) >= self::MAX_ORDERS_TO_SYNC ) {
                        $done = true;
                }
                if ( empty( $events ) ) {
                        return array( 'sent' => 0, 'errors' => array(), 'total' => $total, 'done' => $done );
                }

                // One page can exceed the server body limit on stores with long product
                // descriptions. Every group is sent (failures land in the retry queue), so
                // an oversized page no longer fails the whole page.
                $sent   = 0;
                $errors = array();
                foreach ( $this->chunk_events_by_budget( $events ) as $chunk ) {
                        $chunk_events = array_values( $chunk );
                        $result = $this->core()->send_batch_events( $chunk_events, true );
                        if ( ! empty( $result['success'] ) ) {
                                $sent += count( $chunk_events );
                        } else {
                                // Build a detailed error message so the JS alert + debug log
                                // tell the admin exactly what failed. Without this the alert
                                // was a generic "ارسال ناموفق بود" with no actionable detail.
                                $err_body = isset( $result['body'] ) ? (string) $result['body'] : '';
                                if ( strlen( $err_body ) > 500 ) {
                                        $err_body = substr( $err_body, 0, 500 ) . '…';
                                }
                                $http_code = isset( $result['code'] ) ? (int) $result['code'] : 0;
                                /* translators: 1: HTTP code, 2: event count, 3: error body */
                                $errors[] = sprintf(
                                        __( 'HTTP %1$s | %2$s رویداد | %3$s', 'vigent-woo' ),
                                        $http_code > 0 ? (string) $http_code : '—',
                                        count( $chunk_events ),
                                        $err_body !== '' ? $err_body : __( 'پاسخی از سرور دریافت نشد.', 'vigent-woo' )
                                );
                        }
                }
                return array(
                        'sent'   => $sent,
                        'errors' => $errors,
                        'total'  => $total,
                        'done'   => $done,
                );
        }

        private function make_event( $topic, $data ) {
                return array(
                        'event_id'  => wp_generate_uuid4(),
                        'topic'     => $topic,
                        'data'      => $data,
                        'changed_at'=> gmdate( 'c' ),
                );
        }

        /** Move old per-event product/order retries into the coalesced queue. */
        public function migrate_legacy_retry_queue() {
                $legacy = $this->core()->get_retry_queue();
                $kept   = array();
                foreach ( $legacy as $item ) {
                        $topic = isset( $item['topic'] ) ? (string) $item['topic'] : '';
                        $data  = isset( $item['body'] ) ? json_decode( $item['body'], true ) : null;
                        if ( is_array( $data ) && preg_match( '/^(product|order)\\.(created|updated|deleted)$/', $topic, $match ) && ! empty( $data['id'] ) ) {
                                $this->enqueue_delta( $match[1], absint( $data['id'] ), $topic, false !== strpos( $topic, '.deleted' ) ? $data : null );
                        } else {
                                $kept[] = $item;
                        }
                }
                update_option( 'vigent_woo_retry_queue', $kept, false );
        }

        public function process_retry_queue() {
                $this->core()->process_retry_queue();
        }
}
