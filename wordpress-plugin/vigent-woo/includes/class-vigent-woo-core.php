<?php
/**
 * Core class — settings, webhook sender, retry queue, connection status.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_Core {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {}

	// ─── تنظیمات ─────────────────────────────────────────────────────────

	public function get_settings() {
		$defaults = array(
			'webhook_url'    => '',
			'webhook_secret' => '',
			'sync_products'  => '1',
			'sync_orders'    => '',
			'enable_retry'   => '1',
		);
		$saved = get_option( VIGENT_WOO_OPTION, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		return array_merge( $defaults, $saved );
	}

	public function update_settings( $new ) {
		update_option( VIGENT_WOO_OPTION, $new );
	}

	public function is_configured() {
		$s = $this->get_settings();
		return ! empty( $s['webhook_url'] ) && ! empty( $s['webhook_secret'] );
	}

	public function has_wc() {
		return function_exists( 'wc_get_product' );
	}

	public function sync_products_enabled() {
		$s = $this->get_settings();
		return ! empty( $s['sync_products'] ) && $this->is_configured();
	}

	public function sync_orders_enabled() {
		$s = $this->get_settings();
		return ! empty( $s['sync_orders'] ) && $this->is_configured();
	}

	// ─── ارسال رویداد ────────────────────────────────────────────────────

	public function send_event( $topic, $data, $retry = true ) {
		$s = $this->get_settings();
		if ( empty( $s['webhook_url'] ) || empty( $s['webhook_secret'] ) ) {
			return array( 'code' => 0, 'body' => __( 'تنظیمات کامل نیست.', 'vigent-woo' ), 'success' => false );
		}

		$body = wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
		if ( false === $body ) {
			return array( 'code' => 0, 'body' => __( 'خطا در JSON.', 'vigent-woo' ), 'success' => false );
		}

		$signature = hash_hmac( 'sha256', $body, $s['webhook_secret'] );

		$response = wp_remote_post(
			$s['webhook_url'],
			array(
				'method'      => 'POST',
				'timeout'     => 30,
				'redirection' => 5,
				'headers'     => array(
					'Content-Type'           => 'application/json; charset=utf-8',
					'X-WC-Webhook-Topic'     => $topic,
					'X-WC-Webhook-Signature' => $signature,
				),
				'body'        => $body,
			)
		);

		if ( is_wp_error( $response ) ) {
			if ( $retry && ! empty( $s['enable_retry'] ) ) {
				$this->queue_retry( $topic, $body, $response->get_error_message() );
			}
			return array( 'code' => 0, 'body' => $response->get_error_message(), 'success' => false );
		}

		$code     = (int) wp_remote_retrieve_response_code( $response );
		$resp_body = wp_remote_retrieve_body( $response );
		$success  = $code >= 200 && $code < 300;

		if ( ! $success && $retry && ! empty( $s['enable_retry'] ) ) {
			$this->queue_retry( $topic, $body, "HTTP $code: $resp_body" );
		}

		$this->update_connection_status( $success, $code, $success ? null : $resp_body );

		return array( 'code' => $code, 'body' => $resp_body, 'success' => $success );
	}

	// ─── Connection Status ──────────────────────────────────────────────

	public function update_connection_status( $success, $http_code = 200, $error = null ) {
		$status = array(
			'connected'      => $success,
			'http_code'      => $http_code,
			'error'          => $error,
			'last_check'     => current_time( 'mysql' ),
			'last_check_gmt' => current_time( 'mysql', true ),
		);
		set_transient( 'vigent_woo_status', $status, 6 * HOUR_IN_SECONDS );
		return $status;
	}

	public function get_connection_status() {
		$status = get_transient( 'vigent_woo_status' );
		if ( false === $status || ! is_array( $status ) ) {
			return array(
				'connected'      => null,
				'http_code'      => 0,
				'error'          => null,
				'last_check'     => null,
				'last_check_gmt' => null,
			);
		}
		return $status;
	}

	public function refresh_connection_status() {
		if ( ! $this->is_configured() ) {
			return $this->update_connection_status( false, 0, __( 'پیکربندی نشده', 'vigent-woo' ) );
		}
		$payload = array(
			'test'      => true,
			'site_url'  => home_url(),
			'site_name' => get_bloginfo( 'name' ),
			'timestamp' => current_time( 'mysql' ),
			'has_wc'    => $this->has_wc(),
		);
		$result = $this->send_event( 'test.connection', $payload, false );
		return $this->update_connection_status( $result['success'], (int) $result['code'], $result['success'] ? null : $result['body'] );
	}

	// ─── Retry Queue ────────────────────────────────────────────────────

	public function create_retry_table() {
		if ( false === get_option( 'vigent_woo_retry_queue' ) ) {
			add_option( 'vigent_woo_retry_queue', array() );
		}
	}

	public function queue_retry( $topic, $body, $error ) {
		$queue = get_option( 'vigent_woo_retry_queue', array() );
		if ( ! is_array( $queue ) ) {
			$queue = array();
		}
		if ( count( $queue ) >= 200 ) {
			array_shift( $queue );
		}
		$queue[] = array(
			'id'         => uniqid( 'rt_' ),
			'topic'      => $topic,
			'body'       => $body,
			'error'      => $error,
			'attempts'   => 0,
			'created_at' => current_time( 'mysql' ),
			'next_retry' => gmdate( 'Y-m-d H:i:s', time() + 300 ),
		);
		update_option( 'vigent_woo_retry_queue', $queue );
	}

	public function process_retry_queue() {
		$queue = get_option( 'vigent_woo_retry_queue', array() );
		if ( ! is_array( $queue ) || empty( $queue ) ) {
			return;
		}
		$s = $this->get_settings();
		if ( empty( $s['webhook_url'] ) || empty( $s['webhook_secret'] ) ) {
			return;
		}

		$now       = time();
		$kept      = array();
		$max_age   = 24 * HOUR_IN_SECONDS;
		$max_tries = 5;

		foreach ( $queue as $item ) {
			$age = $now - strtotime( $item['created_at'] );
			if ( $age > $max_age || $item['attempts'] >= $max_tries ) {
				continue;
			}
			$next = strtotime( $item['next_retry'] );
			if ( $next > $now ) {
				$kept[] = $item;
				continue;
			}
			$signature = hash_hmac( 'sha256', $item['body'], $s['webhook_secret'] );
			$response  = wp_remote_post(
				$s['webhook_url'],
				array(
					'method'  => 'POST',
					'timeout' => 30,
					'headers' => array(
						'Content-Type'           => 'application/json; charset=utf-8',
						'X-WC-Webhook-Topic'     => $item['topic'],
						'X-WC-Webhook-Signature' => $signature,
					),
					'body'    => $item['body'],
				)
			);
			$success = false;
			if ( ! is_wp_error( $response ) ) {
				$code    = (int) wp_remote_retrieve_response_code( $response );
				$success = $code >= 200 && $code < 300;
			}
			if ( $success ) {
				continue;
			}
			$item['attempts']++;
			$backoff            = 300 * pow( 2, $item['attempts'] );
			$item['next_retry'] = gmdate( 'Y-m-d H:i:s', $now + $backoff );
			$kept[]             = $item;
		}
		update_option( 'vigent_woo_retry_queue', $kept );
	}

	public function get_retry_queue() {
		$queue = get_option( 'vigent_woo_retry_queue', array() );
		return is_array( $queue ) ? $queue : array();
	}

	public function clear_retry_queue() {
		update_option( 'vigent_woo_retry_queue', array() );
	}

	// ─── Payloads ────────────────────────────────────────────────────────

	public function product_to_payload( $product ) {
		if ( ! $product ) {
			return array();
		}

		$images = array();
		foreach ( $product->get_gallery_image_ids() as $id ) {
			$src = wp_get_attachment_image_url( $id, 'full' );
			if ( $src ) {
				$images[] = array( 'src' => $src );
			}
		}
		$thumb = $product->get_image_id();
		if ( $thumb ) {
			$src = wp_get_attachment_image_url( $thumb, 'full' );
			if ( $src ) {
				array_unshift( $images, array( 'src' => $src ) );
			}
		}

		$attrs = array();
		foreach ( $product->get_attributes() as $key => $value ) {
			$name = wc_attribute_label( $key );
			if ( is_array( $value ) ) {
				$value = implode( ', ', $value );
			}
			$attrs[] = array(
				'name'    => $name,
				'options' => array_map( 'strval', (array) $value ),
			);
		}

		$tags = array();
		$terms = get_the_terms( $product->get_id(), 'product_tag' );
		if ( is_array( $terms ) ) {
			foreach ( $terms as $term ) {
				$tags[] = array( 'name' => $term->name );
			}
		}

		return array(
			'id'                => $product->get_id(),
			'name'              => $product->get_name(),
			'sku'               => $product->get_sku(),
			'description'       => $product->get_description(),
			'short_description' => $product->get_short_description(),
			'price'             => $product->get_price(),
			'regular_price'     => $product->get_regular_price(),
			'sale_price'        => $product->get_sale_price(),
			'status'            => $product->get_status(),
			'manage_stock'      => $product->get_manage_stock(),
			'stock_quantity'    => $product->get_stock_quantity(),
			'in_stock'          => $product->is_in_stock(),
			'images'            => $images,
			'attributes'        => $attrs,
			'tags'              => $tags,
		);
	}

	public function order_to_payload( $order ) {
		if ( ! $order ) {
			return array();
		}

		$line_items = array();
		foreach ( $order->get_items() as $item ) {
			$line_items[] = array(
				'name'     => $item->get_name(),
				'quantity' => $item->get_quantity(),
				'total'    => $item->get_total(),
				'sku'      => $item->get_product() ? $item->get_product()->get_sku() : '',
			);
		}

		$shipping_methods = array();
		foreach ( $order->get_shipping_methods() as $shipping ) {
			$shipping_methods[] = array(
				'method_title' => $shipping->get_method_title(),
			);
		}

		$first_name = method_exists( $order, 'get_billing_first_name' ) ? $order->get_billing_first_name() : '';
		$last_name  = method_exists( $order, 'get_billing_last_name' ) ? $order->get_billing_last_name() : '';
		$phone      = method_exists( $order, 'get_billing_phone' ) ? $order->get_billing_phone() : '';
		$email      = method_exists( $order, 'get_billing_email' ) ? $order->get_billing_email() : '';

		return array(
			'id'                   => $order->get_id(),
			'number'               => $order->get_order_number(),
			'status'               => $order->get_status(),
			'currency'             => $order->get_currency(),
			'total'                => $order->get_total(),
			'customer_id'          => $order->get_customer_id(),
			'payment_method'       => $order->get_payment_method(),
			'payment_method_title' => $order->get_payment_method_title(),
			'date_created'         => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
			'date_created_gmt'     => $order->get_date_created() ? $order->get_date_created()->date( 'Y-m-d\TH:i:s' ) : null,
			'billing'              => array(
				'first_name' => $first_name,
				'last_name'  => $last_name,
				'phone'      => $phone,
				'email'      => $email,
			),
			'shipping'             => ! empty( $shipping_methods ) ? $shipping_methods[0] : array(),
			'line_items'           => $line_items,
		);
	}
}
