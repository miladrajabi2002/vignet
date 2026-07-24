<?php
/**
 * AJAX handlers — status, test, sync batch, save toggles.
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
                add_action( 'wp_ajax_vigent_woo_save_toggles', array( $this, 'ajax_save_toggles' ) );
                add_action( 'wp_ajax_vigent_woo_connect', array( $this, 'ajax_connect' ) );
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
         * AJAX: Auto-connect to Vigent — fetches webhook URL + secret from the panel.
         */
        public function ajax_connect() {
                $this->verify_nonce();
                $result = $this->core()->connect_to_vigent();
                wp_send_json( array( 'success' => $result['success'], 'data' => array( 'message' => $result['message'] ) ) );
        }

        public function ajax_status() {
                $this->verify_nonce();
                $status     = $this->core()->get_connection_status();
                $configured = $this->core()->is_configured();
                wp_send_json_success( array_merge( $status, array( 'configured' => $configured ) ) );
        }

        public function ajax_test() {
                $this->verify_nonce();
                if ( ! $this->core()->is_configured() ) {
                        wp_send_json( array( 'success' => false, 'data' => array( 'message' => __( 'ابتدا اتصال را برقرار کنید.', 'vigent-woo' ) ) ) );
                }
                $result = $this->core()->refresh_connection_status();
                $msg    = $result['connected']
                        ? __( 'اتصال با موفقیت برقرار است.', 'vigent-woo' )
                        : sprintf( __( 'خطا در اتصال (کد %1$d): %2$s', 'vigent-woo' ), (int) $result['http_code'], $result['error'] ?? '' );
                wp_send_json( array( 'success' => $result['connected'], 'data' => array( 'message' => $msg ) ) );
        }

        public function ajax_sync_batch() {
                $this->verify_nonce();
                $kind   = isset( $_POST['kind'] ) ? sanitize_text_field( wp_unslash( $_POST['kind'] ) ) : '';
                $offset = isset( $_POST['offset'] ) ? max( 0, (int) $_POST['offset'] ) : 0;
                $filter = isset( $_POST['filter'] ) ? json_decode( wp_unslash( $_POST['filter'] ), true ) : array();
                if ( ! is_array( $filter ) ) {
                        $filter = array();
                }
                if ( ! in_array( $kind, array( 'products', 'orders' ), true ) ) {
                        wp_send_json_error( array( 'message' => __( 'نوع نامعتبر.', 'vigent-woo' ) ) );
                }
                $result = Vigent_Woo_Sync::instance()->sync_batch( $kind, $offset, 25, $filter );
                wp_send_json_success( $result );
        }

        public function ajax_save_toggles() {
                $this->verify_nonce();
                $s = $this->core()->get_settings();
                $s['sync_products'] = ! empty( $_POST['sync_products'] ) ? '1' : '';
                $s['sync_orders']   = ! empty( $_POST['sync_orders'] ) ? '1' : '';
                $this->core()->update_settings( $s );
                wp_send_json_success( array( 'message' => __( 'ذخیره شد.', 'vigent-woo' ) ) );
        }

        public function ajax_clear_retry() {
                $this->verify_nonce();
                $this->core()->clear_retry_queue();
                wp_send_json_success( array( 'message' => __( 'صف پاک شد.', 'vigent-woo' ) ) );
        }
}
