<?php
/**
 * AJAX handlers for Vigent Woo plugin.
 *
 * Handles: live status polling, test connection, sync batch (progress bar),
 * clear retry queue.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_Ajax {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'wp_ajax_vigent_woo_status', array( $this, 'ajax_status' ) );
		add_action( 'wp_ajax_vigent_woo_test', array( $this, 'ajax_test' ) );
		add_action( 'wp_ajax_vigent_woo_sync_batch', array( $this, 'ajax_sync_batch' ) );
		add_action( 'wp_ajax_vigent_woo_clear_retry', array( $this, 'ajax_clear_retry' ) );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	private function verify_nonce() {
		if ( ! check_ajax_referer( VIGENT_WOO_NONCE, 'nonce', false ) ) {
			wp_send_json_error( array( 'message' => __( 'اعتبار nonce نامعتبر است.', 'vigent-woo' ) ), 403 );
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vigent-woo' ) ), 403 );
		}
	}

	/**
	 * AJAX: Get live connection status.
	 */
	public function ajax_status() {
		$this->verify_nonce();
		$status = $this->core()->get_connection_status();
		wp_send_json_success( $status );
	}

	/**
	 * AJAX: Test connection by sending a ping to Vigent.
	 */
	public function ajax_test() {
		$this->verify_nonce();

		if ( ! $this->core()->is_configured() ) {
			$result = array(
				'success' => false,
				'message' => __( 'ابتدا آدرس webhook و کلید امنیتی را وارد و ذخیره کنید.', 'vigent-woo' ),
			);
		} else {
			$core   = $this->core();
			$result = $core->refresh_connection_status();
			if ( $result['connected'] ) {
				$msg = __( 'اتصال با موفقیت برقرار است.', 'vigent-woo' );
			} else {
				/* translators: %d: HTTP code, %s: error message */
				$msg = sprintf( __( 'خطا در اتصال (کد %1$d): %2$s', 'vigent-woo' ), (int) $result['http_code'], $result['error'] ?? '' );
			}
			$result = array(
				'success' => $result['connected'],
				'message' => $msg,
			);
		}

		wp_send_json( array( 'success' => $result['success'], 'data' => $result ) );
	}

	/**
	 * AJAX: Sync a single batch (called repeatedly by the progress bar JS).
	 */
	public function ajax_sync_batch() {
		$this->verify_nonce();

		$kind   = isset( $_POST['kind'] ) ? sanitize_text_field( wp_unslash( $_POST['kind'] ) ) : '';
		$offset = isset( $_POST['offset'] ) ? max( 0, (int) $_POST['offset'] ) : 0;

		if ( ! in_array( $kind, array( 'products', 'orders', 'content' ), true ) ) {
			wp_send_json_error( array( 'message' => __( 'نوع هم‌گام‌سازی نامعتبر است.', 'vigent-woo' ) ) );
		}

		$sync = Vigent_Woo_Sync::instance();
		$result = $sync->sync_batch( $kind, $offset, 25 );

		wp_send_json_success( $result );
	}

	/**
	 * AJAX: Clear the retry queue.
	 */
	public function ajax_clear_retry() {
		$this->verify_nonce();
		$this->core()->clear_retry_queue();
		wp_send_json_success( array( 'message' => __( 'صف retry پاک شد.', 'vigent-woo' ) ) );
	}
}
