<?php
/**
 * Public, one-time pairing challenge used to prove control of this site, and
 * the signed route Vigent calls to ask for a catalog resend.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_REST {
	/** Release this file shipped in; vigent-woo.php will not boot a mix of releases. */
	const RELEASE = '5.2.2';

	const SIGNATURE_SKEW = 300;

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

	public function register_routes() {
		register_rest_route(
			'vigent-woo/v1',
			'/pairing-challenge',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'verify_pairing_challenge' ),
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'vigent-woo/v1',
			'/sync/resync',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'request_resync' ),
				'permission_callback' => array( $this, 'verify_signature' ),
			)
		);
	}

	/** Same HMAC scheme as the checkout routes: sha256( "<timestamp>.<body>", webhook secret ). */
	public function verify_signature( WP_REST_Request $request ) {
		$ts  = (string) $request->get_header( 'x_vigent_timestamp' );
		$sig = (string) $request->get_header( 'x_vigent_signature' );
		$s   = Vigent_Woo_Core::instance()->get_settings();
		if ( empty( $s['webhook_secret'] ) || ! ctype_digit( $ts ) || abs( time() - (int) $ts ) > self::SIGNATURE_SKEW || '' === $sig ) {
			return new WP_Error( 'vigent_bad_signature', 'Bad signature.', array( 'status' => 401 ) );
		}
		$expected = hash_hmac( 'sha256', $ts . '.' . $request->get_body(), (string) $s['webhook_secret'] );
		return hash_equals( $expected, $sig ) ? true : new WP_Error( 'vigent_bad_signature', 'Bad signature.', array( 'status' => 401 ) );
	}

	/** Vigent has room for products it refused earlier; push the catalog again in the background. */
	public function request_resync( WP_REST_Request $request ) {
		$body  = $request->get_json_params();
		$kinds = is_array( $body ) && isset( $body['kinds'] ) && is_array( $body['kinds'] ) ? $body['kinds'] : array( 'products' );
		$scheduled = in_array( 'products', $kinds, true ) && class_exists( 'Vigent_Woo_Sync' )
			? Vigent_Woo_Sync::instance()->request_product_resync( 'panel' )
			: false;
		return rest_ensure_response( array( 'ok' => true, 'scheduled' => (bool) $scheduled ) );
	}

	public function verify_pairing_challenge( WP_REST_Request $request ) {
		$body  = $request->get_json_params();
		$nonce = is_array( $body ) && isset( $body['nonce'] ) ? (string) $body['nonce'] : '';
		$saved = get_transient( 'vigent_woo_pairing_challenge' );

		if (
			'' === $nonce ||
			! is_array( $saved ) ||
			empty( $saved['hash'] ) ||
			! hash_equals( (string) $saved['hash'], hash( 'sha256', $nonce ) )
		) {
			return new WP_Error(
				'vigent_pairing_forbidden',
				__( 'درخواست اتصال معتبر نیست.', 'vigent-woo' ),
				array( 'status' => 403 )
			);
		}

		// Consume immediately: the same proof can never be replayed.
		delete_transient( 'vigent_woo_pairing_challenge' );
		return rest_ensure_response( array( 'verified' => true ) );
	}
}
