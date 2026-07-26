<?php
/**
 * Public, one-time pairing challenge used to prove control of this site.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_REST {

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
