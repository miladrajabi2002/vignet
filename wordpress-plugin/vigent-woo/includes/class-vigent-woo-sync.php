<?php
/**
 * Sync class — full sync (with progress), product/order hooks, retry queue.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_Sync {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		// Product hooks.
		add_action( 'woocommerce_new_product', array( $this, 'on_product_new' ), 10, 2 );
		add_action( 'woocommerce_update_product', array( $this, 'on_product_update' ), 10, 2 );
		add_action( 'woocommerce_trash_product', array( $this, 'on_product_delete' ) );
		add_action( 'before_delete_post', array( $this, 'on_product_delete' ) );

		// Order hooks.
		add_action( 'woocommerce_order_status_changed', array( $this, 'on_order_status_changed' ), 10, 4 );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	// ─── Product hooks ───────────────────────────────────────────────────

	public function on_product_new( $product_id, $product ) {
		$this->product_save( $product_id, true );
	}

	public function on_product_update( $product_id, $product ) {
		$this->product_save( $product_id, false );
	}

	private function product_save( $product_id, $is_new ) {
		if ( ! $this->core()->sync_products_enabled() ) {
			return;
		}
		if ( wp_is_post_revision( $product_id ) || wp_is_post_autosave( $product_id ) ) {
			return;
		}
		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return;
		}
		$topic   = $is_new ? 'product.created' : 'product.updated';
		$payload = $this->core()->product_to_payload( $product );
		$this->core()->send_event( $topic, $payload );
	}

	public function on_product_delete( $post_id ) {
		if ( ! $this->core()->has_wc() || ! $this->core()->sync_products_enabled() ) {
			return;
		}
		if ( 'product' !== get_post_type( $post_id ) ) {
			return;
		}
		$product = wc_get_product( $post_id );
		$payload = array( 'id' => (int) $post_id );
		if ( $product ) {
			$payload['sku']  = $product->get_sku();
			$payload['name'] = $product->get_name();
		}
		$this->core()->send_event( 'product.deleted', $payload );
	}

	// ─── Order hooks ─────────────────────────────────────────────────────

	public function on_order_status_changed( $order_id, $old_status, $new_status, $order ) {
		if ( ! $this->core()->sync_orders_enabled() ) {
			return;
		}
		if ( ! $order ) {
			$order = wc_get_order( $order_id );
		}
		if ( ! $order ) {
			return;
		}
		$payload = $this->core()->order_to_payload( $order );
		$this->core()->send_event( 'order.updated', $payload );
	}

	// ─── Full sync with progress ─────────────────────────────────────────

	public function count_items( $kind, $filter = array() ) {
		if ( ! $this->core()->has_wc() ) {
			return 0;
		}

		if ( 'products' === $kind ) {
			$args = array(
				'status'  => 'publish',
				'limit'   => -1,
				'return'  => 'ids',
			);
			// Apply filter.
			if ( ! empty( $filter['category'] ) ) {
				$args['category'] = array( intval( $filter['category'] ) );
			}
			$ids = wc_get_products( $args );
			return is_array( $ids ) ? count( $ids ) : 0;
		}

		if ( 'orders' === $kind ) {
			$args = array(
				'limit'  => -1,
				'return' => 'ids',
			);
			if ( ! empty( $filter['status'] ) ) {
				$args['status'] = array( $filter['status'] );
			}
			$ids = wc_get_orders( $args );
			return is_array( $ids ) ? count( $ids ) : 0;
		}

		return 0;
	}

	public function sync_batch( $kind, $offset, $batch_size = 25, $filter = array() ) {
		$sent   = 0;
		$errors = array();

		if ( ! $this->core()->has_wc() ) {
			return array( 'sent' => 0, 'errors' => array( __( 'ووکامرس فعال نیست.', 'vigent-woo' ) ), 'total' => 0, 'done' => true );
		}

		if ( 'products' === $kind ) {
			$args = array(
				'status'  => 'publish',
				'limit'   => $batch_size,
				'offset'  => $offset,
				'orderby' => 'date',
				'order'   => 'DESC',
				'return'  => 'objects',
			);
			if ( ! empty( $filter['category'] ) ) {
				$args['category'] = array( intval( $filter['category'] ) );
			}
			$products = wc_get_products( $args );

			foreach ( $products as $product ) {
				$result = $this->core()->send_event( 'product.created', $this->core()->product_to_payload( $product ) );
				if ( ! empty( $result['success'] ) ) {
					$sent++;
				} else {
					$errors[] = sprintf( __( 'محصول #%d: %s', 'vigent-woo' ), $product->get_id(), $result['body'] );
				}
			}

			$total = $this->count_items( 'products', $filter );
			$done  = ( $offset + count( $products ) ) >= $total || count( $products ) < $batch_size;
			return array( 'sent' => $sent, 'errors' => $errors, 'total' => $total, 'done' => $done );
		}

		if ( 'orders' === $kind ) {
			$args = array(
				'limit'   => $batch_size,
				'offset'  => $offset,
				'orderby' => 'date',
				'order'   => 'DESC',
				'return'  => 'objects',
			);
			if ( ! empty( $filter['status'] ) ) {
				$args['status'] = array( $filter['status'] );
			}
			$orders = wc_get_orders( $args );

			foreach ( $orders as $order ) {
				$result = $this->core()->send_event( 'order.created', $this->core()->order_to_payload( $order ) );
				if ( ! empty( $result['success'] ) ) {
					$sent++;
				} else {
					$errors[] = sprintf( __( 'سفارش #%d: %s', 'vigent-woo' ), $order->get_id(), $result['body'] );
				}
			}

			$total = $this->count_items( 'orders', $filter );
			$done  = ( $offset + count( $orders ) ) >= $total || count( $orders ) < $batch_size;
			return array( 'sent' => $sent, 'errors' => $errors, 'total' => $total, 'done' => $done );
		}

		return array( 'sent' => 0, 'errors' => array(), 'total' => 0, 'done' => true );
	}

	public function process_retry_queue() {
		$this->core()->process_retry_queue();
	}
}
