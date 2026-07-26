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
				'queue_count'  => count( $this->get_delta_queue() ),
				'last_attempt' => null,
				'last_success' => null,
				'last_error'   => '',
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
		foreach ( $slice as $key => $entry ) {
			$event = $this->materialize_delta( $entry );
			if ( $event ) {
				$events[ $key ] = $event;
			}
		}

		if ( empty( $events ) ) {
			$this->remove_unchanged_entries( $slice );
			$this->release_lock( self::FLUSH_LOCK_OPTION );
			return array( 'success' => true, 'sent' => 0, 'remaining' => count( $this->get_delta_queue() ), 'message' => __( 'مورد معتبری برای ارسال نبود.', 'vigent-woo' ) );
		}

		$result = $this->core()->send_batch_events( array_values( $events ), false );
		$state  = array(
			'last_attempt' => current_time( 'mysql' ),
			'last_success' => null,
			'last_error'   => '',
		);

		if ( ! empty( $result['success'] ) ) {
			$this->remove_unchanged_entries( $slice );
			$previous              = get_option( self::SYNC_STATE_OPTION, array() );
			$state['last_success'] = current_time( 'mysql' );
			if ( is_array( $previous ) && ! empty( $previous['last_success'] ) ) {
				$state['previous_success'] = $previous['last_success'];
			}
		} else {
			$state['last_error'] = isset( $result['body'] ) ? wp_strip_all_tags( (string) $result['body'] ) : __( 'خطای نامشخص', 'vigent-woo' );
			$this->mark_failed_entries( $slice, $state['last_error'] );
			$previous = get_option( self::SYNC_STATE_OPTION, array() );
			if ( is_array( $previous ) && ! empty( $previous['last_success'] ) ) {
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

	private function mark_failed_entries( $failed_entries, $error ) {
		if ( ! $this->acquire_lock( self::QUEUE_LOCK_OPTION, 5 ) ) {
			return false;
		}
		$queue = $this->get_delta_queue();
		foreach ( $failed_entries as $key => $failed ) {
			if ( isset( $queue[ $key ]['event_id'], $failed['event_id'] ) && hash_equals( (string) $queue[ $key ]['event_id'], (string) $failed['event_id'] ) ) {
				$queue[ $key ]['attempts']   = isset( $queue[ $key ]['attempts'] ) ? (int) $queue[ $key ]['attempts'] + 1 : 1;
				$queue[ $key ]['last_error'] = substr( (string) $error, 0, 500 );
			}
		}
		$this->save_delta_queue( $queue );
		$this->release_lock( self::QUEUE_LOCK_OPTION );
		return true;
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
			$result = wc_get_orders( $args );
		} else {
			return 0;
		}
		return is_object( $result ) && isset( $result->total ) ? (int) $result->total : 0;
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
			$items = wc_get_orders( $args );
			foreach ( $items as $order ) {
				$events[] = $this->make_event( 'order.updated', $this->core()->order_to_payload( $order ) );
			}
		} else {
			return array( 'sent' => 0, 'errors' => array( __( 'نوع همگام‌سازی نامعتبر است.', 'vigent-woo' ) ), 'total' => 0, 'done' => true );
		}

		$total = $this->count_items( $kind, $filter );
		$done  = ( $offset + count( $items ) ) >= $total || count( $items ) < $batch_size;
		if ( empty( $events ) ) {
			return array( 'sent' => 0, 'errors' => array(), 'total' => $total, 'done' => $done );
		}
		$result = $this->core()->send_batch_events( $events, true );
		return array(
			'sent'   => ! empty( $result['success'] ) ? count( $events ) : 0,
			'errors' => ! empty( $result['success'] ) ? array() : array( isset( $result['body'] ) ? $result['body'] : __( 'ارسال ناموفق بود.', 'vigent-woo' ) ),
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
