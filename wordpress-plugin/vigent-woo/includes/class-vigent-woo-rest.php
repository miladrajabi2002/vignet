<?php
/**
 * REST API endpoint for Vigent Woo plugin.
 *
 * Registers /vigent-woo/v1/ping endpoint so the Vigent panel can verify
 * the plugin is installed, active, and reachable from the WordPress side.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_Rest {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	public function register_routes() {
		register_rest_route(
			'vigent-woo/v1',
			'/ping',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_ping' ),
				'permission_callback' => array( $this, 'permission_check' ),
			)
		);

		register_rest_route(
			'vigent-woo/v1',
			'/status',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'handle_status' ),
				'permission_callback' => array( $this, 'permission_check' ),
			)
		);
	}

	/**
	 * Permission check: require the webhook secret as ?token= query param.
	 * This way only the Vigent panel can hit these endpoints.
	 */
	public function permission_check( WP_REST_Request $request ) {
		$token = $request->get_param( 'token' );
		if ( ! $token ) {
			return new WP_Error( 'missing_token', __( 'Token is required.', 'vigent-woo' ), array( 'status' => 401 ) );
		}
		$s = $this->core()->get_settings();
		if ( empty( $s['webhook_secret'] ) ) {
			return new WP_Error( 'not_configured', __( 'Plugin is not configured.', 'vigent-woo' ), array( 'status' => 403 ) );
		}
		if ( ! hash_equals( $s['webhook_secret'], $token ) ) {
			return new WP_Error( 'invalid_token', __( 'Invalid token.', 'vigent-woo' ), array( 'status' => 401 ) );
		}
		return true;
	}

	/**
	 * GET /wp-json/vigent-woo/v1/ping?token=SECRET
	 *
	 * Returns a simple OK + plugin info.
	 */
	public function handle_ping( WP_REST_Request $request ) {
		$core = $this->core();
		return rest_ensure_response( array(
			'ok'             => true,
			'plugin_version' => VIGENT_WOO_VERSION,
			'wordpress'      => get_bloginfo( 'version' ),
			'php'            => PHP_VERSION,
			'has_woocommerce'=> $core->has_wc(),
			'woocommerce'    => $core->has_wc() ? WC()->version : null,
			'hpos'           => $this->is_hpos_enabled(),
			'site_url'       => home_url(),
			'site_name'      => get_bloginfo( 'name' ),
			'timestamp'      => current_time( 'mysql' ),
			'configured'     => $core->is_configured(),
		) );
	}

	/**
	 * GET /wp-json/vigent-woo/v1/status?token=SECRET
	 *
	 * Returns detailed connection + sync status.
	 */
	public function handle_status( WP_REST_Request $request ) {
		$core   = $this->core();
		$status = $core->get_connection_status();
		$queue  = $core->get_retry_queue();

		return rest_ensure_response( array(
			'connection'    => $status,
			'retry_queue'   => array(
				'count' => count( $queue ),
				'items' => array_slice( $queue, 0, 20 ),
			),
			'stats'         => array(
				'products'   => $core->has_wc() ? count( wc_get_products( array( 'limit' => -1, 'return' => 'ids' ) ) ) : 0,
				'orders'     => $core->has_wc() ? wc_orders_count( 'shop_order' ) : 0,
				'posts'      => (int) wp_count_posts( 'post' )->publish,
				'pages'      => (int) wp_count_posts( 'page' )->publish,
			),
			'settings'      => array(
				'sync_products'  => ! empty( $core->get_settings()['sync_products'] ),
				'sync_orders'    => ! empty( $core->get_settings()['sync_orders'] ),
				'sync_content'   => ! empty( $core->get_settings()['sync_content'] ),
				'product_filter' => $core->get_settings()['product_filter'],
			),
			'timestamp'     => current_time( 'mysql' ),
		) );
	}

	private function is_hpos_enabled() {
		if ( ! $this->core()->has_wc() ) return false;
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		}
		return false;
	}
}

Vigent_Woo_Rest::instance();
