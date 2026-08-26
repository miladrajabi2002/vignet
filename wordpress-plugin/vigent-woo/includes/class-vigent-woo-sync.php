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
         * Maximum number of ORDERS to sync during a full push.
         *
         * Orders are historical and rarely useful past a certain age, so we still
         * cap them at MAX_ORDERS_TO_SYNC to keep the panel DB bounded and the
         * sync wizard fast. The Vigent panel also enforces its own retention
         * (deletes oldest orders when a workspace exceeds 2000).
         *
         * IMPORTANT: This cap applies to ORDERS ONLY. Customers are no longer
         * capped — every customer with at least one paid order is synced, even
         * if the store has tens of thousands of them. The product owner asked
         * for this explicitly: "محدودیت نداره" (no limit on customers).
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
        /**
         * Order statuses that count as "successful" (paid) for the
         * customer-filter. A customer is synced to Vigent only if they
         * have at least one shop_order in one of these statuses.
         *
         *   • completed  — order fulfilled & closed
         *   • processing — payment received, being prepared/shipped
         *
         * Excluded: pending, on-hold, cancelled, refunded, failed — these
         * represent abandoned or unsuccessful checkouts and the customer
         * has not actually paid yet.
         */
        const SUCCESSFUL_ORDER_STATUSES = array( 'completed', 'processing' );
        /**
         * Transient key + TTL for the cached list of customer IDs that
         * have ≥1 paid order. We cache it so the bulk-sync wizard doesn't
         * re-run the orders query on every page (50 customers per page ×
         * N pages would be expensive on a busy store).
         */
        const CUSTOMERS_WITH_ORDERS_CACHE_KEY = 'vigent_woo_customers_with_orders';
        const CUSTOMERS_WITH_ORDERS_CACHE_TTL = 600; // 10 minutes

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

                // Customer hooks — fire on:
                //   • user_register / profile_update       → covers WP-level signups + edits.
                //   • woocommerce_create_customer          → covers WC programmatic creation.
                //   • woocommerce_save_account_details      → customer editing their account page.
                //   • personal_options_update / edit_user_profile_update → admin editing the user.
                //   • woocommerce_customer_save_address     → customer updating their billing address.
                // We attach to ALL of them because different hosting setups fire different
                // hooks depending on whether the customer was created via the admin UI,
                // the checkout form, the my-account page, or programmatically.
                add_action( 'user_register', array( $this, 'on_customer_change' ) );
                add_action( 'profile_update', array( $this, 'on_customer_change' ), 10, 2 );
                add_action( 'personal_options_update', array( $this, 'on_customer_change' ) );
                add_action( 'edit_user_profile_update', array( $this, 'on_customer_change' ) );
                add_action( 'woocommerce_create_customer', array( $this, 'on_customer_change' ) );
                add_action( 'woocommerce_save_account_details', array( $this, 'on_customer_change' ) );
                add_action( 'woocommerce_customer_save_address', array( $this, 'on_customer_change' ) );

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

                // Whenever an order transitions into or out of a "successful"
                // (paid) status, two things need to happen:
                //   1. Invalidate the cached list of customer IDs with paid
                //      orders, so the next bulk-sync sees the up-to-date set.
                //   2. If the order is now paid AND the customer exists as a WP
                //      user, queue the customer too — this is how a brand-new
                //      customer who just paid for their first order gets synced
                //      to Vigent (their user_register hook fired before they
                //      had any paid orders, so queue_customer skipped them).
                if ( ! $this->core()->sync_customers_enabled() ) {
                        return;
                }
                $paid_statuses = self::SUCCESSFUL_ORDER_STATUSES;
                $was_paid = in_array( $old_status, $paid_statuses, true );
                $is_paid  = in_array( $new_status, $paid_statuses, true );
                if ( $was_paid === $is_paid ) {
                        // No transition in/out of paid — nothing extra to do.
                        return;
                }
                // Cache invalidation: the set of "customers with paid orders"
                // just changed.
                $this->invalidate_customers_with_orders_cache();
                // Only queue the customer when transitioning INTO a paid status.
                // (Transitioning OUT — e.g. a completed order is refunded —
                // doesn't un-sync the customer from Vigent; we leave them there
                // for historical support context.)
                if ( ! $is_paid ) {
                        return;
                }
                if ( ! $order ) {
                        $order = wc_get_order( $order_id );
                }
                if ( ! $order ) {
                        return;
                }
                $customer_id = (int) $order->get_customer_id();
                if ( $customer_id > 0 ) {
                        $this->queue_customer( $customer_id, 'customer.updated' );
                }
        }

        private function queue_order( $order_id, $topic ) {
                $order_id = absint( $order_id );
                if ( ! $order_id || ! $this->core()->sync_orders_enabled() ) {
                        return;
                }
                $this->enqueue_delta( 'order', $order_id, $topic );
        }

        /**
         * Customer change handler.
         *
         * Multiple WP/WC hooks can fire for the same customer during a single
         * save operation (e.g. on the my-account page, WC fires
         * woocommerce_save_account_details AND profile_update). The delta
         * queue coalesces them into one event keyed by entity:entity_id, so
         * we don't send the customer twice.
         *
         * We also filter out non-customer users early. Admins, editors, and
         * shop managers don't need to be synced to Vigent — they're not
         * customers.
         *
         * @param int|\WP_User $user User ID or WP_User object.
         * @return void
         */
        public function on_customer_change( $user ) {
                $user_id = is_object( $user ) && isset( $user->ID ) ? (int) $user->ID : (int) $user;
                if ( ! $user_id ) {
                        return;
                }
                // Only sync if customers sync is enabled. We check here (not in
                // queue_customer) because queue_customer is private and we want
                // to bail as early as possible — before get_userdata() is even
                // called, which has a small but non-zero cost on every page load.
                if ( ! $this->core()->sync_customers_enabled() ) {
                        return;
                }
                $this->queue_customer( $user_id, 'customer.updated' );
        }

        private function queue_customer( $user_id, $topic ) {
                $user_id = absint( $user_id );
                if ( ! $user_id ) {
                        return;
                }
                // Skip non-customer users. WP administrators, editors, and shop
                // managers should never be exposed as «customers» in Vigent —
                // their contact info would leak internal staff data.
                if ( ! function_exists( 'get_userdata' ) ) {
                        return;
                }
                $user = get_userdata( $user_id );
                if ( ! $user ) {
                        return;
                }
                // A user is a «customer» if:
                //   • they have the 'customer' role (the WooCommerce default), OR
                //   • they have billing_email / billing_phone set (covers users
                //     who never had the role assigned explicitly but placed an
                //     order as a guest-converted-to-customer).
                $is_customer_role = is_array( $user->roles ) && in_array( 'customer', $user->roles, true );
                $has_billing      = ! empty( get_user_meta( $user_id, 'billing_phone', true ) )
                        || ! empty( get_user_meta( $user_id, 'billing_email', true ) );
                if ( ! $is_customer_role && ! $has_billing ) {
                        return;
                }
                // Stricter filter: only sync customers who have at least one
                // PAID order (status = completed or processing). A registered
                // user with no successful purchase is just a prospect — not a
                // customer worth loading into Vigent's CRM. They will be queued
                // automatically the moment their first order is paid, via the
                // on_order_status_changed hook below.
                if ( ! $this->customer_has_successful_orders( $user_id ) ) {
                        return;
                }
                $this->enqueue_delta( 'customer', $user_id, $topic );
        }

        /**
         * Add or coalesce an entity change. Hooks only write locally; the cron flush
         * sends at most one request for the latest state of each changed entity.
         */
        public function enqueue_delta( $entity, $entity_id, $topic, $data = null ) {
                if ( ! in_array( $entity, array( 'product', 'order', 'customer' ), true ) ) {
                        return false;
                }
                if ( 'product' === $entity && ! $this->core()->sync_products_enabled() ) {
                        return false;
                }
                if ( 'order' === $entity && ! $this->core()->sync_orders_enabled() ) {
                        return false;
                }
                if ( 'customer' === $entity && ! $this->core()->sync_customers_enabled() ) {
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
                if ( 'customer' === $entity && ! $this->core()->sync_customers_enabled() ) {
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
                        } elseif ( 'customer' === $entity ) {
                                // Customer deleted? We don't have a delete hook wired up
                                // (WordPress doesn't fire one cleanly for users), so a
                                // customer_delta whose user has vanished is treated as
                                // a no-op — we skip sending rather than emit a delete
                                // event. The Vigent panel will keep its Contact record
                                // around; this is acceptable for now.
                                $payload = $this->core()->customer_to_payload( $entity_id );
                                if ( empty( $payload ) ) {
                                        return false;
                                }
                                // Skip customers with neither email nor phone — they
                                // are useless to Vigent and would create empty
                                // Contact rows that the agent can't message.
                                if ( empty( $payload['email'] ) && empty( $payload['phone'] ) ) {
                                        return false;
                                }
                                $data = $payload;
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

        /**
         * Get the list of WordPress user IDs that have at least one paid
         * (completed or processing) shop_order.
         *
         * Used by both count_items('customers') and sync_batch('customers')
         * so that the bulk-sync wizard ONLY sends customers who have actually
         * purchased something — not every registered user with the 'customer'
         * role (which includes abandoned checkouts, never-paid signups, etc.).
         *
         * The result is cached in a transient for 10 minutes to avoid
         * re-running the orders query on every wizard page (the wizard paginates
         * 50 customers at a time, so a 1000-customer store would otherwise hit
         * this 20 times). The cache is invalidated by on_order_status_changed
         * whenever an order transitions into or out of a paid status.
         *
         * Returns the IDs sorted DESC (newest user_id first) so the wizard
         * syncs the most recent customers first — same UX as before.
         *
         * @return int[] Array of WP user IDs (may be empty).
         */
        public function get_customer_ids_with_successful_orders() {
                if ( ! $this->core()->has_wc() || ! function_exists( 'wc_get_orders' ) ) {
                        return array();
                }
                $cached = get_transient( self::CUSTOMERS_WITH_ORDERS_CACHE_KEY );
                if ( is_array( $cached ) ) {
                        return $cached;
                }
                // Fetch all paid order IDs. wc_get_orders abstracts HPOS vs
                // legacy post storage, so this works on both. We ask for IDs
                // only (no full object hydration) to keep memory low on stores
                // with thousands of historical orders.
                $order_ids = wc_get_orders( array(
                        'status'  => self::SUCCESSFUL_ORDER_STATUSES,
                        'type'    => 'shop_order',
                        'limit'   => -1,
                        'return'  => 'ids',
                        'orderby' => 'date',
                        'order'   => 'DESC',
                ) );
                if ( empty( $order_ids ) ) {
                        set_transient( self::CUSTOMERS_WITH_ORDERS_CACHE_KEY, array(), self::CUSTOMERS_WITH_ORDERS_CACHE_TTL );
                        return array();
                }
                // De-duplicate by customer_id. We iterate the order IDs and
                // pull each order's customer_id. For very large stores this is
                // O(N) order fetches, but wc_get_order() is internally cached
                // by WooCommerce so subsequent calls in the same request are
                // cheap. The result is also cached in a transient so the next
                // wizard page skips this entirely.
                $seen = array();
                foreach ( $order_ids as $order_id ) {
                        $order = wc_get_order( $order_id );
                        if ( ! $order ) {
                                continue;
                        }
                        $cid = (int) $order->get_customer_id();
                        if ( $cid > 0 ) {
                                $seen[ $cid ] = true;
                        }
                }
                $ids = array_keys( $seen );
                // Sort DESC so newest customers come first in the sync wizard.
                rsort( $ids );
                set_transient( self::CUSTOMERS_WITH_ORDERS_CACHE_KEY, $ids, self::CUSTOMERS_WITH_ORDERS_CACHE_TTL );
                return $ids;
        }

        /**
         * Check if a single user has at least one paid order.
         *
         * Used by queue_customer() on every customer-change hook to decide
         * whether the change is worth syncing. We query with limit=1 so it's
         * fast even on stores with thousands of orders per customer.
         *
         * @param int $user_id WordPress user ID.
         * @return bool True if the user has ≥1 completed/processing order.
         */
        private function customer_has_successful_orders( $user_id ) {
                $user_id = absint( $user_id );
                if ( ! $user_id || ! $this->core()->has_wc() || ! function_exists( 'wc_get_orders' ) ) {
                        return false;
                }
                $orders = wc_get_orders( array(
                        'customer_id' => $user_id,
                        'status'      => self::SUCCESSFUL_ORDER_STATUSES,
                        'type'        => 'shop_order',
                        'limit'       => 1,
                        'return'      => 'ids',
                ) );
                return ! empty( $orders );
        }

        /**
         * Invalidate the cached list of customer IDs with paid orders.
         *
         * Called from on_order_status_changed whenever an order transitions
         * into or out of a "successful" status, so the next bulk-sync page
         * sees the up-to-date list.
         */
        public function invalidate_customers_with_orders_cache() {
                delete_transient( self::CUSTOMERS_WITH_ORDERS_CACHE_KEY );
        }

        /**
         * Get the set of WP user IDs that have already been synced to Vigent
         * during a previous bulk-sync run.
         *
         * Stored as a PHP array in the WP option `vigent_woo_synced_customer_ids`.
         * The set grows on every successful sync_batch('customers') call —
         * we add the page of IDs that was just sent. It is NEVER shrunk
         * automatically (a customer that was synced stays "synced" even if
         * their order is later refunded — we want the agent to keep their
         * history).
         *
         * This is what powers the "X از N قبلاً ارسال شده" hint on the
         * management card: we compare the set of paying-customer IDs against
         * this stored set to figure out how many are NEW (will be added to
         * Vigent) vs already known (will just be updated).
         *
         * @return int[] Associative array [user_id => true] for O(1) lookup.
         */
        public function get_synced_customer_ids() {
                $ids = get_option( 'vigent_woo_synced_customer_ids', array() );
                if ( ! is_array( $ids ) ) {
                        $ids = array();
                }
                return $ids;
        }

        /**
         * Mark a list of WP user IDs as "synced to Vigent".
         *
         * Called from sync_batch('customers') after a successful page send.
         * We merge the new IDs into the stored set so subsequent runs can
         * compute the "new vs. already-known" delta.
         *
         * @param int[] $user_ids IDs to mark as synced.
         */
        public function mark_customers_synced( $user_ids ) {
                if ( empty( $user_ids ) ) {
                        return;
                }
                $existing = $this->get_synced_customer_ids();
                $changed = false;
                foreach ( $user_ids as $uid ) {
                        $uid = (int) $uid;
                        if ( $uid > 0 && ! isset( $existing[ $uid ] ) ) {
                                $existing[ $uid ] = true;
                                $changed = true;
                        }
                }
                if ( $changed ) {
                        update_option( 'vigent_woo_synced_customer_ids', $existing, false );
                }
        }

        /**
         * Compute stats about paying customers and their sync state.
         *
         * Returns:
         *   • total       — total number of customers with ≥1 paid order
         *                   (the same number the wizard / sync_batch will send).
         *   • synced      — how many of those have already been sent to Vigent
         *                   in a previous successful bulk-sync run.
         *   • new         — how many are NEW (will be added to Vigent as new
         *                   contacts on the next sync). Computed as total - synced.
         *
         * Used by the management card to show:
         *   "N مشتری با خرید موفق — X تا قبلاً ارسال شده، Y تا جدید اضافه می‌شود"
         *
         * Note: this is a best-effort count. The "synced" set is tracked in the
         * WP option `vigent_woo_synced_customer_ids` and grows on every successful
         * sync_batch('customers') call. If a customer exists in Vigent but their
         * ID is not in this option (e.g. they were synced by an older plugin
         * version before this tracking was added, or via the delta queue), they
         * will be counted as "new" and re-sent — Vigent's upsert logic will
         * just update them instead of creating a duplicate (it matches by phone
         * / email / externalId), so this is safe.
         *
         * @return array{total:int, synced:int, new:int}
         */
        public function get_paying_customer_stats() {
                $all_ids = $this->get_customer_ids_with_successful_orders();
                $total   = count( $all_ids );
                if ( $total === 0 ) {
                        return array( 'total' => 0, 'synced' => 0, 'new' => 0 );
                }
                $synced_set = $this->get_synced_customer_ids();
                $synced     = 0;
                foreach ( $all_ids as $uid ) {
                        if ( isset( $synced_set[ $uid ] ) ) {
                                $synced++;
                        }
                }
                return array(
                        'total'  => $total,
                        'synced' => $synced,
                        'new'    => max( 0, $total - $synced ),
                );
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
                } elseif ( 'customers' === $kind ) {
                        // Count only customers who have at least one PAID order
                        // (status = completed or processing). This is stricter than
                        // the old "has customer role OR has billing info" check —
                        // we now skip users who registered but never actually bought
                        // anything, abandoned their cart, or had their order fail.
                        // These are the only customers worth syncing to Vigent.
                        //
                        // NOTE: Customers are NOT capped at MAX_ORDERS_TO_SYNC.
                        // The product owner asked for "no limit" — every customer
                        // with at least one paid order is synced, regardless of
                        // how many thousands there are. Orders are still capped
                        // (they're historical and the panel retains at most 2000),
                        // but customers are CRM entities and we want all of them.
                        $ids   = $this->get_customer_ids_with_successful_orders();
                        $total = count( $ids );
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
                } elseif ( 'customers' === $kind ) {
                        // Only sync customers who have at least one PAID order
                        // (status = completed or processing). The full list is
                        // cached in a transient; we slice it by offset/batch_size
                        // to paginate the wizard. Then we use WP_User_Query with
                        // an `include` clause to hydrate the user objects for the
                        // current page only.
                        //
                        // This is stricter than the previous "all users with the
                        // customer role" filter — we now skip registered users who
                        // never actually bought anything. The Vigent panel only
                        // cares about customers who have a real purchase history.
                        $all_ids = $this->get_customer_ids_with_successful_orders();
                        $page_ids = array_slice( $all_ids, $offset, $batch_size );
                        if ( empty( $page_ids ) ) {
                                $users = array();
                        } else {
                                $user_q = new \WP_User_Query( array(
                                        'include' => $page_ids,
                                        'number'  => $batch_size,
                                        'orderby'  => 'registered',
                                        'order'    => 'DESC',
                                        'fields'   => 'all',
                                ) );
                                $users = $user_q->get_results();
                        }
                        foreach ( $users as $user ) {
                                $payload = $this->core()->customer_to_payload( $user );
                                if ( empty( $payload ) ) {
                                        continue;
                                }
                                // Skip customers with no email AND no phone — they
                                // would create empty Contact rows Vigent can't use.
                                if ( empty( $payload['email'] ) && empty( $payload['phone'] ) ) {
                                        continue;
                                }
                                $events[] = $this->make_event( 'customer.updated', $payload );
                        }
                        $items = $users;
                } else {
                        return array( 'sent' => 0, 'errors' => array( __( 'نوع همگام‌سازی نامعتبر است.', 'vigent-woo' ) ), 'total' => 0, 'done' => true );
                }

                $total = $this->count_items( $kind, $filter );
                $done  = ( $offset + count( $items ) ) >= $total || count( $items ) < $batch_size;
                // Hard cap for ORDERS only: never sync more than MAX_ORDERS_TO_SYNC
                // orders, even if count_items returned a higher number (shouldn't
                // happen since we cap there too, but this is a second-line defense).
                // Once the offset reaches the cap, we're done regardless of what the
                // DB still holds.
                //
                // CUSTOMERS are NOT capped — see the comment in count_items() above.
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
                $all_ok = true; // tracks whether every chunk succeeded (for marking IDs).
                foreach ( $this->chunk_events_by_budget( $events ) as $chunk ) {
                        $chunk_events = array_values( $chunk );
                        $result = $this->core()->send_batch_events( $chunk_events, true );
                        if ( ! empty( $result['success'] ) ) {
                                $sent += count( $chunk_events );
                        } else {
                                $all_ok = false;
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
                // For customers: if every chunk in this page was sent successfully,
                // mark the user IDs as "synced to Vigent". This lets the management
                // card show "X از N قبلاً ارسال شده" so the shop owner knows how
                // many customers are NEW (will be added) vs already-known (will be
                // updated). We only mark on full success — if any chunk failed we
                // don't mark, so the next retry will re-send them and the count
                // stays accurate.
                if ( 'customers' === $kind && $all_ok && $sent > 0 ) {
                        $synced_ids = array();
                        foreach ( $items as $user ) {
                                if ( is_object( $user ) && isset( $user->ID ) ) {
                                        $synced_ids[] = (int) $user->ID;
                                }
                        }
                        if ( ! empty( $synced_ids ) ) {
                                $this->mark_customers_synced( $synced_ids );
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
