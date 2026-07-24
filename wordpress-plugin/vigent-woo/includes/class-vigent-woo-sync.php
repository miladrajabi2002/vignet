<?php
/**
 * Sync class for Vigent Woo plugin.
 *
 * Handles full sync (with progress tracking) + automatic event hooks
 * (product save, order status change, content save).
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
		// ─── Content hooks (no WC needed) ───
		add_action( 'save_post', array( $this, 'on_content_save' ), 20, 2 );
		add_action( 'wp_trash_post', array( $this, 'on_content_delete' ) );

		// ─── WC product hooks ───
		add_action( 'woocommerce_new_product', array( $this, 'on_product_new' ), 10, 2 );
		add_action( 'woocommerce_update_product', array( $this, 'on_product_update' ), 10, 2 );
		add_action( 'woocommerce_trash_product', array( $this, 'on_product_delete' ) );
		add_action( 'before_delete_post', array( $this, 'on_product_delete' ) );

		// ─── WC order hooks ───
		add_action( 'woocommerce_order_status_changed', array( $this, 'on_order_status_changed' ), 10, 4 );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	// ─── Content hooks ───────────────────────────────────────────────────

	public function on_content_save( $post_id, $post ) {
		if ( ! $this->core()->sync_content_enabled() ) {
			return;
		}
		if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
			return;
		}
		if ( ! in_array( $post->post_type, array( 'post', 'page' ), true ) ) {
			return;
		}
		if ( 'publish' !== $post->post_status ) {
			return;
		}
		$this->core()->send_event( 'content.updated', $this->core()->content_to_payload( $post ) );
	}

	public function on_content_delete( $post_id ) {
		if ( ! $this->core()->sync_content_enabled() ) {
			return;
		}
		if ( ! in_array( get_post_type( $post_id ), array( 'post', 'page' ), true ) ) {
			return;
		}
		$this->core()->send_event(
			'content.deleted',
			array(
				'id'  => (int) $post_id,
				'url' => get_permalink( $post_id ),
			)
		);
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
		// Respect product filter (skip if excluded).
		if ( ! $this->should_sync_product( $product ) ) {
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

	// ─── Product filter ──────────────────────────────────────────────────

	/**
	 * Should this product be synced based on user's filter settings?
	 *
	 * @param WC_Product $product
	 * @return bool
	 */
	public function should_sync_product( $product ) {
		$s = $this->core()->get_settings();

		// Exclude by ID.
		$exclude = ! empty( $s['exclude_product_ids'] ) ? array_map( 'intval', (array) $s['exclude_product_ids'] ) : array();
		if ( in_array( (int) $product->get_id(), $exclude, true ) ) {
			return false;
		}

		$filter = isset( $s['product_filter'] ) ? $s['product_filter'] : 'all';

		switch ( $filter ) {
			case 'published':
				// Only publish status (skip drafts).
				return 'publish' === $product->get_status();
			case 'priced':
				// Only products with a price > 0.
				$price = $product->get_price();
				return ! empty( $price ) && (float) $price > 0;
			case 'category':
				// Only products in selected categories.
				$cats = ! empty( $s['product_categories'] ) ? array_map( 'intval', (array) $s['product_categories'] ) : array();
				if ( empty( $cats ) ) {
					return true; // No categories selected = sync all.
				}
				$product_cats = wp_get_post_terms( $product->get_id(), 'product_cat', array( 'fields' => 'ids' ) );
				if ( ! is_array( $product_cats ) ) {
					return false;
				}
				$intersect = array_intersect( $product_cats, $cats );
				return ! empty( $intersect );
			case 'all':
			default:
				return true;
		}
	}

	// ─── Full sync with progress ─────────────────────────────────────────

	/**
	 * Get items to sync (counts only — used to display progress bar).
	 *
	 * @param string $kind 'products' | 'orders' | 'content'
	 * @return int Total count of items to sync.
	 */
	public function count_items( $kind ) {
		if ( 'content' === $kind ) {
			$counts = wp_count_posts( 'post' );
			$page_counts = wp_count_posts( 'page' );
			return (int) $counts->publish + (int) $page_counts->publish;
		}

		if ( ! $this->core()->has_wc() ) {
			return 0;
		}

		if ( 'products' === $kind ) {
			// Use the same filter as the sync to count.
			$args = array(
				'status'  => array( 'publish', 'private', 'draft' ),
				'limit'   => -1,
				'return'  => 'ids',
			);
			$ids = wc_get_products( $args );
			$count = 0;
			foreach ( $ids as $pid ) {
				$p = wc_get_product( $pid );
				if ( $p && $this->should_sync_product( $p ) ) {
					$count++;
				}
			}
			return $count;
		}

		if ( 'orders' === $kind ) {
			$count = wc_get_orders( array( 'limit' => -1, 'return' => 'ids' ) );
			return is_array( $count ) ? count( $count ) : 0;
		}

		return 0;
	}

	/**
	 * Sync a single batch (used by AJAX progress-bar sync).
	 *
	 * @param string $kind
	 * @param int    $offset
	 * @param int    $batch_size
	 * @return array { sent, errors, total, done }
	 */
	public function sync_batch( $kind, $offset, $batch_size = 25 ) {
		$sent   = 0;
		$errors = array();

		if ( 'content' === $kind ) {
			$posts = get_posts( array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => $batch_size,
				'offset'         => $offset,
				'orderby'        => 'date',
				'order'          => 'DESC',
			) );

			foreach ( $posts as $post ) {
				$result = $this->core()->send_event( 'content.updated', $this->core()->content_to_payload( $post ) );
				if ( ! empty( $result['success'] ) ) {
					$sent++;
				} else {
					$errors[] = sprintf( __( 'محتوا #%d: %s', 'vigent-woo' ), $post->ID, $result['body'] );
				}
			}

			$total = $this->count_items( 'content' );
			$done = ( $offset + count( $posts ) ) >= $total || count( $posts ) < $batch_size;
			return array( 'sent' => $sent, 'errors' => $errors, 'total' => $total, 'done' => $done );
		}

		if ( ! $this->core()->has_wc() ) {
			return array( 'sent' => 0, 'errors' => array( __( 'ووکامرس فعال نیست.', 'vigent-woo' ) ), 'total' => 0, 'done' => true );
		}

		if ( 'products' === $kind ) {
			// Get all matching IDs first (so filtering is consistent).
			$all_ids = wc_get_products( array(
				'status' => array( 'publish', 'private', 'draft' ),
				'limit'  => -1,
				'return' => 'ids',
				'orderby' => 'date',
				'order'   => 'DESC',
			) );

			// Apply filter.
			$filtered = array();
			foreach ( $all_ids as $pid ) {
				$p = wc_get_product( $pid );
				if ( $p && $this->should_sync_product( $p ) ) {
					$filtered[] = $pid;
				}
			}

			$total = count( $filtered );
			$batch = array_slice( $filtered, $offset, $batch_size );

			foreach ( $batch as $pid ) {
				$product = wc_get_product( $pid );
				if ( ! $product ) {
					continue;
				}
				$result = $this->core()->send_event( 'product.created', $this->core()->product_to_payload( $product ) );
				if ( ! empty( $result['success'] ) ) {
					$sent++;
				} else {
					$errors[] = sprintf( __( 'محصول #%d: %s', 'vigent-woo' ), $pid, $result['body'] );
				}
			}

			$done = ( $offset + count( $batch ) ) >= $total;
			return array( 'sent' => $sent, 'errors' => $errors, 'total' => $total, 'done' => $done );
		}

		if ( 'orders' === $kind ) {
			$orders = wc_get_orders( array(
				'limit'   => $batch_size,
				'offset'  => $offset,
				'orderby' => 'date',
				'order'   => 'DESC',
				'return'  => 'objects',
			) );

			foreach ( $orders as $order ) {
				$result = $this->core()->send_event( 'order.created', $this->core()->order_to_payload( $order ) );
				if ( ! empty( $result['success'] ) ) {
					$sent++;
				} else {
					$errors[] = sprintf( __( 'سفارش #%d: %s', 'vigent-woo' ), $order->get_id(), $result['body'] );
				}
			}

			$total = $this->count_items( 'orders' );
			$done = ( $offset + count( $orders ) ) >= $total || count( $orders ) < $batch_size;
			return array( 'sent' => $sent, 'errors' => $errors, 'total' => $total, 'done' => $done );
		}

		return array( 'sent' => 0, 'errors' => array(), 'total' => 0, 'done' => true );
	}

	/**
	 * Process the retry queue — exposed as public for cron.
	 */
	public function process_retry_queue() {
		$this->core()->process_retry_queue();
	}
}
