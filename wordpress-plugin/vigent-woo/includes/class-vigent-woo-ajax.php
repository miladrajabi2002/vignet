<?php
/**
 * AJAX handlers — status, test, sync batch, save toggles, mark initial push done.
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
                add_action( 'wp_ajax_vigent_woo_disconnect', array( $this, 'ajax_disconnect' ) );
                add_action( 'wp_ajax_vigent_woo_clear_retry', array( $this, 'ajax_clear_retry' ) );
                add_action( 'wp_ajax_vigent_woo_mark_pushed', array( $this, 'ajax_mark_pushed' ) );
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
         * Per-IP rate limit. We use a transient keyed by IP + action so a single
         * attacker can't spam the connect endpoint to harvest webhook credentials.
         *
         * Limits:
         *   • connect: 5 attempts per 10 minutes per IP. After the limit, the
         *     endpoint returns 429 until the window rolls.
         *   • mark_pushed / save_toggles / sync_batch / status / test: 60 per
         *     10 minutes (these are normal admin actions, but still capped so a
         *     hijacked session can't DOS the panel API).
         *
         * Returns true if the request is allowed, false if rate-limited. On
         * false, callers should send a 429 immediately.
         */
        private function check_rate_limit( $action ) {
                $ip = $this->client_ip();
                if ( '' === $ip ) {
                        return true; // can't track → allow (don't break localhost/dev)
                }

                $limits = array(
                        'connect'      => 5,
                        'disconnect'   => 5,
                        'mark_pushed'  => 60,
                        'save_toggles' => 60,
                        'sync_batch'   => 120,
                        'status'       => 120,
                        'test'         => 10,
                );
                $max = isset( $limits[ $action ] ) ? $limits[ $action ] : 30;

                $key      = 'vigent_woo_rl_' . $action . '_' . md5( $ip );
                $window   = 10 * MINUTE_IN_SECONDS; // 10-minute rolling window
                $count    = (int) get_transient( $key );
                if ( $count >= $max ) {
                        return false;
                }
                set_transient( $key, $count + 1, $window );
                return true;
        }

        private function client_ip() {
                // REMOTE_ADDR is the only field the web server sets directly from
                // the TCP connection — every other header can be spoofed by the
                // client. We intentionally do NOT trust X-Forwarded-For here
                // unless the site is behind a known proxy (admin can filter this
                // if needed).
                $ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
                if ( '' === $ip ) {
                        return '';
                }
                // Validate it's actually an IP (defensive — REMOTE_ADDR should
                // always be valid, but cheap to check).
                if ( ! filter_var( $ip, FILTER_VALIDATE_IP ) ) {
                        return '';
                }
                return $ip;
        }

        /**
         * AJAX: Auto-connect to Vigent — fetches webhook URL + secret from the panel.
         * Rate-limited per IP to prevent credential-harvesting via brute force.
         */
        public function ajax_connect() {
                $this->verify_nonce();
                if ( ! $this->check_rate_limit( 'connect' ) ) {
                        wp_send_json_error(
                                array( 'message' => __( 'تعداد تلاش‌ها بیش از حد مجاز است. ۱۰ دقیقه دیگر تلاش کنید.', 'vigent-woo' ) ),
                                429
                        );
                }
                $result = $this->core()->connect_to_vigent();
                // Reset the initial-push flag on a fresh connect so the push wizard
                // appears again if the user reconnects.
                if ( $result['success'] ) {
                        delete_option( 'vigent_woo_initial_push_done' );
                }
                wp_send_json( array( 'success' => $result['success'], 'data' => array( 'message' => $result['message'] ) ) );
        }

        /**
         * AJAX: Disconnect from Vigent.
         *
         * Sends a final `connection.disconnected` webhook event to the Vigent
         * panel so it can mark the integration as inactive, then clears the
         * local credentials + initial-push flag + connection-status transient.
         * After this call returns success, the plugin reloads and shows the
         * connect step again.
         *
         * We send the notification BEFORE clearing the credentials, because the
         * webhook send needs the webhook_url + webhook_secret to be signed.
         * If the notification fails (network error, server down, etc.) we
         * still clear the local credentials — the user wants to disconnect
         * and we shouldn't trap them in a connected state just because the
         * server is unreachable. The server will eventually notice the
         * heartbeat has stopped and mark the integration inactive on its own.
         */
        public function ajax_disconnect() {
                $this->verify_nonce();
                if ( ! $this->check_rate_limit( 'disconnect' ) ) {
                        wp_send_json_error(
                                array( 'message' => __( 'تعداد تلاش‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.', 'vigent-woo' ) ),
                                429
                        );
                }

                $result = $this->core()->disconnect_from_vigent();

                // Always clear local state — even if the server notification
                // failed. The user explicitly asked to disconnect; trapping
                // them in a connected state because of a transient network
                // error would be worse.
                $s = $this->core()->get_settings();
                $s['webhook_url']    = '';
                $s['webhook_secret'] = '';
                $this->core()->update_settings( $s );

                // Reset the initial-push flag so the wizard reappears on
                // reconnect. Also clear the connection-status transient.
                delete_option( 'vigent_woo_initial_push_done' );
                delete_transient( 'vigent_woo_status' );

                // Clear the cron schedules — no point running auto-sync with
                // no credentials. They'll be re-created on the next connect
                // via vigent_woo_setup_cron().
                wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );

                if ( ! $result['success'] ) {
                        // Server notification failed but we still disconnected
                        // locally. Inform the user with a softer message.
                        wp_send_json( array(
                                'success' => true,
                                'data'    => array(
                                        'message' => __( 'اتصال قطع شد. (اعلان سرور ویجنت با خطا مواجه شد اما اطلاعات محلی پاک شد.)', 'vigent-woo' ),
                                ),
                        ) );
                }

                wp_send_json( array(
                        'success' => true,
                        'data'    => array(
                                'message' => __( 'اتصال با موفقیت قطع شد.', 'vigent-woo' ),
                        ),
                ) );
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

        /**
         * Mark the initial push as complete so the admin page swaps from the
         * push wizard to the success + management view.
         */
        public function ajax_mark_pushed() {
                $this->verify_nonce();
                update_option( 'vigent_woo_initial_push_done', 1 );
                wp_send_json_success( array( 'message' => __( 'ثبت شد.', 'vigent-woo' ) ) );
        }
}
