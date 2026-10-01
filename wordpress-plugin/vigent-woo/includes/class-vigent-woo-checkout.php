<?php
/**
 * In-chat checkout — turns a cart built in a Vigent conversation into a real
 * WooCommerce order on this site.
 *
 * Flow (no inbound call from Vigent is required):
 *   1. The agent sends the customer a link: https://store/?vigent_checkout=<slug>
 *   2. On click, this class asks Vigent for the cart behind <slug> (outbound,
 *      HMAC-signed with the site's webhook secret — the same direction the
 *      plugin already uses for sync).
 *   3. It creates the order with WooCommerce's own APIs and sends the customer
 *      to the store's own payment page (flow "order_pay"), or fills the store
 *      cart and opens the store's own checkout (flow "cart").
 *   4. Every status change of that order is pushed to Vigent immediately, so
 *      the agent can tell the customer «پرداخت شد» in the same conversation.
 *
 * Prices, stock, shipping and taxes are always computed here by WooCommerce;
 * Vigent never sends a price. Payment happens on the store's own gateways.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_Checkout {

	const QUERY_VAR     = 'vigent_checkout';
	const META_CODE     = '_vigent_cart_code';
	const META_SLUG     = '_vigent_checkout_slug';
	const META_CHANNEL  = '_vigent_channel';
	const META_RETURN   = '_vigent_return_url';
	const META_EXPIRES  = '_vigent_expires_at';
	const META_FLOW     = '_vigent_checkout_flow';
	const MIN_WC        = '7.0';
	const SESSION_ORDER = 'vigent_checkout_orders';
	const SESSION_CART  = 'vigent_checkout_cart';
	const CRON_HOOK     = 'vigent_woo_checkout_expire';
	const CREATED_VIA   = 'vigent';
	const REST_SKEW     = 300;

	private static $instance = null;

	/** Events collected during the request, sent after the response is flushed. */
	private $deferred = array();

	/** The confirmation box is printed once per request (classic hook or block). */
	private $return_box_rendered = false;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'template_redirect', array( $this, 'maybe_handle_link' ), 1 );
		add_action( 'template_redirect', array( $this, 'maybe_resume_after_failed_payment' ), 5 );
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		add_action( 'woocommerce_order_status_changed', array( $this, 'on_status_changed' ), 20, 4 );
		add_filter( 'woocommerce_order_email_verification_required', array( $this, 'skip_email_verification' ), 10, 2 );
		add_action( 'woocommerce_thankyou', array( $this, 'render_return_box' ), 5 );
		// Block themes render the confirmation page without woocommerce_thankyou.
		add_filter( 'render_block_woocommerce/order-confirmation-status', array( $this, 'append_return_box_to_block' ), 10, 1 );
		add_action( 'woocommerce_checkout_order_created', array( $this, 'tag_checkout_order' ), 99 );
		add_action( 'woocommerce_store_api_checkout_order_processed', array( $this, 'tag_checkout_order' ), 99 );
		add_action( 'woocommerce_admin_order_data_after_billing_address', array( $this, 'render_admin_origin' ) );
		add_action( self::CRON_HOOK, array( $this, 'expire_unpaid_orders' ) );
		add_action( 'init', array( $this, 'schedule_cron' ) );
		add_action( 'shutdown', array( $this, 'flush_deferred' ), 0 );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	public function enabled() {
		$s = $this->core()->get_settings();
		return $this->core()->is_configured() && self::wc_supported() && '1' === (string) ( isset( $s['checkout_enabled'] ) ? $s['checkout_enabled'] : '1' );
	}

	/**
	 * In-chat checkout needs WooCommerce 7.0+: order attribution, HPOS-safe
	 * order queries and the Store API checkout hooks do not exist before it.
	 * Older stores keep syncing products and orders; only checkout is off.
	 */
	public static function wc_supported() {
		return defined( 'WC_VERSION' ) && version_compare( WC_VERSION, self::MIN_WC, '>=' );
	}

	public function schedule_cron() {
		if ( $this->enabled() && ! wp_next_scheduled( self::CRON_HOOK ) ) {
			wp_schedule_event( time() + 600, 'hourly', self::CRON_HOOK );
		}
	}

	// ─── Link handler ────────────────────────────────────────────────────────

	public function maybe_handle_link() {
		if ( empty( $_GET[ self::QUERY_VAR ] ) ) {
			return;
		}
		nocache_headers();
		$slug = sanitize_text_field( wp_unslash( $_GET[ self::QUERY_VAR ] ) );
		if ( ! preg_match( '/^[A-Za-z0-9_-]{16,64}$/', $slug ) ) {
			$this->fail_page( __( 'این لینک پرداخت معتبر نیست.', 'vigent-woo' ) );
		}
		if ( ! $this->enabled() ) {
			$this->fail_page( __( 'پرداخت از طریق گفتگو در این فروشگاه غیرفعال است.', 'vigent-woo' ) );
		}

		$existing = $this->find_order( self::META_SLUG, $slug );
		if ( $existing ) {
			$this->resume_order( $existing );
		}

		$lock = 'vigent_co_lock_' . md5( $slug );
		if ( ! $this->acquire_lock( $lock, 30 ) ) {
			// A double tap: the first request is building the order right now.
			// Wait for it (up to ~10s) and send this tab to the same order.
			for ( $wait = 0; $wait < 10; $wait++ ) {
				sleep( 1 );
				// Queries and options are cached per request; the other request
				// writes to the database, so look again with a fresh cache.
				if ( function_exists( 'wp_cache_flush_runtime' ) ) {
					wp_cache_flush_runtime();
				} else {
					wp_cache_delete( $lock, 'options' );
					wp_cache_delete( 'last_changed', 'posts' );
				}
				$existing = $this->find_order( self::META_SLUG, $slug );
				if ( $existing ) {
					$this->resume_order( $existing );
				}
				if ( ! get_option( $lock ) ) {
					break; // The first request finished without an order (cart flow or an error).
				}
			}
			$this->fail_page( __( 'سفارش شما در حال آماده‌سازی است؛ چند ثانیه دیگر دوباره روی لینک بزنید.', 'vigent-woo' ) );
		}

		$cart = $this->fetch_cart( $slug );
		if ( is_wp_error( $cart ) ) {
			$this->release_lock( $lock );
			$this->fail_page( $cart->get_error_message(), $this->safe_return_url( $cart->get_error_data() ) );
		}

		// The same cart may already have an order (e.g. an earlier link).
		$existing = $this->find_order( self::META_CODE, $cart['code'] );
		if ( $existing && ! $existing->has_status( array( 'cancelled', 'failed', 'refunded' ) ) ) {
			$this->release_lock( $lock );
			$this->resume_order( $existing );
		}

		$flow = $this->resolve_flow( $cart );
		if ( 'cart' === $flow ) {
			$result = $this->fill_store_cart( $cart, $slug );
			$this->release_lock( $lock );
			if ( is_wp_error( $result ) ) {
				$this->report_failure( $cart, $result );
				$this->fail_page( $result->get_error_message(), $this->safe_return_url( $cart['return_url'] ?? '' ) );
			}
			wp_safe_redirect( wc_get_checkout_url() );
			exit;
		}

		$order = $this->create_order( $cart, $slug );
		$this->release_lock( $lock );
		if ( is_wp_error( $order ) ) {
			$this->report_failure( $cart, $order );
			$this->fail_page( $order->get_error_message(), $this->safe_return_url( $cart['return_url'] ?? '' ) );
		}
		$this->remember_order_in_session( $order );
		wp_safe_redirect( $order->get_checkout_payment_url() );
		exit;
	}

	/**
	 * Most Iranian gateway plugins leave the order «pending» when a payment
	 * fails and send the customer to the (empty) cart or checkout page. A chat
	 * customer would be stranded there, so once per failed attempt we bring
	 * them back to their order's payment page and tell the conversation.
	 */
	public function maybe_resume_after_failed_payment() {
		if ( ! WC()->session || ! function_exists( 'is_cart' ) || ! ( is_cart() || is_checkout() ) ) {
			return;
		}
		if ( is_wc_endpoint_url( 'order-pay' ) || is_wc_endpoint_url( 'order-received' ) || ! WC()->cart || ! WC()->cart->is_empty() ) {
			return;
		}
		$ids = array_reverse( array_map( 'intval', (array) WC()->session->get( self::SESSION_ORDER, array() ) ) );
		foreach ( $ids as $id ) {
			$order = wc_get_order( $id );
			if ( ! $order || ! $order->get_meta( self::META_CODE ) || ! $order->needs_payment() || ! $order->has_status( array( 'pending', 'failed' ) ) ) {
				continue;
			}
			$modified = $order->get_date_modified();
			$stamp    = $modified ? $modified->getTimestamp() : 0;
			if ( ! $stamp || time() - $stamp > 30 * MINUTE_IN_SECONDS ) {
				continue;
			}
			$seen = (array) WC()->session->get( 'vigent_checkout_resumed', array() );
			if ( isset( $seen[ $id ] ) && (int) $seen[ $id ] === $stamp ) {
				return; // Already brought back for this attempt; let them browse.
			}
			$seen[ $id ] = $stamp;
			WC()->session->set( 'vigent_checkout_resumed', $seen );
			$payload           = $this->checkout_payload( $order );
			$payload['status'] = 'failed';
			$this->defer_event( 'checkout.updated', $payload );
			wc_add_notice( __( 'پرداخت کامل نشد. اگر مبلغی از حسابتان کم شده، بانک آن را برمی‌گرداند. می‌توانید همین حالا دوباره پرداخت کنید.', 'vigent-woo' ), 'error' );
			wp_safe_redirect( $order->get_checkout_payment_url() );
			exit;
		}
	}

	/** Send the customer wherever their order currently stands. */
	private function resume_order( $order ) {
		$this->remember_order_in_session( $order );
		if ( $order->is_paid() || $order->has_status( array( 'on-hold', 'processing', 'completed' ) ) ) {
			wp_safe_redirect( $order->get_checkout_order_received_url() );
			exit;
		}
		if ( $order->has_status( array( 'cancelled', 'refunded' ) ) ) {
			$this->fail_page( __( 'این سفارش لغو شده است. برای خرید دوباره به گفتگو برگردید.', 'vigent-woo' ), $this->safe_return_url( $order->get_meta( self::META_RETURN ) ) );
		}
		wp_safe_redirect( $order->get_checkout_payment_url() );
		exit;
	}

	private function resolve_flow( $cart ) {
		$s       = $this->core()->get_settings();
		$setting = isset( $s['checkout_flow'] ) ? (string) $s['checkout_flow'] : 'auto';
		if ( in_array( $setting, array( 'order_pay', 'cart' ), true ) ) {
			return $setting;
		}
		$requested = isset( $cart['flow'] ) ? (string) $cart['flow'] : '';
		if ( 'cart' === $requested || 'order_pay' === $requested ) {
			return $requested;
		}
		// Automatic: the one-tap payment page, unless the store's checkout form
		// asks for something the chat does not collect (national ID, delivery
		// date, branch…): only the store's own checkout can gather that.
		return $this->custom_required_fields() ? 'cart' : 'order_pay';
	}

	/** Required checkout fields beyond the ones a chat cart carries. */
	private function custom_required_fields() {
		if ( ! function_exists( 'WC' ) || ! WC()->checkout() ) {
			return array();
		}
		$known  = array( 'first_name', 'last_name', 'phone', 'email', 'country', 'state', 'city', 'address_1', 'address_2', 'postcode', 'company' );
		$custom = array();
		foreach ( (array) WC()->checkout()->get_checkout_fields() as $group => $fields ) {
			if ( 'account' === $group || 'shipping' === $group ) {
				continue; // Account fields only matter for sign-up; shipping mirrors billing.
			}
			foreach ( (array) $fields as $key => $field ) {
				$short = preg_replace( '/^(billing|shipping)_/', '', (string) $key );
				if ( ! empty( $field['required'] ) && ! in_array( $short, $known, true ) ) {
					$custom[] = (string) $key;
				}
			}
		}
		return $custom;
	}

	// ─── Talk to Vigent ─────────────────────────────────────────────────────

	private function vigent_origin() {
		$s     = $this->core()->get_settings();
		$parts = wp_parse_url( (string) $s['webhook_url'] );
		if ( empty( $parts['scheme'] ) || empty( $parts['host'] ) ) {
			return '';
		}
		return $parts['scheme'] . '://' . $parts['host'] . ( empty( $parts['port'] ) ? '' : ':' . $parts['port'] );
	}

	/**
	 * Resolve a checkout slug into a cart. Only this site's secret can sign the
	 * request, and Vigent only answers for carts that belong to this site.
	 *
	 * @return array|WP_Error
	 */
	private function fetch_cart( $slug ) {
		$origin = $this->vigent_origin();
		if ( '' === $origin ) {
			return new WP_Error( 'vigent_not_configured', __( 'اتصال فروشگاه به ویجنت کامل نیست.', 'vigent-woo' ) );
		}
		$s    = $this->core()->get_settings();
		$body = wp_json_encode( array( 'slug' => $slug, 'site_url' => untrailingslashit( home_url() ) ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		$ts   = (string) time();
		$resp = wp_remote_post(
			$origin . '/api/commerce/checkout/resolve',
			array(
				'timeout' => 12,
				'headers' => array(
					'Content-Type'            => 'application/json; charset=utf-8',
					'Accept'                  => 'application/json',
					'X-Vigent-Timestamp'      => $ts,
					'X-Vigent-Signature'      => hash_hmac( 'sha256', $ts . '.' . $body, $s['webhook_secret'] ),
					'X-Vigent-Plugin-Version' => VIGENT_WOO_VERSION,
				),
				'body'    => $body,
			)
		);
		if ( is_wp_error( $resp ) ) {
			$this->core()->debug_log( 'checkout RESOLVE_WP_ERROR', array( 'error' => $resp->get_error_message() ) );
			return new WP_Error( 'vigent_unreachable', __( 'ارتباط با ویجنت برقرار نشد؛ چند لحظه دیگر دوباره روی لینک بزنید.', 'vigent-woo' ) );
		}
		$code = (int) wp_remote_retrieve_response_code( $resp );
		$data = json_decode( wp_remote_retrieve_body( $resp ), true );
		if ( 200 !== $code || ! is_array( $data ) || empty( $data['ok'] ) ) {
			$error      = is_array( $data ) && isset( $data['error'] ) ? (string) $data['error'] : 'HTTP_' . $code;
			$return_url = is_array( $data ) && isset( $data['return_url'] ) ? (string) $data['return_url'] : '';
			$this->core()->debug_log( 'checkout RESOLVE_REJECTED', array( 'http' => $code, 'error' => $error ) );
			$messages = array(
				'EXPIRED'   => __( 'مهلت این لینک پرداخت تمام شده است. برای دریافت لینک تازه به گفتگو برگردید.', 'vigent-woo' ),
				'PAID'      => __( 'این سفارش قبلاً پرداخت شده است.', 'vigent-woo' ),
				'CANCELLED' => __( 'این سفارش لغو شده است. برای خرید دوباره به گفتگو برگردید.', 'vigent-woo' ),
				'NOT_FOUND' => __( 'این لینک پرداخت پیدا نشد.', 'vigent-woo' ),
			);
			$message = isset( $messages[ $error ] ) ? $messages[ $error ] : __( 'این لینک پرداخت قابل استفاده نیست.', 'vigent-woo' );
			return new WP_Error( 'vigent_rejected', $message, $return_url );
		}
		$cart = $this->normalize_cart( $data );
		if ( empty( $cart['items'] ) ) {
			return new WP_Error( 'vigent_empty', __( 'سبد این لینک خالی است.', 'vigent-woo' ) );
		}
		return $cart;
	}

	private function normalize_cart( $data ) {
		$items = array();
		foreach ( (array) ( $data['items'] ?? array() ) as $raw ) {
			if ( ! is_array( $raw ) ) {
				continue;
			}
			$pid = absint( $raw['product_id'] ?? 0 );
			$qty = max( 1, min( 999, absint( $raw['quantity'] ?? 1 ) ) );
			if ( ! $pid ) {
				continue;
			}
			$items[] = array(
				'product_id'   => $pid,
				'variation_id' => absint( $raw['variation_id'] ?? 0 ),
				'quantity'     => $qty,
				'name'         => sanitize_text_field( (string) ( $raw['name'] ?? '' ) ),
			);
		}
		$c = is_array( $data['customer'] ?? null ) ? $data['customer'] : array();
		return array(
			'code'             => sanitize_text_field( (string) ( $data['code'] ?? '' ) ),
			'flow'             => sanitize_key( (string) ( $data['flow'] ?? '' ) ),
			'channel'          => sanitize_text_field( (string) ( $data['channel'] ?? '' ) ),
			'return_url'       => esc_url_raw( (string) ( $data['return_url'] ?? '' ) ),
			'expires_at'       => absint( $data['expires_at'] ?? 0 ),
			'items'            => $items,
			'customer'         => array(
				'first_name' => sanitize_text_field( (string) ( $c['first_name'] ?? '' ) ),
				'last_name'  => sanitize_text_field( (string) ( $c['last_name'] ?? '' ) ),
				'phone'      => sanitize_text_field( (string) ( $c['phone'] ?? '' ) ),
				'email'      => sanitize_email( (string) ( $c['email'] ?? '' ) ),
				'province'   => sanitize_text_field( (string) ( $c['province'] ?? '' ) ),
				'city'       => sanitize_text_field( (string) ( $c['city'] ?? '' ) ),
				'address'    => sanitize_textarea_field( (string) ( $c['address'] ?? '' ) ),
				'postcode'   => sanitize_text_field( (string) ( $c['postcode'] ?? '' ) ),
			),
			'shipping_rate_id' => sanitize_text_field( (string) ( $data['shipping_rate_id'] ?? '' ) ),
			'coupons'          => array_values( array_filter( array_map( 'wc_format_coupon_code', (array) ( $data['coupons'] ?? array() ) ) ) ),
			'note'             => sanitize_textarea_field( (string) ( $data['note'] ?? '' ) ),
		);
	}

	private function report_failure( $cart, $error ) {
		$this->defer_event(
			'checkout.failed',
			array(
				'cart_code' => $cart['code'],
				'reason'    => $error->get_error_code(),
				'message'   => $error->get_error_message(),
				'items'     => $error->get_error_data(),
				'site_url'  => untrailingslashit( home_url() ),
			)
		);
	}

	// ─── Order building ─────────────────────────────────────────────────────

	/**
	 * Validate every line against the live catalog.
	 *
	 * @return array{0: array, 1: array} [ valid lines with product objects, unavailable names ]
	 */
	private function validate_items( $items ) {
		$lines       = array();
		$unavailable = array();
		foreach ( $items as $item ) {
			$product = $this->purchasable_product( $item );
			if ( ! $product ) {
				$fallback      = wc_get_product( $item['variation_id'] ? $item['variation_id'] : $item['product_id'] );
				$unavailable[] = $item['name'] ? $item['name'] : ( $fallback ? $fallback->get_name() : '#' . $item['product_id'] );
				continue;
			}
			$lines[] = array( 'product' => $product, 'quantity' => $item['quantity'], 'item' => $item );
		}
		return array( $lines, $unavailable );
	}

	/** The live product for a chat line, or null when it cannot be bought now. */
	private function purchasable_product( $item ) {
		$product = wc_get_product( $item['variation_id'] ? $item['variation_id'] : $item['product_id'] );
		if ( ! $product || 'trash' === $product->get_status() || $product->is_type( 'variable' ) ) {
			return null; // A variable parent cannot be bought without a variation.
		}
		if ( $item['variation_id'] && ( ! $product->is_type( 'variation' ) || (int) $product->get_parent_id() !== (int) $item['product_id'] ) ) {
			return null;
		}
		if ( ! $product->is_purchasable() || ! $product->is_in_stock() || ! $product->has_enough_stock( $item['quantity'] ) ) {
			return null;
		}
		return $product;
	}

	private function unavailable_error( $names ) {
		return new WP_Error(
			'items_unavailable',
			sprintf(
				/* translators: %s: product names */
				__( 'این کالا(ها) الان موجود نیست یا تعدادش کافی نیست: %s. برای اصلاح سبد به گفتگو برگردید.', 'vigent-woo' ),
				implode( '، ', $names )
			),
			$names
		);
	}

	/** @return WC_Order|WP_Error */
	private function create_order( $cart, $slug ) {
		list( $lines, $unavailable ) = $this->validate_items( $cart['items'] );
		if ( $unavailable ) {
			return $this->unavailable_error( $unavailable );
		}
		$address = $this->address_from_cart( $cart['customer'] );

		// Shipping + coupons are priced by WooCommerce's own cart engine so free
		// shipping thresholds, zone rules and coupon limits behave exactly as on
		// the site's checkout.
		$quote = $this->with_isolated_cart(
			$lines,
			$address,
			$cart['coupons'],
			function ( $wc_cart ) {
				return array(
					'rates'   => $this->package_rates(),
					'coupons' => $wc_cart->get_applied_coupons(),
				);
			}
		);

		try {
			$order = wc_create_order( array( 'created_via' => self::CREATED_VIA ) );
			if ( is_wp_error( $order ) ) {
				return $order;
			}
			foreach ( $lines as $line ) {
				$order->add_product( $line['product'], $line['quantity'] );
			}
			$order->set_address( $address, 'billing' );
			$shipping_address = $address;
			unset( $shipping_address['email'] );
			$order->set_address( $shipping_address, 'shipping' );

			$rate = $this->pick_rate( $quote['rates'], $cart['shipping_rate_id'] );
			if ( $rate ) {
				$ship = new WC_Order_Item_Shipping();
				$ship->set_method_title( $rate['label'] );
				$ship->set_method_id( $rate['method_id'] );
				$ship->set_instance_id( $rate['instance_id'] );
				$ship->set_total( $rate['cost'] );
				$order->add_item( $ship );
			}
			if ( $cart['note'] ) {
				$order->set_customer_note( $cart['note'] );
			}
			$order->calculate_totals();
			foreach ( $quote['coupons'] as $code ) {
				$applied = $order->apply_coupon( $code );
				if ( is_wp_error( $applied ) ) {
					$order->add_order_note( sprintf( 'کد تخفیف %s اعمال نشد: %s', $code, $applied->get_error_message() ) );
				}
			}
			$this->tag_order( $order, $cart, $slug, 'order_pay' );
			$order->calculate_totals();
			$order->set_status( 'pending' );
			$order->save();
			$order->add_order_note(
				sprintf(
					/* translators: 1: channel label 2: cart code */
					__( 'سفارش از گفتگوی %1$s در ویجنت ساخته شد (کد %2$s). مشتری به صفحهٔ پرداخت سایت هدایت شد.', 'vigent-woo' ),
					$this->channel_label( $cart['channel'] ),
					$cart['code']
				)
			);
		} catch ( Exception $e ) {
			$this->core()->debug_log( 'checkout CREATE_ORDER_FAILED', array( 'error' => $e->getMessage(), 'code' => $cart['code'] ) );
			return new WP_Error( 'order_failed', __( 'ساخت سفارش با خطا روبه‌رو شد؛ لطفاً دوباره تلاش کنید.', 'vigent-woo' ) );
		}
		$this->defer_event( 'checkout.order_created', $this->checkout_payload( $order ) );
		return $order;
	}

	private function tag_order( $order, $cart, $slug, $flow ) {
		$order->update_meta_data( self::META_CODE, $cart['code'] );
		$order->update_meta_data( self::META_SLUG, $slug );
		$order->update_meta_data( self::META_CHANNEL, $cart['channel'] );
		$order->update_meta_data( self::META_FLOW, $flow );
		if ( $cart['return_url'] ) {
			$order->update_meta_data( self::META_RETURN, $cart['return_url'] );
		}
		if ( $cart['expires_at'] ) {
			$order->update_meta_data( self::META_EXPIRES, (int) $cart['expires_at'] );
		}
		// WooCommerce Order Attribution: shows «vigent / instagram» in the
		// store's own reports next to organic and campaign sales.
		$order->update_meta_data( '_wc_order_attribution_source_type', 'utm' );
		$order->update_meta_data( '_wc_order_attribution_utm_source', 'vigent' );
		$order->update_meta_data( '_wc_order_attribution_utm_medium', strtolower( $cart['channel'] ? $cart['channel'] : 'chat' ) );
		$order->update_meta_data( '_wc_order_attribution_utm_campaign', 'chat-checkout' );
	}

	/** WooCommerce address array from the cart's customer block. */
	private function address_from_cart( $c ) {
		$first = $c['first_name'];
		$last  = $c['last_name'];
		if ( '' === $last && false !== strpos( $first, ' ' ) ) {
			$parts = preg_split( '/\s+/u', $first, 2 );
			$first = $parts[0];
			$last  = $parts[1];
		}
		$state = $this->resolve_state( $c['province'], $c['city'] );
		return array(
			'first_name' => $first,
			'last_name'  => $last,
			'phone'      => $c['phone'],
			'email'      => $c['email'],
			'country'    => 'IR',
			'state'      => $state,
			'city'       => $this->resolve_city( $state, $c['city'] ),
			'address_1'  => $c['address'],
			'address_2'  => '',
			'postcode'   => $c['postcode'],
		);
	}

	private static function normalize_fa( $value ) {
		$value = str_replace( array( 'ي', 'ك', '‌', 'ـ' ), array( 'ی', 'ک', ' ', '' ), (string) $value );
		$value = preg_replace( '/^(?:استان|شهر)\s+/u', '', trim( $value ) );
		return preg_replace( '/\s+/u', ' ', $value );
	}

	/**
	 * Map a province/city name to this store's WooCommerce state code. Store
	 * localisations spell states differently, so the match runs against the
	 * store's own list; a compact capital→province table covers bare city names.
	 */
	public function resolve_state( $province, $city ) {
		$states = WC()->countries->get_states( 'IR' );
		if ( ! is_array( $states ) || empty( $states ) ) {
			return '';
		}
		$by_name = array();
		foreach ( $states as $code => $name ) {
			$by_name[ self::normalize_fa( $name ) ] = $code;
		}
		$capitals = array(
			'کرج' => 'البرز', 'شیراز' => 'فارس', 'مشهد' => 'خراسان رضوی', 'تبریز' => 'آذربایجان شرقی',
			'اهواز' => 'خوزستان', 'رشت' => 'گیلان', 'ارومیه' => 'آذربایجان غربی', 'زاهدان' => 'سیستان و بلوچستان',
			'اراک' => 'مرکزی', 'ساری' => 'مازندران', 'بندرعباس' => 'هرمزگان', 'سنندج' => 'کردستان',
			'گرگان' => 'گلستان', 'خرم آباد' => 'لرستان', 'خرم‌آباد' => 'لرستان', 'بیرجند' => 'خراسان جنوبی',
			'بجنورد' => 'خراسان شمالی', 'یاسوج' => 'کهگیلویه و بویراحمد', 'شهرکرد' => 'چهارمحال و بختیاری',
			'اسلامشهر' => 'تهران', 'شهریار' => 'تهران', 'ری' => 'تهران', 'پردیس' => 'تهران', 'کاشان' => 'اصفهان',
			'نیشابور' => 'خراسان رضوی', 'دزفول' => 'خوزستان', 'بابل' => 'مازندران', 'آمل' => 'مازندران',
		);
		$candidates = array( self::normalize_fa( $province ), self::normalize_fa( $city ) );
		$capital    = self::normalize_fa( $city );
		if ( isset( $capitals[ $capital ] ) ) {
			$candidates[] = self::normalize_fa( $capitals[ $capital ] );
		}
		foreach ( $candidates as $candidate ) {
			if ( '' === $candidate ) {
				continue;
			}
			if ( isset( $by_name[ $candidate ] ) ) {
				return $by_name[ $candidate ];
			}
			foreach ( $by_name as $name => $code ) {
				if ( '' !== $name && ( 0 === strpos( $name, $candidate ) || 0 === strpos( $candidate, $name ) ) ) {
					return $code;
				}
			}
		}
		return '';
	}

	/**
	 * Persian WooCommerce Shipping (PWS) stores provinces AND cities as
	 * `state_city` terms and expects the term id in the city field; its rates
	 * are matched on those ids. Other stores keep the plain city name.
	 */
	public function resolve_city( $state, $city ) {
		$city = (string) $city;
		if ( '' === $city || ! ctype_digit( (string) $state ) || ! taxonomy_exists( 'state_city' ) ) {
			return $city;
		}
		$wanted   = self::normalize_fa( $city );
		$children = get_terms(
			array(
				'taxonomy'   => 'state_city',
				'hide_empty' => false,
				'parent'     => (int) $state,
			)
		);
		if ( is_wp_error( $children ) ) {
			return $city;
		}
		foreach ( $children as $term ) {
			if ( self::normalize_fa( $term->name ) === $wanted ) {
				return (string) $term->term_id;
			}
		}
		return $city;
	}

	/**
	 * Run $callback with WooCommerce's cart temporarily holding exactly the
	 * chat cart, then restore whatever the visitor had before (their own site
	 * cart must not be lost by opening a chat payment link).
	 */
	private function with_isolated_cart( $lines, $address, $coupons, $callback ) {
		if ( function_exists( 'wc_load_cart' ) && ( null === WC()->cart || null === WC()->session ) ) {
			wc_load_cart();
		}
		$cart      = WC()->cart;
		$customer  = WC()->customer;
		$backup    = array(
			'contents' => $cart->get_cart_contents(),
			'coupons'  => $cart->get_applied_coupons(),
			'chosen'   => WC()->session ? WC()->session->get( 'chosen_shipping_methods' ) : null,
			'address'  => $customer->get_shipping_address_1(),
			'location' => array(
				$customer->get_shipping_country(), $customer->get_shipping_state(), $customer->get_shipping_postcode(), $customer->get_shipping_city(),
				$customer->get_billing_country(), $customer->get_billing_state(), $customer->get_billing_postcode(), $customer->get_billing_city(),
			),
		);
		try {
			$cart->set_cart_contents( array() );
			$cart->set_applied_coupons( array() );
			foreach ( $lines as $line ) {
				$product = $line['product'];
				if ( $product->is_type( 'variation' ) ) {
					$cart->add_to_cart( $product->get_parent_id(), $line['quantity'], $product->get_id(), $product->get_variation_attributes() );
				} else {
					$cart->add_to_cart( $product->get_id(), $line['quantity'] );
				}
			}
			$customer->set_shipping_location( $address['country'], $address['state'], $address['postcode'], $address['city'] );
			$customer->set_billing_location( $address['country'], $address['state'], $address['postcode'], $address['city'] );
			$customer->set_shipping_address_1( $address['address_1'] );
			foreach ( $coupons as $code ) {
				$cart->apply_coupon( $code );
			}
			$cart->calculate_totals();
			$result = call_user_func( $callback, $cart );
		} finally {
			$cart->set_cart_contents( $backup['contents'] );
			$cart->set_applied_coupons( $backup['coupons'] );
			if ( WC()->session ) {
				WC()->session->set( 'chosen_shipping_methods', $backup['chosen'] );
			}
			list( $sc, $ss, $sp, $sct, $bc, $bs, $bp, $bct ) = $backup['location'];
			$customer->set_shipping_location( $sc, $ss, $sp, $sct );
			$customer->set_billing_location( $bc, $bs, $bp, $bct );
			$customer->set_shipping_address_1( $backup['address'] );
			$cart->calculate_totals();
			wc_clear_notices();
		}
		return $result;
	}

	/** Rates of the first shipping package the cart engine just computed. */
	private function package_rates() {
		$rates = array();
		foreach ( WC()->shipping()->get_packages() as $package ) {
			foreach ( (array) ( $package['rates'] ?? array() ) as $rate_id => $rate ) {
				$rates[] = array(
					'id'          => (string) $rate_id,
					'label'       => $rate->get_label(),
					'method_id'   => $rate->get_method_id(),
					'instance_id' => (int) $rate->get_instance_id(),
					'cost'        => (float) $rate->get_cost(),
				);
			}
			break;
		}
		return $rates;
	}

	private function pick_rate( $rates, $wanted ) {
		if ( empty( $rates ) ) {
			return null;
		}
		if ( $wanted ) {
			foreach ( $rates as $rate ) {
				if ( $rate['id'] === $wanted ) {
					return $rate;
				}
			}
		}
		usort(
			$rates,
			function ( $a, $b ) {
				return $a['cost'] <=> $b['cost'];
			}
		);
		return $rates[0];
	}

	/** Flow «cart»: the store's own checkout does the rest. @return true|WP_Error */
	private function fill_store_cart( $cart, $slug ) {
		list( $lines, $unavailable ) = $this->validate_items( $cart['items'] );
		if ( $unavailable ) {
			return $this->unavailable_error( $unavailable );
		}
		if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
			wc_load_cart();
		}
		WC()->session->set_customer_session_cookie( true );
		WC()->cart->empty_cart( false );
		foreach ( $lines as $line ) {
			$product = $line['product'];
			if ( $product->is_type( 'variation' ) ) {
				WC()->cart->add_to_cart( $product->get_parent_id(), $line['quantity'], $product->get_id(), $product->get_variation_attributes() );
			} else {
				WC()->cart->add_to_cart( $product->get_id(), $line['quantity'] );
			}
		}
		foreach ( $cart['coupons'] as $code ) {
			WC()->cart->apply_coupon( $code );
		}
		$address  = $this->address_from_cart( $cart['customer'] );
		// Block checkout renders the city as free text: a PWS city term id
		// would show up as «147». Classic checkout (PWS select) keeps the id.
		$checkout_page = wc_get_page_id( 'checkout' );
		if ( $checkout_page > 0 && function_exists( 'has_block' ) && has_block( 'woocommerce/checkout', $checkout_page ) ) {
			$address['city'] = $cart['customer']['city'];
		}
		$customer = WC()->customer;
		foreach ( array( 'first_name', 'last_name', 'phone', 'email', 'country', 'state', 'city', 'address_1', 'postcode' ) as $field ) {
			if ( '' === (string) $address[ $field ] ) {
				continue;
			}
			$setter = 'set_billing_' . $field;
			if ( is_callable( array( $customer, $setter ) ) ) {
				$customer->{$setter}( $address[ $field ] );
			}
			$setter = 'set_shipping_' . $field;
			if ( 'email' !== $field && is_callable( array( $customer, $setter ) ) ) {
				$customer->{$setter}( $address[ $field ] );
			}
		}
		$customer->save();
		if ( $cart['shipping_rate_id'] ) {
			WC()->session->set( 'chosen_shipping_methods', array( $cart['shipping_rate_id'] ) );
		}
		WC()->session->set(
			self::SESSION_CART,
			array(
				'code'       => $cart['code'],
				'slug'       => $slug,
				'channel'    => $cart['channel'],
				'return_url' => $cart['return_url'],
				'expires_at' => $cart['expires_at'],
			)
		);
		WC()->cart->calculate_totals();
		wc_clear_notices();
		return true;
	}

	/** Flow «cart»: attach the conversation to the order the checkout created. */
	public function tag_checkout_order( $order ) {
		if ( ! $order instanceof WC_Order || ! WC()->session ) {
			return;
		}
		$pending = WC()->session->get( self::SESSION_CART );
		if ( ! is_array( $pending ) || empty( $pending['code'] ) ) {
			return;
		}
		$this->tag_order(
			$order,
			array(
				'code'       => (string) $pending['code'],
				'channel'    => (string) $pending['channel'],
				'return_url' => (string) $pending['return_url'],
				'expires_at' => (int) $pending['expires_at'],
			),
			(string) $pending['slug'],
			'cart'
		);
		$order->save();
		WC()->session->set( self::SESSION_CART, null );
		$this->remember_order_in_session( $order );
		$this->defer_event( 'checkout.order_created', $this->checkout_payload( $order ) );
	}

	// ─── Session / guest access ─────────────────────────────────────────────

	private function remember_order_in_session( $order ) {
		if ( ! WC()->session ) {
			return;
		}
		WC()->session->set_customer_session_cookie( true );
		$ids   = (array) WC()->session->get( self::SESSION_ORDER, array() );
		$ids[] = (int) $order->get_id();
		WC()->session->set( self::SESSION_ORDER, array_slice( array_values( array_unique( array_map( 'intval', $ids ) ) ), -10 ) );
	}

	/**
	 * Guest orders with an e-mail ask for that e-mail after 10 minutes. A
	 * customer who arrived through the signed chat link in this browser has
	 * already proven possession of the link, so we skip that prompt for them.
	 */
	public function skip_email_verification( $required, $order ) {
		if ( ! $required || ! $order instanceof WC_Order || ! $order->get_meta( self::META_CODE ) || ! WC()->session ) {
			return $required;
		}
		$ids = (array) WC()->session->get( self::SESSION_ORDER, array() );
		return in_array( (int) $order->get_id(), array_map( 'intval', $ids ), true ) ? false : $required;
	}

	// ─── Status events ──────────────────────────────────────────────────────

	public function on_status_changed( $order_id, $from, $to, $order = null ) {
		$order = $order instanceof WC_Order ? $order : wc_get_order( $order_id );
		if ( ! $order || ! $order->get_meta( self::META_CODE ) ) {
			return;
		}
		$payload         = $this->checkout_payload( $order );
		$payload['from'] = (string) $from;
		$this->defer_event( 'checkout.updated', $payload );
	}

	public function checkout_payload( $order ) {
		$paid = $order->get_date_paid();
		return array(
			'cart_code'            => (string) $order->get_meta( self::META_CODE ),
			'slug'                 => (string) $order->get_meta( self::META_SLUG ),
			'flow'                 => (string) $order->get_meta( self::META_FLOW ),
			'order_id'             => (int) $order->get_id(),
			'order_number'         => (string) $order->get_order_number(),
			'status'               => (string) $order->get_status(),
			'paid'                 => (bool) $order->is_paid(),
			'total'                => (float) $order->get_total(),
			'shipping_total'       => (float) $order->get_shipping_total(),
			'discount_total'       => (float) $order->get_discount_total(),
			'currency'             => (string) $order->get_currency(),
			'payment_method'       => (string) $order->get_payment_method(),
			'payment_method_title' => (string) $order->get_payment_method_title(),
			'transaction_id'       => (string) $order->get_transaction_id(),
			'date_paid'            => $paid ? gmdate( 'c', $paid->getTimestamp() ) : null,
			'payment_url'          => $order->needs_payment() ? $order->get_checkout_payment_url() : '',
			'site_url'             => untrailingslashit( home_url() ),
		);
	}

	private function defer_event( $topic, $data ) {
		$this->deferred[] = array( $topic, $data );
	}

	/**
	 * Send collected events after the customer's response is flushed, so a
	 * slow network to Vigent never delays the redirect to the payment page.
	 * Failures fall back to the plugin's existing retry queue.
	 */
	public function flush_deferred() {
		if ( empty( $this->deferred ) || ! $this->core()->is_configured() ) {
			return;
		}
		$events         = $this->deferred;
		$this->deferred = array();
		if ( function_exists( 'fastcgi_finish_request' ) && ! ( defined( 'WP_CLI' ) && WP_CLI ) && ! ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			fastcgi_finish_request();
		}
		foreach ( $events as $event ) {
			$this->core()->send_event( $event[0], $event[1], true );
		}
	}

	/** Cancel unpaid chat orders whose link has expired. */
	public function expire_unpaid_orders() {
		if ( ! $this->core()->has_wc() ) {
			return;
		}
		// Filtered in PHP: chat orders waiting for payment are few, and a
		// numeric meta comparison is not portable across order storages.
		$orders = wc_get_orders(
			array(
				'status'      => array( 'pending' ),
				'created_via' => self::CREATED_VIA,
				'limit'       => 200,
				'orderby'     => 'date',
				'order'       => 'ASC',
			)
		);
		$now = time();
		foreach ( $orders as $order ) {
			$expires = (int) $order->get_meta( self::META_EXPIRES );
			if ( $expires > 0 && $expires < $now && $order->get_meta( self::META_CODE ) ) {
				$order->update_status( 'cancelled', __( 'مهلت لینک پرداخت ویجنت تمام شد و سفارش پرداخت‌نشده لغو شد.', 'vigent-woo' ) );
			}
		}
		// Let the send happen inside the cron request.
		$this->flush_deferred();
	}

	// ─── Pages ──────────────────────────────────────────────────────────────

	private function channel_label( $channel ) {
		$labels = array(
			'INSTAGRAM'  => 'اینستاگرام',
			'TELEGRAM'   => 'تلگرام',
			'BALE'       => 'بله',
			'RUBIKA'     => 'روبیکا',
			'WHATSAPP'   => 'واتساپ',
			'WEB_WIDGET' => 'چت سایت',
			'CHAT_LINK'  => 'لینک گفتگو',
			'API'        => 'API',
		);
		return isset( $labels[ $channel ] ) ? $labels[ $channel ] : 'ویجنت';
	}

	private function safe_return_url( $url ) {
		$url = is_string( $url ) ? esc_url_raw( $url ) : '';
		return ( '' !== $url && 0 === strpos( $url, 'https://' ) ) ? $url : '';
	}

	private function fail_page( $message, $return_url = '' ) {
		$links = '';
		if ( $return_url ) {
			$links .= '<a class="button" style="margin-left:8px" href="' . esc_url( $return_url ) . '">' . esc_html__( 'بازگشت به گفتگو', 'vigent-woo' ) . '</a>';
		}
		$shop   = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/' );
		$links .= '<a class="button" href="' . esc_url( $shop ) . '">' . esc_html__( 'رفتن به فروشگاه', 'vigent-woo' ) . '</a>';
		wp_die(
			'<div dir="rtl" style="text-align:right;line-height:2"><h1 style="font-size:20px">' . esc_html__( 'پرداخت از گفتگو', 'vigent-woo' ) . '</h1><p>' . esc_html( $message ) . '</p><p>' . $links . '</p></div>',
			esc_html__( 'پرداخت از گفتگو', 'vigent-woo' ),
			array( 'response' => 200, 'back_link' => false )
		);
	}

	public function append_return_box_to_block( $content ) {
		$order_id = absint( get_query_var( 'order-received' ) );
		$key      = isset( $_GET['key'] ) ? wc_clean( wp_unslash( $_GET['key'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$order    = $order_id ? wc_get_order( $order_id ) : null;
		if ( ! $order || '' === $key || ! hash_equals( $order->get_order_key(), $key ) ) {
			return $content;
		}
		ob_start();
		$this->render_return_box( $order_id );
		return $content . ob_get_clean();
	}

	public function render_return_box( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $this->return_box_rendered || ! $order || ! $order->get_meta( self::META_CODE ) ) {
			return;
		}
		$this->return_box_rendered = true;
		$return  = $this->safe_return_url( $order->get_meta( self::META_RETURN ) );
		$channel = $this->channel_label( (string) $order->get_meta( self::META_CHANNEL ) );
		// Cash on delivery / bank transfer orders are «processing» without money.
		$paid    = $order->is_paid() && ! in_array( $order->get_payment_method(), array( 'cod', 'bacs', 'cheque' ), true );
		echo '<div class="vigent-return" dir="rtl" style="border:1px solid #d7e3d9;background:#f3faf5;border-radius:12px;padding:16px 18px;margin:0 0 24px;line-height:1.9">';
		echo '<strong style="display:block;font-size:16px;margin-bottom:4px">' . ( $paid ? esc_html__( 'سفارش شما پرداخت و ثبت شد ✓', 'vigent-woo' ) : esc_html__( 'سفارش شما ثبت شد', 'vigent-woo' ) ) . '</strong>';
		echo '<span>' . esc_html__( 'تأیید سفارش در همان گفتگو هم برایتان فرستاده می‌شود.', 'vigent-woo' ) . '</span>';
		if ( $return ) {
			$in_app = in_array( (string) $order->get_meta( self::META_CHANNEL ), array( 'INSTAGRAM', 'TELEGRAM', 'BALE', 'RUBIKA' ), true );
			$label  = $in_app
				? sprintf( /* translators: %s: app name */ __( 'بازگشت به گفتگو در %s', 'vigent-woo' ), $channel )
				: __( 'بازگشت به گفتگو', 'vigent-woo' );
			echo '<p style="margin:12px 0 0"><a class="button" href="' . esc_url( $return ) . '">' . esc_html( $label ) . '</a></p>';
		}
		echo '</div>';
	}

	public function render_admin_origin( $order ) {
		if ( ! $order instanceof WC_Order || ! $order->get_meta( self::META_CODE ) ) {
			return;
		}
		echo '<p><strong>' . esc_html__( 'ثبت‌شده از گفتگو:', 'vigent-woo' ) . '</strong> ' . esc_html( $this->channel_label( (string) $order->get_meta( self::META_CHANNEL ) ) ) . ' — ' . esc_html__( 'کد', 'vigent-woo' ) . ' ' . esc_html( (string) $order->get_meta( self::META_CODE ) ) . '</p>';
	}

	// ─── Lookup / locks ─────────────────────────────────────────────────────

	/**
	 * Latest order carrying this Vigent meta value. meta_key/meta_value work on
	 * both HPOS and legacy post storage (the legacy store silently ignores
	 * `meta_query` and would return unrelated orders), and the value is
	 * re-checked on the result so a store that ignores the filter can never
	 * resume someone else's order.
	 */
	private function find_order( $meta_key, $value ) {
		if ( '' === (string) $value ) {
			return null;
		}
		$orders = wc_get_orders(
			array(
				'limit'      => 5,
				'status'     => array_keys( wc_get_order_statuses() ),
				'orderby'    => 'date',
				'order'      => 'DESC',
				'meta_key'   => $meta_key, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value' => (string) $value, // phpcs:ignore WordPress.DB.SlowDBQuery
			)
		);
		foreach ( $orders as $order ) {
			if ( $order instanceof WC_Order && (string) $order->get_meta( $meta_key ) === (string) $value ) {
				return $order;
			}
		}
		return null;
	}

	private function acquire_lock( $option, $ttl ) {
		$now = time();
		for ( $attempt = 0; $attempt < 3; $attempt++ ) {
			if ( add_option( $option, $now, '', 'no' ) ) {
				return true;
			}
			$created = (int) get_option( $option, 0 );
			if ( ! $created || ( $now - $created ) > $ttl ) {
				delete_option( $option );
				continue;
			}
			return false;
		}
		return false;
	}

	private function release_lock( $option ) {
		delete_option( $option );
	}

	// ─── Signed REST API (Vigent → store; optional, used for live quotes) ───

	public function register_routes() {
		$routes = array(
			'/checkout/quote'        => 'rest_quote',
			'/checkout/status'       => 'rest_status',
			'/checkout/cancel'       => 'rest_cancel',
			'/checkout/capabilities' => 'rest_capabilities',
		);
		foreach ( $routes as $route => $callback ) {
			register_rest_route(
				'vigent-woo/v1',
				$route,
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, $callback ),
					'permission_callback' => array( $this, 'verify_signature' ),
				)
			);
		}
	}

	public function verify_signature( WP_REST_Request $request ) {
		if ( ! $this->enabled() ) {
			return new WP_Error( 'vigent_checkout_disabled', 'Checkout is disabled.', array( 'status' => 403 ) );
		}
		$ts  = (string) $request->get_header( 'x_vigent_timestamp' );
		$sig = (string) $request->get_header( 'x_vigent_signature' );
		if ( ! ctype_digit( $ts ) || abs( time() - (int) $ts ) > self::REST_SKEW || '' === $sig ) {
			return new WP_Error( 'vigent_bad_signature', 'Bad signature.', array( 'status' => 401 ) );
		}
		$s        = $this->core()->get_settings();
		$expected = hash_hmac( 'sha256', $ts . '.' . $request->get_body(), (string) $s['webhook_secret'] );
		return hash_equals( $expected, $sig ) ? true : new WP_Error( 'vigent_bad_signature', 'Bad signature.', array( 'status' => 401 ) );
	}

	/** Live price/shipping/coupon/gateway quote for a chat cart. */
	public function rest_quote( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		$cart = $this->normalize_cart( is_array( $body ) ? $body : array() );
		list( $lines, $unavailable ) = $this->validate_items( $cart['items'] );
		$address                     = $this->address_from_cart( $cart['customer'] );
		$items_out                   = array();
		foreach ( $cart['items'] as $item ) {
			$product     = wc_get_product( $item['variation_id'] ? $item['variation_id'] : $item['product_id'] );
			$items_out[] = array(
				'product_id'   => $item['product_id'],
				'variation_id' => $item['variation_id'],
				'quantity'     => $item['quantity'],
				'name'         => $product ? $product->get_name() : $item['name'],
				'unit_price'   => $product ? (float) wc_get_price_to_display( $product ) : null,
				'available'    => null !== $this->purchasable_product( $item ),
				'stock'        => $product && $product->managing_stock() ? (int) $product->get_stock_quantity() : null,
			);
		}
		if ( empty( $lines ) ) {
			return rest_ensure_response( array( 'ok' => true, 'items' => $items_out, 'unavailable' => $unavailable, 'rates' => array(), 'gateways' => array() ) );
		}
		$quote = $this->with_isolated_cart(
			$lines,
			$address,
			$cart['coupons'],
			function ( $wc_cart ) {
				$totals   = $wc_cart->get_totals();
				$gateways = array();
				foreach ( WC()->payment_gateways()->get_available_payment_gateways() as $gateway ) {
					$gateways[] = array( 'id' => $gateway->id, 'title' => wp_strip_all_tags( $gateway->get_title() ) );
				}
				$rejected = array();
				foreach ( wc_get_notices( 'error' ) as $notice ) {
					$rejected[] = wp_strip_all_tags( is_array( $notice ) ? $notice['notice'] : (string) $notice );
				}
				return array(
					'subtotal'        => (float) $totals['subtotal'],
					'discount_total'  => (float) $totals['discount_total'],
					'rates'           => $this->package_rates(),
					'applied_coupons' => $wc_cart->get_applied_coupons(),
					'coupon_errors'   => $rejected,
					'gateways'        => $gateways,
				);
			}
		);
		$rate = $this->pick_rate( $quote['rates'], $cart['shipping_rate_id'] );
		return rest_ensure_response(
			array(
				'ok'              => true,
				'currency'        => get_woocommerce_currency(),
				'items'           => $items_out,
				'unavailable'     => $unavailable,
				'state'           => $address['state'],
				'subtotal'        => $quote['subtotal'],
				'discount_total'  => $quote['discount_total'],
				'rates'           => $quote['rates'],
				'chosen_rate'     => $rate,
				'total'           => max( 0, $quote['subtotal'] - $quote['discount_total'] + ( $rate ? $rate['cost'] : 0 ) ),
				'applied_coupons' => $quote['applied_coupons'],
				'coupon_errors'   => $quote['coupon_errors'],
				'gateways'        => $quote['gateways'],
			)
		);
	}

	public function rest_status( WP_REST_Request $request ) {
		$code  = sanitize_text_field( (string) $request->get_param( 'code' ) );
		$order = $this->find_order( self::META_CODE, $code );
		if ( ! $order ) {
			return rest_ensure_response( array( 'ok' => true, 'found' => false ) );
		}
		return rest_ensure_response( array_merge( array( 'ok' => true, 'found' => true ), $this->checkout_payload( $order ) ) );
	}

	public function rest_cancel( WP_REST_Request $request ) {
		$code  = sanitize_text_field( (string) $request->get_param( 'code' ) );
		$order = $this->find_order( self::META_CODE, $code );
		if ( $order && $order->has_status( array( 'pending', 'failed' ) ) ) {
			$order->update_status( 'cancelled', __( 'مشتری سفارش را در گفتگوی ویجنت لغو کرد.', 'vigent-woo' ) );
		}
		return rest_ensure_response( array( 'ok' => true, 'found' => (bool) $order, 'status' => $order ? $order->get_status() : null ) );
	}

	public function rest_capabilities( WP_REST_Request $request ) {
		$gateways = array();
		foreach ( WC()->payment_gateways()->payment_gateways() as $gateway ) {
			if ( 'yes' === $gateway->enabled ) {
				$gateways[] = array( 'id' => $gateway->id, 'title' => wp_strip_all_tags( $gateway->get_title() ) );
			}
		}
		$zones = array();
		foreach ( WC_Shipping_Zones::get_zones() as $zone ) {
			$methods = array();
			foreach ( $zone['shipping_methods'] as $method ) {
				if ( 'yes' !== $method->enabled ) {
					continue;
				}
				$methods[] = array(
					'id'         => $method->id . ':' . $method->instance_id,
					'title'      => $method->get_title(),
					'cost'       => isset( $method->cost ) ? (string) $method->cost : null,
					'min_amount' => isset( $method->min_amount ) ? (string) $method->min_amount : null,
				);
			}
			$zones[] = array( 'name' => $zone['zone_name'], 'methods' => $methods );
		}
		$checkout_page = wc_get_page_id( 'checkout' );
		$s             = $this->core()->get_settings();
		return rest_ensure_response(
			array(
				'ok'             => true,
				'plugin_version' => VIGENT_WOO_VERSION,
				'wc_version'     => defined( 'WC_VERSION' ) ? WC_VERSION : '',
				'currency'       => get_woocommerce_currency(),
				'gateways'       => $gateways,
				'shipping_zones' => $zones,
				'block_checkout' => $checkout_page > 0 && function_exists( 'has_block' ) && has_block( 'woocommerce/checkout', $checkout_page ),
				'terms_required' => wc_terms_and_conditions_page_id() > 0,
				'hpos'           => class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) && \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled(),
				'flow_setting'   => isset( $s['checkout_flow'] ) ? $s['checkout_flow'] : 'auto',
				'custom_fields'  => $this->custom_required_fields(),
			)
		);
	}
}
