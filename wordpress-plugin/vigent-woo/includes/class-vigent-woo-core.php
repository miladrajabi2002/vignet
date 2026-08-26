<?php
/**
 * Core class — settings, webhook sender, retry queue, auto-connect.
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

        // ─── Settings ─────────────────────────────────────────────────────────

        public function get_settings() {
                $defaults = array(
                        'webhook_url'     => '',
                        'webhook_secret'  => '',
                        'sync_products'   => '1',
                        'sync_orders'     => '1',
                        'sync_customers'  => '1',
                        'enable_retry'    => '1',
                );
                $saved = get_option( VIGENT_WOO_OPTION, array() );
                if ( ! is_array( $saved ) ) {
                        $saved = array();
                }
                $merged = array_merge( $defaults, $saved );

                // Decrypt the webhook secret on read. The secret is stored
                // encrypted at rest (see `update_settings`) so that a leaked
                // wp_options table doesn't expose every connected store's
                // signing key. Old plaintext values (from 4.0.1 and earlier)
                // are auto-migrated on first read.
                if ( ! empty( $merged['webhook_secret'] ) ) {
                        $merged['webhook_secret'] = $this->maybe_decrypt_secret( $merged['webhook_secret'] );
                }

                return $merged;
        }

        public function update_settings( $new ) {
                // Encrypt the webhook secret before persisting. We do this
                // here (instead of in callers) so every write path is covered.
                if ( ! empty( $new['webhook_secret'] ) ) {
                        $new['webhook_secret'] = $this->encrypt_secret( $new['webhook_secret'] );
                }
                update_option( VIGENT_WOO_OPTION, $new );
        }

        // ─── At-rest encryption for the webhook secret ───────────────────────
        //
        // We use OpenSSL AES-256-GCM with a key derived from the WordPress
        // AUTH_KEY + AUTH_SALT constants. This means:
        //   • The secret is unreadable without wp-config.php — a SQL dump alone
        //     is useless.
        //   • Each site has a unique key (different AUTH_KEY/SALT), so a leak
        //     on one site doesn't help an attacker on another.
        //   • We never store the key itself — it's recomputed from constants
        //     on every read/write.
        //
        // The on-disk format is: base64( iv (12) || ciphertext || tag (16) ).
        // We prefix it with "enc:" so we can detect and migrate old plaintext
        // values transparently.

        private function encryption_key() {
                // Fall back to a stable per-site key if the auth constants
                // aren't defined (very unusual, but defensive).
                $key_material = '';
                if ( defined( 'AUTH_KEY' ) && AUTH_KEY ) {
                        $key_material .= AUTH_KEY;
                }
                if ( defined( 'AUTH_SALT' ) && AUTH_SALT ) {
                        $key_material .= AUTH_SALT;
                }
                if ( '' === $key_material ) {
                        // Last-resort: hash of the site URL + DB name. Still
                        // better than plaintext, and stable across requests.
                        $key_material = home_url() . '|' . ( defined( 'DB_NAME' ) ? DB_NAME : '' );
                }
                // SHA-256 → 32 bytes for AES-256.
                return hash( 'sha256', $key_material, true );
        }

        public function encrypt_secret( $plaintext ) {
                if ( '' === (string) $plaintext ) {
                        return '';
                }
                // Already encrypted? Leave it.
                if ( 0 === strpos( $plaintext, 'enc:' ) ) {
                        return $plaintext;
                }
                $key = $this->encryption_key();
                $iv  = random_bytes( 12 ); // GCM nonce — 12 bytes is the recommended size.
                $tag = '';
                $ct  = openssl_encrypt(
                        $plaintext,
                        'aes-256-gcm',
                        $key,
                        OPENSSL_RAW_DATA,
                        $iv,
                        $tag,
                );
                if ( false === $ct ) {
                        // Encryption failed — fall back to plaintext (still
                        // works, just less safe). Logged for the operator.
                        error_log( '[vigent-woo] openssl_encrypt failed; storing plaintext secret' );
                        return $plaintext;
                }
                // Pack as iv || ct || tag, base64, prefix with "enc:".
                $packed = base64_encode( $iv . $ct . $tag );
                return 'enc:' . $packed;
        }

        public function maybe_decrypt_secret( $value ) {
                if ( 0 !== strpos( $value, 'enc:' ) ) {
                        // Plaintext (legacy or just-stored). Return as-is so
                        // callers can use it normally; the next `update_settings`
                        // call will encrypt it transparently.
                        return $value;
                }
                $packed = substr( $value, 4 );
                $raw    = base64_decode( $packed, true );
                if ( false === $raw || strlen( $raw ) < 28 ) {
                        // Malformed — return empty so we don't leak garbage.
                        return '';
                }
                $iv  = substr( $raw, 0, 12 );
                $tag = substr( $raw, -16 );
                $ct  = substr( $raw, 12, strlen( $raw ) - 28 );
                $key = $this->encryption_key();
                $pt  = openssl_decrypt(
                        $ct,
                        'aes-256-gcm',
                        $key,
                        OPENSSL_RAW_DATA,
                        $iv,
                        $tag,
                );
                return false === $pt ? '' : $pt;
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

        public function sync_customers_enabled() {
                $s = $this->get_settings();
                return ! empty( $s['sync_customers'] ) && $this->is_configured();
        }

        // ─── Auto-connect to Vigent ──────────────────────────────────────────

        /**
         * Connect to Vigent: ask the Vigent panel for the webhook URL + secret
         * for this site. The Vigent panel exposes an endpoint that returns the
         * credentials for a site by its URL.
         *
         * Called when the user clicks "اتصال" in the plugin.
         *
         * @param string $site_url The site URL (defaults to home_url()).
         * @return array { success, message }
         */
        public function connect_to_vigent( $site_url = '' ) {
                if ( empty( $site_url ) ) {
                        $site_url = home_url();
                }
                $site_url = untrailingslashit( $site_url );

                // Prove control of this WordPress site before the panel returns a secret.
                // The panel calls the one-time REST challenge while this lookup is open.
                $pairing_nonce = wp_generate_password( 64, false, false );
                set_transient(
                        'vigent_woo_pairing_challenge',
                        array(
                                'hash'       => hash( 'sha256', $pairing_nonce ),
                                'site_url'   => $site_url,
                                'created_at' => time(),
                        ),
                        5 * MINUTE_IN_SECONDS
                );

                $panel_url = 'https://vigent.ir/api/integrations/lookup';
                $lookup_url = add_query_arg(
                        array(
                                'site_url'     => $site_url,
                                'pairing_nonce'=> $pairing_nonce,
                        ),
                        $panel_url
                );

                $response = wp_remote_get( $lookup_url, array(
                        'timeout' => 15,
                        'headers' => array( 'Accept' => 'application/json' ),
                ) );
                // The nonce is single-use at the REST endpoint and short-lived; also
                // remove it here so failed/aborted lookups cannot be replayed.
                delete_transient( 'vigent_woo_pairing_challenge' );

                if ( is_wp_error( $response ) ) {
                        return array(
                                'success' => false,
                                'message' => sprintf( __( 'خطا در ارتباط با ویجنت: %s', 'vigent-woo' ), $response->get_error_message() ),
                        );
                }

                $code = (int) wp_remote_retrieve_response_code( $response );
                $body = wp_remote_retrieve_body( $response );
                $data = json_decode( $body, true );

                if ( 200 !== $code || ! is_array( $data ) ) {
                        return array(
                                'success' => false,
                                /* translators: %d: HTTP code */
                                'message' => sprintf( __( 'پاسخ نامعتبر از ویجنت (کد %d). ابتدا در پنل ویجنت یک اتصال سایت بسازید.', 'vigent-woo' ), $code ),
                        );
                }

                $webhook_url    = isset( $data['webhook_url'] ) ? $data['webhook_url'] : '';
                $webhook_secret = isset( $data['webhook_secret'] ) ? $data['webhook_secret'] : '';

                if ( empty( $webhook_url ) || empty( $webhook_secret ) ) {
                        return array(
                                'success' => false,
                                'message' => __( 'اطلاعات اتصال در پنل ویجنت یافت نشد. ابتدا در پنل یک اتصال سایت بسازید.', 'vigent-woo' ),
                        );
                }

                // Save the credentials.
                $s = $this->get_settings();
                $s['webhook_url']    = esc_url_raw( $webhook_url );
                $s['webhook_secret'] = sanitize_text_field( $webhook_secret );
                $this->update_settings( $s );

                // Send a test ping to confirm.
                $test = $this->refresh_connection_status();

                return array(
                        'success' => $test['connected'],
                        'message' => $test['connected']
                                ? __( 'اتصال با موفقیت برقرار شد!', 'vigent-woo' )
                                : sprintf( __( 'اطلاعات ذخیره شد اما تست اتصال ناموفق بود (کد %d).', 'vigent-woo' ), (int) $test['http_code'] ),
                );
        }

        // ─── Disconnect from Vigent ──────────────────────────────────────────

        /**
         * Notify the Vigent panel that this site is disconnecting.
         *
         * Sends a `connection.disconnected` webhook event with the site URL +
         * timestamp. The Vigent server's webhook handler marks the
         * StoreIntegration as `active = false` so the panel shows "قطع شد".
         *
         * This method does NOT clear the local credentials — the caller
         * (ajax_disconnect) is responsible for that, and only AFTER this
         * notification has been attempted (so the webhook can still be
         * signed with the current secret).
         *
         * @return array { success, message }
         */
        public function disconnect_from_vigent() {
                if ( ! $this->is_configured() ) {
                        // Already disconnected — nothing to notify.
                        return array(
                                'success' => true,
                                'message' => __( 'اتصال قبلاً قطع شده است.', 'vigent-woo' ),
                        );
                }

                $payload = array(
                        'site_url'  => home_url(),
                        'site_name' => get_bloginfo( 'name' ),
                        'timestamp' => current_time( 'mysql' ),
                        'reason'    => 'user_disconnect',
                );

                // Send with retry=false so we don't queue a retry for a
                // disconnect notification (there's no point — the credentials
                // are about to be wiped).
                $result = $this->send_event( 'connection.disconnected', $payload, false );

                if ( ! empty( $result['success'] ) ) {
                        return array(
                                'success' => true,
                                'message' => __( 'اعلان قطع اتصال به ویجنت ارسال شد.', 'vigent-woo' ),
                        );
                }

                return array(
                        'success' => false,
                        'message' => sprintf(
                                /* translators: %s: error message */
                                __( 'خطا در ارسال اعلان قطع به ویجنت: %s', 'vigent-woo' ),
                                $result['body']
                        ),
                );
        }

        // ─── ارسال رویداد ────────────────────────────────────────────────────

        public function send_event( $topic, $data, $retry = true ) {
                $s = $this->get_settings();
                if ( empty( $s['webhook_url'] ) || empty( $s['webhook_secret'] ) ) {
                        $this->debug_log( "send_event NO_CONFIG", array( 'topic' => $topic ) );
                        return array( 'code' => 0, 'body' => __( 'تنظیمات کامل نیست.', 'vigent-woo' ), 'success' => false );
                }

                $body = wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
                if ( false === $body ) {
                        $this->debug_log( "send_event JSON_FAIL", array( 'topic' => $topic ) );
                        return array( 'code' => 0, 'body' => __( 'خطا در JSON.', 'vigent-woo' ), 'success' => false );
                }

                $signature = hash_hmac( 'sha256', $body, $s['webhook_secret'] );
                $body_size = strlen( $body );
                $event_cnt = is_array( $data ) && isset( $data['events'] ) ? count( $data['events'] ) : 1;
                $site_url  = is_array( $data ) && isset( $data['site_url'] ) ? $data['site_url'] : '';
                $start     = microtime( true );

                $this->debug_log( "send_event REQUEST", array(
                        'topic'       => $topic,
                        'body_size'   => $body_size,
                        'event_count' => $event_cnt,
                        'site_url'    => $site_url,
                ) );

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
                                        // Vigent records the plugin version per delivery. Without this
                                        // header it only learned the version from a manual connection
                                        // test, so an auto-updated site kept reporting its old version.
                                        'X-Vigent-Plugin-Version' => defined( 'VIGENT_WOO_VERSION' ) ? VIGENT_WOO_VERSION : '',
                                ),
                                'body'        => $body,
                        )
                );

                $duration_ms = round( ( microtime( true ) - $start ) * 1000, 1 );

                if ( is_wp_error( $response ) ) {
                        $err_msg  = $response->get_error_message();
                        $err_code = $response->get_error_code();
                        $this->debug_log( "send_event WP_ERROR", array(
                                'topic'       => $topic,
                                'error_code'  => $err_code,
                                'error'       => $err_msg,
                                'body_size'   => $body_size,
                                'duration_ms' => $duration_ms,
                        ) );
                        if ( $retry && ! empty( $s['enable_retry'] ) ) {
                                $this->queue_retry( $topic, $body, $err_msg );
                        }
                        return array( 'code' => 0, 'body' => $err_msg, 'success' => false );
                }

                $code      = (int) wp_remote_retrieve_response_code( $response );
                $resp_body = wp_remote_retrieve_body( $response );
                $success   = $code >= 200 && $code < 300;

                $this->debug_log( "send_event RESPONSE", array(
                        'topic'       => $topic,
                        'http_code'   => $code,
                        'success'     => $success,
                        'body_size'   => $body_size,
                        'duration_ms' => $duration_ms,
                        'response'    => substr( $resp_body, 0, 1000 ),
                ) );

                if ( ! $success && $retry && ! empty( $s['enable_retry'] ) ) {
                        $this->queue_retry( $topic, $body, "HTTP $code: $resp_body" );
                }

                $this->update_connection_status( $success, $code, $success ? null : $resp_body );

                return array( 'code' => $code, 'body' => $resp_body, 'success' => $success );
        }

        /**
         * Send up to 50 events in the versioned batch envelope understood by Vigent.
         * A 2xx response accepts the whole batch; callers retain their queue on any
         * other response.
         */
        public function send_batch_events( $events, $retry = false ) {
                if ( ! is_array( $events ) || empty( $events ) ) {
                        return array( 'code' => 0, 'body' => __( 'بچ خالی است.', 'vigent-woo' ), 'success' => false );
                }
                $events = array_slice( array_values( $events ), 0, 50 );
                return $this->send_event(
                        'sync.batch',
                        array(
                                'version'  => 1,
                                'site_url' => home_url(),
                                'events'   => $events,
                        ),
                        $retry
                );
        }

        // ─── Connection Status ──────────────────────────────────────────────

        // ─── Debug Logging ──────────────────────────────────────────────────
        //
        // All webhook send_event requests are logged to
        // `wp-content/uploads/vigent-woo-logs/debug.log` with timestamp, topic,
        // HTTP code, response body (truncated), and duration. This file is the
        // single source of truth for diagnosing sync failures — the JS alert
        // is intentionally generic, so the debug log is what tells the site
        // admin (and Vigent support) exactly what failed.
        //
        // The file auto-rotates: when it exceeds 5 MB it's renamed to
        // `debug.log.old` and a fresh file is started. Only one old file is
        // kept, so the max disk usage is ~10 MB.

        /**
         * Get the absolute path to the debug log file.
         *
         * @return string Empty string if uploads dir is unavailable.
         */
        public function get_debug_log_file() {
                $uploads = wp_get_upload_dir();
                if ( empty( $uploads['basedir'] ) ) {
                        return '';
                }
                $log_dir = trailingslashit( $uploads['basedir'] ) . 'vigent-woo-logs';
                if ( ! is_dir( $log_dir ) ) {
                        @mkdir( $log_dir, 0755, true );
                }
                return trailingslashit( $log_dir ) . 'debug.log';
        }

        /**
         * Get the absolute path to the rotated (previous) debug log file.
         */
        public function get_debug_log_old_file() {
                $file = $this->get_debug_log_file();
                return $file ? substr( $file, 0, -4 ) . '.log.old' : '';
        }

        /**
         * Write a debug log entry.
         *
         * @param string       $message Short label, e.g. "send_event RESPONSE".
         * @param array|string $context Optional structured data (array is JSON-encoded).
         */
        public function debug_log( $message, $context = array() ) {
                $log_file = $this->get_debug_log_file();
                if ( '' === $log_file ) {
                        return;
                }
                // Auto-rotate: if file > 5 MB, rename to .old (overwriting any existing .old).
                if ( is_file( $log_file ) && filesize( $log_file ) > 5 * MB_IN_BYTES ) {
                        @rename( $log_file, $this->get_debug_log_old_file() );
                }
                $entry = '[' . current_time( 'mysql' ) . '] ' . $message;
                if ( ! empty( $context ) ) {
                        if ( is_array( $context ) ) {
                                $entry .= ' ' . wp_json_encode( $context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
                        } else {
                                $entry .= ' ' . (string) $context;
                        }
                }
                $entry .= "\n";
                // LOCK_EX to avoid interleaved writes from concurrent requests.
                @file_put_contents( $log_file, $entry, FILE_APPEND | LOCK_EX );
        }

        /**
         * Read the tail of the debug log (and the .old file if needed to reach the requested line count).
         *
         * @param int $lines Number of lines to return (default 200, max 1000).
         * @return string Log content. Empty string if no log exists.
         */
        public function read_debug_log( $lines = 200 ) {
                $lines = max( 50, min( 1000, (int) $lines ) );
                $file  = $this->get_debug_log_file();
                if ( '' === $file || ! is_file( $file ) ) {
                        return '';
                }
                $contents = @file_get_contents( $file );
                if ( false === $contents ) {
                        return '';
                }
                $all_lines = explode( "\n", $contents );
                // Drop the trailing empty line from the final "\n".
                if ( count( $all_lines ) > 0 && '' === end( $all_lines ) ) {
                    array_pop( $all_lines );
                }
                if ( count( $all_lines ) <= $lines ) {
                    // Top up from the .old file if we have one.
                    $old_file = $this->get_debug_log_old_file();
                    if ( is_file( $old_file ) ) {
                        $old_contents = @file_get_contents( $old_file );
                        if ( false !== $old_contents ) {
                            $old_lines = explode( "\n", $old_contents );
                            if ( count( $old_lines ) > 0 && '' === end( $old_lines ) ) {
                                array_pop( $old_lines );
                            }
                            $needed = $lines - count( $all_lines );
                            $all_lines = array_merge( array_slice( $old_lines, -$needed ), $all_lines );
                        }
                    }
                } else {
                    $all_lines = array_slice( $all_lines, -$lines );
                }
                return implode( "\n", $all_lines );
        }

        /**
         * Clear (truncate) the debug log file and remove the .old file.
         *
         * @return bool True on success.
         */
        public function clear_debug_log() {
                $file = $this->get_debug_log_file();
                if ( '' === $file ) {
                        return false;
                }
                if ( is_file( $file ) ) {
                        @file_put_contents( $file, '' );
                }
                $old_file = $this->get_debug_log_old_file();
                if ( $old_file && is_file( $old_file ) ) {
                        @unlink( $old_file );
                }
                return true;
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
                        'test'           => true,
                        'site_url'       => home_url(),
                        'site_name'      => get_bloginfo( 'name' ),
                        'timestamp'      => current_time( 'mysql' ),
                        'has_wc'         => $this->has_wc(),
                        'plugin_version' => defined( 'VIGENT_WOO_VERSION' ) ? VIGENT_WOO_VERSION : '',
                        'capabilities'   => array( 'sync.batch', 'product.categories', 'delta.queue.v1' ),
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
                                                'X-Vigent-Plugin-Version' => defined( 'VIGENT_WOO_VERSION' ) ? VIGENT_WOO_VERSION : '',
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

        /**
         * Pick a display-sized image instead of the original upload.
         *
         * Vigent renders the first image inside chat product cards at roughly
         * 320×240, so a 3–5MB original made every card a slow, expensive download
         * on mobile. `wp_get_attachment_image_url()` already falls back to the full
         * size when a registered size is missing, so this is safe on any site.
         */
        private function product_image_src( $attachment_id ) {
                foreach ( array( 'woocommerce_single', 'large', 'full' ) as $size ) {
                        $src = wp_get_attachment_image_url( $attachment_id, $size );
                        if ( $src ) {
                                return $src;
                        }
                }
                return '';
        }

        /**
         * Convert an HTML product description into clean, readable plain text.
         *
         * WooCommerce stores product descriptions as HTML (the rich text editor
         * output). Some shop themes wrap every attribute in styled <div>/<span>
         * tags with classes like:
         *
         *   <div class="sc-guDLey fELFnW">
         *     <div class="sc-guDLey fELFnW">
         *       <span class="sc-hLQSwg gRGEch">جنس کار:</span>
         *       <span class="sc-hLQSwg eCaJqF sc-20cd4b0f-0 gAXKXn">داکرون</span>
         *     </div>
         *     ...
         *   </div>
         *
         * When this HTML is sent to Vigent and the agent renders it in a chat
         * message, the user sees a wall of CSS class names instead of clean
         * text. We need to convert it to:
         *
         *   جنس کار: داکرون
         *   قد کار: ۱۲۰ سانتی متر
         *   دورسینه : ۱۱۲ سانتی متر
         *
         * Strategy:
         *   1. Convert block-level tags (<div>, <p>, <br>, <li>, <tr>) to
         *      newlines so each "row" ends up on its own line.
         *   2. Strip ALL remaining HTML tags (including <span> with their
         *      classes) — we keep only the inner text.
         *   3. Decode HTML entities (&nbsp; → space, &amp; → &, etc.).
         *   4. Collapse runs of whitespace inside each line (multiple spaces
         *      become one) and trim trailing spaces from each line.
         *   5. Collapse runs of blank lines to a single blank line, and trim
         *      the whole string.
         *
         * This is a deterministic, dependency-free transformation. We don't
         * use wp_strip_all_tags() because it doesn't insert newlines for
         * block-level elements — it would join "جنس کار:" and "داکرون"
         * into "جنس کار:داکرون" with no space, or worse, join separate
         * rows on the same line.
         *
         * @param string $html Raw HTML from WC_Product::get_description() etc.
         * @return string Clean plain text, may be empty string.
         */
        public function html_to_plain_text( $html ) {
                if ( empty( $html ) || ! is_string( $html ) ) {
                        return '';
                }
                // 1. Normalize newlines to \n first (Windows \r\n → \n, lone \r → \n).
                $text = str_replace( array( "\r\n", "\r" ), "\n", $html );

                // 2. Insert a newline AFTER every closing block tag, and a newline
                //    BEFORE every opening block tag. This way adjacent block elements
                //    (e.g. </div><div class="...">) end up on separate lines.
                //
                //    We use a comprehensive list of HTML block-level elements.
                //    The `[^>]*` after the tag name matches any attributes
                //    (class="...", style="...", id="..." etc.) so they're consumed
                //    by the regex and don't survive into the output.
                //
                //    We run this BEFORE strip_tags so the newline structure is
                //    preserved — strip_tags just removes <span>/<a>/<b>/etc.
                //    inline tags without touching them.
                $block_pattern = '#</?(?:div|p|section|article|header|footer|main|aside|figure|figcaption|blockquote|pre|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|h[1-6]|hr|br)\b[^>]*>#i';
                $text = preg_replace( $block_pattern, "\n", $text );

                // 2b. Insert a single space between adjacent inline-tag boundaries.
                //     When two inline tags sit next to each other with no whitespace
                //     between them (very common in theme-generated HTML):
                //       <span>جنس کار:</span><span>داکرون</span>
                //     naive strip_tags would join them into "جنس کار:داکرون" with no
                //     space. We want "جنس کار: داکرون" — a space after the colon.
                //     The simplest fix: replace every "</X>" closing inline tag
                //     boundary (</span>, </a>, </b>, </i>, </strong>, </em>, etc.)
                //     with a single space. strip_tags will then remove the leftover
                //     opening tags, and the spaces survive into the final text.
                //     Multiple adjacent spaces collapse in step 6 below.
                $text = preg_replace( '#</(span|a|b|i|strong|em|u|small|sub|sup|mark|label|font|code|abbr|cite|q|time|var)\s*>#i', ' ', $text );

                // 3. Strip ALL remaining tags. Anything we didn't convert above
                //    (span, a, img, strong, em, b, i, etc.) loses its tag and we
                //    keep only the inner text.
                $text = wp_strip_all_tags( $text );

                // 4. Decode HTML entities. wp_strip_all_tags doesn't decode
                //    entities by default, so &nbsp; would survive as the literal
                //    string "&nbsp;". We use wp_kses_decode_entities which is
                //    the WP-canonical decoder (handles named + numeric entities).
                $text = wp_kses_decode_entities( $text );

                // 5. Convert non-breaking spaces (U+00A0 and the HTML entity
                //    decoded form) to regular spaces so they collapse properly
                //    in step 6.
                $text = str_replace( "\xc2\xa0", ' ', $text );

                // 6. Collapse runs of spaces/tabs inside each line to a single
                //    space, and trim trailing spaces. We split on \n, process
                //    each line, then rejoin.
                $lines = explode( "\n", $text );
                $clean_lines = array();
                foreach ( $lines as $line ) {
                        // Collapse internal whitespace runs to a single space.
                        $line = preg_replace( '/[ \t]+/', ' ', $line );
                        // Trim trailing/leading spaces on this line.
                        $line = trim( $line );
                        if ( $line !== '' ) {
                                $clean_lines[] = $line;
                        }
                }
                // 7. Rejoin with single \n. Multiple blank lines collapse to
                //    zero (because we skipped empty lines above), which is
                //    what we want for a compact, readable text.
                $text = implode( "\n", $clean_lines );
                return trim( $text );
        }

        public function product_to_payload( $product ) {
                if ( ! $product ) {
                        return array();
                }

                $images = array();
                foreach ( $product->get_gallery_image_ids() as $id ) {
                        $src = $this->product_image_src( $id );
                        if ( $src ) {
                                $images[] = array( 'src' => $src );
                        }
                }
                $thumb = $product->get_image_id();
                if ( $thumb ) {
                        $src = $this->product_image_src( $thumb );
                        if ( $src ) {
                                array_unshift( $images, array( 'src' => $src ) );
                        }
                }

                // Normalize attributes to a flat { name: string, options: string[] }
                // shape before sending — this prevents the `[object Object]`
                // rendering bug on the Vigent side (which used to happen when
                // the WP plugin sent raw WC attribute objects).
                $attrs = array();
                foreach ( $product->get_attributes() as $key => $value ) {
                        $name = wc_attribute_label( $key );

                        // WooCommerce stores attribute values in several shapes:
                        //   • string — pre-3.0 flat string
                        //   • WC_Product_Attribute — the modern object form
                        //   • array  — variation attribute
                        // We extract `options` from each and normalize to a string[].
                        if ( is_object( $value ) ) {
                                // WC_Product_Attribute object.
                                $raw_options = method_exists( $value, 'get_options' ) ? $value->get_options() : array();
                                $opts = array();
                                if ( is_array( $raw_options ) ) {
                                        foreach ( $raw_options as $opt ) {
                                                // Each option can be a term ID (int) or a string.
                                                // Term IDs need to be resolved to their name.
                                                if ( is_numeric( $opt ) && $value->is_taxonomy() ) {
                                                        $term = get_term_by( 'term_id', (int) $opt, $value->get_name() );
                                                        if ( $term && ! is_wp_error( $term ) ) {
                                                                $opts[] = $term->name;
                                                        }
                                                } else {
                                                        $opts[] = (string) $opt;
                                                }
                                        }
                                }
                                $attrs[] = array(
                                        'name'    => $name,
                                        'options' => $opts,
                                );
                        } elseif ( is_array( $value ) ) {
                                // Array of values (variation attribute).
                                $attrs[] = array(
                                        'name'    => $name,
                                        'options' => array_map( 'strval', $value ),
                                );
                        } else {
                                // Flat string.
                                $attrs[] = array(
                                        'name'    => $name,
                                        'options' => array( (string) $value ),
                                );
                        }
                }

                $tags = array();
                $taxonomy_product_id = $product->get_parent_id() ? $product->get_parent_id() : $product->get_id();
                $terms = get_the_terms( $taxonomy_product_id, 'product_tag' );
                if ( is_array( $terms ) ) {
                        foreach ( $terms as $term ) {
                                $tags[] = array( 'name' => $term->name );
                        }
                }

                $categories    = array();
                $category_terms = get_the_terms( $taxonomy_product_id, 'product_cat' );
                if ( is_array( $category_terms ) ) {
                        foreach ( $category_terms as $term ) {
                                $categories[] = array(
                                        'id'     => (int) $term->term_id,
                                        'name'   => $term->name,
                                        'slug'   => $term->slug,
                                        'parent' => (int) $term->parent,
                                );
                        }
                }
                $date_modified = $product->get_date_modified();

                // Convert HTML descriptions to clean plain text. WooCommerce stores
                // these as HTML (rich text editor output), but some shop themes
                // wrap every attribute in styled <div>/<span> tags with classes
                // that look like garbage when rendered in chat. We strip all HTML
                // and convert block-level elements to newlines so the agent sees
                // clean, readable text like:
                //   جنس کار: داکرون
                //   قد کار: ۱۲۰ سانتی متر
                // See html_to_plain_text() above for the full strategy.
                $description       = $this->html_to_plain_text( $product->get_description() );
                $short_description = $this->html_to_plain_text( $product->get_short_description() );

                return array(
                        'id'                => $product->get_id(),
                        'name'              => $product->get_name(),
                        'sku'               => $product->get_sku(),
                        'description'       => $description,
                        'short_description' => $short_description,
                        'price'             => $product->get_price(),
                        'regular_price'     => $product->get_regular_price(),
                        'sale_price'        => $product->get_sale_price(),
                        'status'            => $product->get_status(),
                        'manage_stock'      => $product->get_manage_stock(),
                        'stock_quantity'    => $product->get_stock_quantity(),
                        'in_stock'          => $product->is_in_stock(),
                        'permalink'         => $product->get_permalink(),
                        'date_modified'     => $date_modified ? $date_modified->date( 'c' ) : null,
                        'date_modified_gmt' => $date_modified ? gmdate( 'c', $date_modified->getTimestamp() ) : null,
                        'images'            => $images,
                        'attributes'        => $attrs,
                        'tags'              => $tags,
                        'categories'        => $categories,
                );
        }

        /**
         * Convert a WooCommerce customer (WP_User with WC customer role, or any
         * user with billing data) into the payload Vigent expects.
         *
         * The payload schema mirrors `upsertContactFromWoo()` on the Vigent
         * server. Every field is optional except `id` and at least one of
         * `email` / `phone` — we'd rather skip an incomplete customer than
         * pollute Vigent's Contact table with empty rows.
         *
         * @param WP_User|int $user WP_User object or user ID.
         * @return array {
         *   @type int    $id                 WordPress user ID.
         *   @type string $email              Customer email (lowercased).
         *   @type string $first_name
         *   @type string $last_name
         *   @type string $display_name
         *   @type string $phone              Billing phone (normalized to E.164-ish).
         *   @type string $billing_city       City (often used by the agent to
         *                                    answer «از کدام شهر هستید؟»).
         *   @type string $billing_state
         *   @type string $billing_address_1
         *   @type string $billing_postcode
         *   @type string $date_created      ISO 8601.
         *   @type string $date_created_gmt  ISO 8601 (UTC).
         *   @type string $date_modified     ISO 8601.
         *   @type string $date_modified_gmt ISO 8601 (UTC).
         *   @type bool   $is_paying         True if the user has at least one
         *                                    completed order.
         *   @type int    $orders_count      Number of orders placed by this user.
         *   @type float  $total_spent       Lifetime revenue from this user.
         * }
         */
        public function customer_to_payload( $user ) {
                if ( ! $user ) {
                        return array();
                }
                if ( is_numeric( $user ) ) {
                        $user_id = (int) $user;
                        if ( ! function_exists( 'get_userdata' ) ) {
                                return array();
                        }
                        $user = get_userdata( $user_id );
                        if ( ! $user ) {
                                return array();
                        }
                }
                if ( ! ( $user instanceof \WP_User ) ) {
                        return array();
                }

                // get_user_meta returns '' for missing keys; we coerce to string.
                $first = (string) get_user_meta( $user->ID, 'first_name', true );
                $last  = (string) get_user_meta( $user->ID, 'last_name', true );
                // WooCommerce stores billing fields as user meta. These are
                // populated when the customer places their first order OR when
                // they edit their account page.
                $phone        = (string) get_user_meta( $user->ID, 'billing_phone', true );
                $billing_city = (string) get_user_meta( $user->ID, 'billing_city', true );
                $billing_state = (string) get_user_meta( $user->ID, 'billing_state', true );
                $billing_addr = (string) get_user_meta( $user->ID, 'billing_address_1', true );
                $billing_post = (string) get_user_meta( $user->ID, 'billing_postcode', true );

                // WooCommerce reports order count + lifetime spend via the
                // _money_spent + _order_count user meta. These are cached and
                // updated on each order status change, so reading them is cheap.
                $orders_count = (int) get_user_meta( $user->ID, '_order_count', true );
                $total_spent  = (float) get_user_meta( $user->ID, '_money_spent', true );
                // A customer is "paying" if they have at least one completed order.
                // _order_count is bumped by WooCommerce on every order, regardless
                // of status, so it doesn't directly tell us "paying". We treat
                // orders_count >= 1 as "paying" for simplicity — a customer who
                // placed an order (even if it failed) engaged with checkout.
                $is_paying = $orders_count > 0;

                $date_created  = ! empty( $user->user_registered ) ? $user->user_registered : '';
                $date_modified = (string) get_user_meta( $user->ID, 'last_update', true );
                if ( '' === $date_modified ) {
                        $date_modified = $date_created;
                }

                return array(
                        'id'                 => (int) $user->ID,
                        'email'              => $user->user_email ? strtolower( trim( $user->user_email ) ) : '',
                        'first_name'         => $first,
                        'last_name'          => $last,
                        'display_name'       => $user->display_name ?: '',
                        'phone'              => $phone,
                        'billing_city'       => $billing_city,
                        'billing_state'      => $billing_state,
                        'billing_address_1'  => $billing_addr,
                        'billing_postcode'   => $billing_post,
                        'date_created'       => $date_created ? gmdate( 'c', strtotime( $date_created ) ) : null,
                        'date_created_gmt'   => $date_created ? gmdate( 'c', strtotime( $date_created ) ) : null,
                        'date_modified'      => $date_modified ? gmdate( 'c', strtotime( $date_modified ) ) : null,
                        'date_modified_gmt'  => $date_modified ? gmdate( 'c', strtotime( $date_modified ) ) : null,
                        'is_paying'          => $is_paying,
                        'orders_count'       => $orders_count,
                        'total_spent'        => $total_spent,
                );
        }

        public function order_to_payload( $order ) {
                if ( ! $order ) {
                        return array();
                }

                // Defensive guard: OrderRefund objects (returned by wc_get_orders in
                // some WC versions) don't implement get_order_number(), get_total(),
                // etc. Calling those methods throws a fatal "Call to undefined method"
                // error. We bail early with an empty payload — sync_batch also filters
                // refunds out, but this is the second line of defense in case
                // order_to_payload is called from another path (e.g. a hook firing on
                // refund creation).
                if ( ! ( $order instanceof \WC_Order ) ) {
                        $this->debug_log( 'order_to_payload SKIP_NON_ORDER', array(
                                'class' => get_class( $order ),
                                'id'    => method_exists( $order, 'get_id' ) ? $order->get_id() : 0,
                        ) );
                        return array();
                }
                if ( 'shop_order_refund' === $order->get_type() ) {
                        $this->debug_log( 'order_to_payload SKIP_REFUND', array(
                                'id'     => $order->get_id(),
                                'parent' => method_exists( $order, 'get_parent_id' ) ? $order->get_parent_id() : 0,
                        ) );
                        return array();
                }

                $line_items = array();
                foreach ( $order->get_items() as $item ) {
                        // get_product() can return null if the underlying product was
                        // deleted from the database but the order line item still
                        // references it. Without this guard, calling ->get_sku() on null
                        // throws a fatal "Call to a member function get_sku() on null".
                        $product = method_exists( $item, 'get_product' ) ? $item->get_product() : null;
                        $sku      = '';
                        if ( $product && method_exists( $product, 'get_sku' ) ) {
                                $sku = (string) $product->get_sku();
                        }
                        $line_items[] = array(
                                'name'     => $item->get_name(),
                                'quantity' => $item->get_quantity(),
                                'total'    => $item->get_total(),
                                'sku'      => $sku,
                        );
                }

                $shipping_methods = array();
                foreach ( $order->get_shipping_methods() as $shipping ) {
                        $shipping_methods[] = array(
                                'method_title' => $shipping->get_method_title(),
                        );
                }

                // All order getters are wrapped with method_exists for defensive
                // coding — some stores use custom order classes that may not implement
                // every method. We'd rather send an empty string than crash the sync.
                $first_name    = method_exists( $order, 'get_billing_first_name' ) ? $order->get_billing_first_name() : '';
                $last_name  = method_exists( $order, 'get_billing_last_name' ) ? $order->get_billing_last_name() : '';
                $phone      = method_exists( $order, 'get_billing_phone' ) ? $order->get_billing_phone() : '';
                $email         = method_exists( $order, 'get_billing_email' ) ? $order->get_billing_email() : '';
                $date_created  = method_exists( $order, 'get_date_created' ) ? $order->get_date_created() : null;
                $date_modified = method_exists( $order, 'get_date_modified' ) ? $order->get_date_modified() : null;

                // Extract shipping info (tracking code, courier, date, link, note)
                // from the various Iranian shipment plugins. See get_order_shipping_info().
                $shipping_info = $this->get_order_shipping_info( $order );

                // Backwards-compat: tracking_code is still a top-level field so the
                // Vigent server (which reads $payload['tracking_code']) keeps working.
                // New code should read $payload['shipping_info']['tracking_code'].
                $tracking_code = isset( $shipping_info['tracking_code'] ) ? $shipping_info['tracking_code'] : '';

                // Use method_exists for every getter — get_order_number, get_currency,
                // get_total, get_customer_id, etc. are all standard WC_Order methods,
                // but being defensive costs nothing and prevents a single missing
                // method from crashing the entire batch.
                return array(
                        'id'                   => $order->get_id(),
                        'number'               => method_exists( $order, 'get_order_number' ) ? $order->get_order_number() : (string) $order->get_id(),
                        'status'               => method_exists( $order, 'get_status' ) ? $order->get_status() : '',
                        'currency'             => method_exists( $order, 'get_currency' ) ? $order->get_currency() : '',
                        'total'                => method_exists( $order, 'get_total' ) ? $order->get_total() : '',
                        'customer_id'          => method_exists( $order, 'get_customer_id' ) ? $order->get_customer_id() : 0,
                        'payment_method'       => method_exists( $order, 'get_payment_method' ) ? $order->get_payment_method() : '',
                        'payment_method_title' => method_exists( $order, 'get_payment_method_title' ) ? $order->get_payment_method_title() : '',
                        'date_created'         => $date_created ? $date_created->date( 'c' ) : null,
                        'date_created_gmt'     => $date_created ? gmdate( 'c', $date_created->getTimestamp() ) : null,
                        'date_modified'        => $date_modified ? $date_modified->date( 'c' ) : null,
                        'date_modified_gmt'    => $date_modified ? gmdate( 'c', $date_modified->getTimestamp() ) : null,
                        'tracking_code'        => $tracking_code,
                        'billing'              => array(
                                'first_name' => $first_name,
                                'last_name'  => $last_name,
                                'phone'      => $phone,
                                'email'      => $email,
                        ),
                        'shipping'             => ! empty( $shipping_methods ) ? $shipping_methods[0] : array(),
                        'shipping_info'        => $shipping_info,
                        'line_items'           => $line_items,
                );
        }

        /**
         * Extract shipping/delivery info from an order.
         *
         * Iranian WooCommerce stores use a variety of plugins to record shipment
         * details. There is no single standard — each plugin stores the data under
         * a different post meta key. This method checks all known keys and returns
         * a normalized { tracking_code, courier_name, shipping_date, tracking_link,
         * shipping_note } object.
         *
         * Supported plugins (best-effort, based on publicly documented meta keys):
         *   • WooCommerce Shipment Tracking (official) — _wc_shipment_tracking_items
         *   • Persian WooCommerce Shipping — _tracking_code, _shipping_date, ...
         *   • PWS (Persian WooCommerce) — _pws_tracking_code
         *   • Custom fields added by Iranian themes (e.g. «اطلاعات ارسال» tab)
         *
         * If multiple plugins wrote data, the first non-empty value wins (in the
         * order the meta keys are listed below).
         *
         * @param \WC_Order $order
         * @return array { tracking_code, courier_name, shipping_date, tracking_link, shipping_note }
         */
        private function get_order_shipping_info( $order ) {
                $info = array(
                        'tracking_code'  => '',
                        'courier_name'   => '',
                        'shipping_date'  => '',
                        'tracking_link'  => '',
                        'shipping_note'  => '',
                );

                if ( ! $order || ! method_exists( $order, 'get_meta' ) ) {
                        return $info;
                }

                // ─── Phase 1: well-known meta keys ──────────────────────────────────
                // We try every meta key documented by Iranian shipping plugins.
                // The first non-empty, non-zero value wins. We deliberately cast to
                // (string) because some plugins store tracking as integers.
                $tracking_keys = array(
                        // Generic WooCommerce Shipment Tracking
                        '_tracking_number',
                        '_shipment_tracking_number',
                        'tracking_number',
                        '_tracking_code',
                        // WooCommerce Shipment Tracking (official)
                        '_wc_shipment_tracking_items',
                        // Persian WooCommerce Shipping (PWS)
                        '_pws_tracking_code',
                        '_pws_tracking_number',
                        // Post.ir / Post Pishtaz plugins
                        '_post_tracking_code',
                        '_post_tracking_number',
                        '_postex_tracking_code',
                        '_postex_tracking_number',
                        '_post_code',
                        '_post_id',
                        '_pishtaz_tracking_code',
                        // Tipax (باربری تیپاکس)
                        '_tipax_tracking_code',
                        '_tipax_code',
                        '_tipax_consignment_code',
                        '_tipax_consignment',
                        '_btk_tracking_code',
                        // Chapar (باربری چاپار)
                        '_chapar_tracking_code',
                        '_chapar_code',
                        // Mahex / other Iranian shipping plugins
                        '_mahex_tracking_code',
                        '_shipping_tracking_code',
                        '_tracking_id',
                        // Themes that store tracking as a product attribute / custom field
                        'pa_tracking_code',
                        'pa_tracking_number',
                );
                foreach ( $tracking_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) && '0' !== (string) $value ) {
                                $info['tracking_code'] = trim( (string) $value );
                                break;
                        }
                }

                // WooCommerce Shipment Tracking plugin stores tracking as an array of
                // items under _wc_shipment_tracking_items. Each item has
                // tracking_number, tracking_provider, date_shipped, tracking_link.
                $items = $order->get_meta( '_wc_shipment_tracking_items', true );
                if ( is_array( $items ) && ! empty( $items ) ) {
                        // Use the FIRST item — the earliest shipment. If the store ships
                        // in multiple packages, only the first one is synced. This is a
                        // conscious trade-off: Vigent tracks the order, not individual
                        // parcels.
                        $first = reset( $items );
                        if ( is_array( $first ) ) {
                                if ( '' === $info['tracking_code'] && ! empty( $first['tracking_number'] ) ) {
                                        $info['tracking_code'] = trim( (string) $first['tracking_number'] );
                                }
                                if ( '' === $info['courier_name'] && ! empty( $first['tracking_provider'] ) ) {
                                        $info['courier_name'] = trim( (string) $first['tracking_provider'] );
                                }
                                if ( '' === $info['shipping_date'] && ! empty( $first['date_shipped'] ) ) {
                                        $info['shipping_date'] = trim( (string) $first['date_shipped'] );
                                }
                                if ( '' === $info['tracking_link'] && ! empty( $first['tracking_link'] ) ) {
                                        $info['tracking_link'] = trim( (string) $first['tracking_link'] );
                                }
                        }
                }

                // ─── Courier / shipping company name ──────────────────────────────
                // Try meta keys that store the courier name (e.g. «پست پیشتاز», «تیپاکس»).
                // The shipping method title (from $shipping_methods above) is usually
                // the same thing, but Iranian plugins often store a richer name in meta.
                $courier_keys = array(
                        '_shipping_company',
                        '_courier_name',
                        '_pws_courier_name',
                        '_shipping_courier',
                        'shipping_company',
                        '_postex_courier_name',
                        '_tipax_courier_name',
                        '_chapar_courier_name',
                        '_carrier_name',
                        '_shipping_carrier',
                        '_delivery_company',
                );
                foreach ( $courier_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
                                $info['courier_name'] = trim( (string) $value );
                                break;
                        }
                }

                // If the courier name is still empty, fall back to the shipping method
                // title from the order's shipping line. This is usually localized:
                // «پست پیشتاز», «ارسال با پست», «تیپاکس», etc.
                if ( '' === $info['courier_name'] && method_exists( $order, 'get_shipping_methods' ) ) {
                        $methods = $order->get_shipping_methods();
                        foreach ( $methods as $shipping ) {
                                $title = method_exists( $shipping, 'get_method_title' ) ? $shipping->get_method_title() : '';
                                if ( '' !== trim( (string) $title ) ) {
                                        $info['courier_name'] = trim( (string) $title );
                                        break;
                                }
                        }
                }

                // ─── Shipping date ────────────────────────────────────────────────
                // Iranian plugins store this in Jalali (e.g. «۲۶ آبان ۱۴۰۳») or as a
                // Gregorian timestamp. We pass it through as-is — the Vigent panel can
                // format it for display.
                $date_keys = array(
                        '_shipping_date',
                        '_shipment_date',
                        '_dispatch_date',
                        '_pws_shipping_date',
                        'shipping_date',
                        '_shipment_dispatch_date',
                        '_date_shipped',
                        '_shipping_dispatch_date',
                        '_tipax_shipping_date',
                        '_postex_shipping_date',
                );
                foreach ( $date_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
                                $info['shipping_date'] = trim( (string) $value );
                                break;
                        }
                }

                // ─── Tracking link ────────────────────────────────────────────────
                // Some plugins store a direct tracking URL (e.g. post.ir/?id=...).
                // If absent, we synthesize one from the tracking code for common
                // Iranian couriers.
                $link_keys = array(
                        '_tracking_link',
                        '_tracking_url',
                        '_shipment_tracking_link',
                        'tracking_link',
                        '_pws_tracking_link',
                        '_tracking_link_url',
                        '_postex_tracking_link',
                        '_tipax_tracking_link',
                );
                foreach ( $link_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
                                $info['tracking_link'] = trim( (string) $value );
                                break;
                        }
                }

                // ─── Shipping note / extra description ────────────────────────────
                $note_keys = array(
                        '_shipping_note',
                        '_shipment_note',
                        '_shipping_description',
                        'shipping_note',
                        '_delivery_note',
                        '_shipping_comment',
                        '_shipment_description',
                );
                foreach ( $note_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
                                $info['shipping_note'] = trim( (string) $value );
                                break;
                        }
                }

                // ─── Phase 2: scan order notes (BIG win for Iranian stores) ───────
                // Many Iranian shop admins do NOT use a shipping plugin — they
                // simply add a private order note when they ship the order, like:
                //   «کد رهگیری: 12345678901234 - پست پیشتاز»
                //   «ارسال با تیپاکس - کد: 1234567890»
                //   «باربری: چاپار - کد رهگیری: 1234567890123»
                // We scan ALL order notes (private + customer-visible) for these
                // patterns and extract any missing fields.
                $this->extract_shipping_from_order_notes( $order, $info );

                // ─── Phase 3: scan ALL meta keys as a last resort ────────────────
                // Some Iranian themes store tracking under completely custom keys
                // (e.g. `_mytheme_tracking`, `_custom_ship_code`). If we still don't
                // have a tracking_code, scan every meta key on the order for one that
                // LOOKS like a tracking number (13–20 digits for Iran Post, 10–14 for
                // Tipax, etc.).
                if ( '' === $info['tracking_code'] ) {
                        $this->scan_all_meta_for_tracking_code( $order, $info );
                }

                // ─── Phase 4: synthesize tracking link from the code ───────────────
                // If we now have a tracking code but no link, synthesize one for the
                // known Iranian couriers (Iran Post, Tipax, Chapar).
                if ( '' === $info['tracking_link'] && '' !== $info['tracking_code'] ) {
                        $info['tracking_link'] = $this->synthesize_tracking_link(
                                $info['tracking_code'],
                                $info['courier_name']
                        );
                }

                return $info;
        }

        /**
         * Scan WooCommerce order notes for shipping / tracking info.
         *
         * Iranian shop admins frequently skip the shipping-plugin UI and just add
         * a private note like:
         *   «کد رهگیری: 12345678901234 — پست پیشتاز — تاریخ ارسال: ۱۴۰۳/۰۸/۲۶»
         *   «ارسال با تیپاکس — کد: 1234»
         *   «باربری چاپار — کد رهگیری: 1234567890123»
         *
         * We look at every note (most recent first) and pull out any missing
         * field. Notes are an UNRELIABLE source — they may contain partial or
         * wrong info — so we only fill in fields that are still empty after the
         * meta-key pass.
         *
         * @param \WC_Order $order
         * @param array     $info  Passed by reference and mutated in place.
         * @return void
         */
        private function extract_shipping_from_order_notes( $order, &$info ) {
                if ( ! function_exists( 'wc_get_order_notes' ) ) {
                        // WooCommerce not loaded or older version — bail.
                        return;
                }

                $notes = wc_get_order_notes( array(
                        'order_id' => $order->get_id(),
                        'limit'    => 50,  // last 50 notes is plenty
                        'orderby'  => 'date_created',
                        'order'    => 'DESC',
                ) );

                if ( empty( $notes ) ) {
                        return;
                }

                foreach ( $notes as $note ) {
                        $content = is_object( $note ) && property_exists( $note, 'content' )
                                ? (string) $note->content
                                : '';
                        if ( '' === $content ) {
                                continue;
                        }

                        // Tracking code — look for «کد رهگیری», «کد», «رهگیری»,
                        // «tracking», «tracking number», etc., followed by a number.
                        if ( '' === $info['tracking_code'] ) {
                                $code = $this->extract_tracking_code_from_text( $content );
                                if ( '' !== $code ) {
                                        $info['tracking_code'] = $code;
                                }
                        }

                        // Courier name — look for «باربری», «پست», «تیپاکس»,
                        // «چاپار», «پست پیشتاز», «ارسال با», etc.
                        if ( '' === $info['courier_name'] ) {
                                $courier = $this->extract_courier_from_text( $content );
                                if ( '' !== $courier ) {
                                        $info['courier_name'] = $courier;
                                }
                        }

                        // Shipping date — look for «تاریخ ارسال», «ارسال شد»,
                        // Jalali dates like «۱۴۰۳/۰۸/۲۶» or «۲۶ آبان ۱۴۰۳».
                        if ( '' === $info['shipping_date'] ) {
                                $date = $this->extract_shipping_date_from_text( $content );
                                if ( '' !== $date ) {
                                        $info['shipping_date'] = $date;
                                }
                        }

                        // Tracking link — any URL containing «tracking» or «post.ir»
                        // or «tipax» or «chapar».
                        if ( '' === $info['tracking_link'] ) {
                                $link = $this->extract_tracking_link_from_text( $content );
                                if ( '' !== $link ) {
                                        $info['tracking_link'] = $link;
                                }
                        }

                        // Stop early once we have all five fields.
                        if ( '' !== $info['tracking_code']
                                && '' !== $info['courier_name']
                                && '' !== $info['shipping_date']
                                && '' !== $info['tracking_link']
                                && '' !== $info['shipping_note'] ) {
                                return;
                        }
                }

                // If we found a tracking code in a note but no shipping_note,
                // store the note content as the shipping_note so the agent can
                // see the original message the shop admin wrote.
                if ( '' !== $info['tracking_code'] && '' === $info['shipping_note'] ) {
                        foreach ( $notes as $note ) {
                                $content = is_object( $note ) && property_exists( $note, 'content' )
                                        ? trim( (string) $note->content )
                                        : '';
                                if ( '' !== $content && false !== stripos( $content, $info['tracking_code'] ) ) {
                                        // Use function_exists for mb_substr — some shared hosts
                                        // (especially Iranian ones) ship PHP without the mbstring
                                        // extension, and calling mb_substr() when it's not loaded
                                        // throws a fatal error that crashes the entire sync batch.
                                        if ( function_exists( 'mb_substr' ) ) {
                                                $info['shipping_note'] = mb_substr( $content, 0, 1000 );
                                        } else {
                                                $info['shipping_note'] = substr( $content, 0, 1000 );
                                        }
                                        return;
                                }
                        }
                }
        }

        /**
         * Extract a tracking number from a free-text note.
         *
         * Recognized patterns (case-insensitive):
         *   «کد رهگیری: 12345678901234»
         *   «کد: 12345678901234»
         *   «رهگیری 12345678901234»
         *   «tracking: 12345678901234»
         *   «tracking number: 12345678901234»
         *
         * Falls back to any standalone 13–20 digit number (Iran Post format),
         * then 10–14 digit alphanumeric (Tipax format).
         *
         * @param string $text
         * @return string Empty string if nothing matched.
         */
        private function extract_tracking_code_from_text( $text ) {
                $text = $text . ' ';

                // First: explicit «کد رهگیری» / «کد» / «tracking» patterns.
                $patterns = array(
                        // Persian: «کد رهگیری», «کد پیگیری», «کد» followed by digits.
                        '/(?:کد\s*(?:رهگیری|پیگیری|ارسال|مرسوله)?|رهگیری|پیگیری)\s*[:#\-–\x{00A0}\s]*\s*([0-9\x{06F0}-\x{06F9}]{6,24})/iu',
                        // English: «tracking», «tracking number», «tracking code».
                        '/(?:tracking\s*(?:number|code|#)?|shipment\s*id)\s*[:#\-–\x{00A0}\s]*\s*([0-9A-Za-z]{6,30})/iu',
                );
                foreach ( $patterns as $pattern ) {
                        // Suppress warnings — see comment in extract_courier_from_text().
                        $matched = @preg_match( $pattern, $text, $m );
                        if ( $matched && ! empty( $m[1] ) ) {
                                return $this->normalize_digits( $m[1] );
                        }
                }

                // Fallback: any standalone 13–20 digit number (Iran Post format).
                // We require it to be «standalone» (surrounded by whitespace or
                // punctuation) so we don't pick up phone numbers or prices.
                $matched = @preg_match( '/(?:^|\s|[\(\[\{,:;|])([0-9\x{06F0}-\x{06F9}]{13,20})(?:$|\s|[\)\]\},:;|\.<])/', $text, $m );
                if ( $matched && ! empty( $m[1] ) ) {
                        return $this->normalize_digits( $m[1] );
                }

                // Tipax: 10–14 digit numeric code.
                $matched = @preg_match( '/(?:^|\s|[\(\[\{,:;|])([0-9\x{06F0}-\x{06F9}]{10,12})(?:$|\s|[\)\]\},:;|\.<])/', $text, $m );
                if ( $matched && ! empty( $m[1] ) ) {
                        // Only accept if the note mentions «tipax» or «تیپاکس» to avoid
                        // matching phone numbers or order numbers.
                        $tipax_match = @preg_match( '/tipax|تیپاکس/iu', $text );
                        if ( $tipax_match ) {
                                return $this->normalize_digits( $m[1] );
                        }
                }

                return '';
        }

        /**
         * Extract a courier / shipping company name from a free-text note.
         *
         * Recognized couriers: پست پیشتاز، پست، تیپاکس، چاپار، کریتینو، اسنپ،
         * الوپست، مبیت، لجنت، etc.
         *
         * @param string $text
         * @return string
         */
        private function extract_courier_from_text( $text ) {
                $text_lower = function_exists( 'mb_strtolower' ) ? mb_strtolower( $text ) : strtolower( $text );

                // Build a regex of every known Iranian courier name. Order matters:
                // longer / more specific names first so «پست پیشتاز» wins over «پست».
                //
                // IMPORTANT: We DO NOT include «باربری» as a standalone courier — many
                // Iranian notes mention «باربری» generically (e.g. «باربری چاپار»,
                // «باربری: تیپاکس») without it being the actual courier name. We only
                // match it when followed by another known courier name (handled by
                // the `باربری\s+(?:...)` pattern below).
                $couriers = array(
                        // Persian names — longer / more specific first.
                        'پست\s*پیشتاز',
                        'پست\s*ویژه',
                        'پست\s*سفارشی',
                        'تیپاکس',
                        'چاپار',
                        'کریتینو',
                        'اسنپ\s*(?:اکسپرس|بار)?',
                        'الوپست',
                        'مبیت',
                        'لجنت',
                        // «باربری X» pattern — match "باربری تیپاکس" etc. but only
                        // capture the courier name, not «باربری» itself.
                        'باربری\s+(تیپاکس|چاپار|پست(?:\s*پیشتاز|\s*ویژه|\s*سفارشی)?)',
                        // «ارسال با X» — match "ارسال با تیپاکس" etc.
                        'ارسال\s*با\s+(تیپاکس|چاپار|پست(?:\s*پیشتاز|\s*ویژه|\s*سفارشی)?|کریتینو|اسنپ(?:\s*اکسپرس|\s*بار)?|الوپست|مبیت|لجنت)',
                        // English names (for stores with English order notes)
                        'tipax',
                        'chapar',
                        'iran\s*post',
                        'post\.ir',
                );
                // Build alternation. Capture group is the courier name when there's
                // a «باربری X» or «ارسال با X» pattern, otherwise the whole match.
                $pattern = '/(?:' . implode( '|', $couriers ) . ')/iu';
                // Suppress warnings — see comment in extract_courier_from_text() above.
                $matched = @preg_match( $pattern, $text, $m );
                if ( $matched && ! empty( $m[0] ) ) {
                        // If we have a capture group (e.g. «باربری تیپاکس» → «تیپاکس»),
                        // use it. Otherwise use the whole match.
                        $name = '';
                        for ( $i = 1; $i < count( $m ); $i++ ) {
                                if ( ! empty( $m[ $i ] ) ) {
                                        $name = $m[ $i ];
                                        break;
                                }
                        }
                        if ( '' === $name ) {
                                $name = $m[0];
                        }
                        $name = trim( $name );
                        // Normalize whitespace.
                        $name = preg_replace( '/\s+/u', ' ', $name );
                        if ( null === $name ) {
                                // preg_replace returned null — PCRE Unicode issue.
                                $name = preg_replace( '/\s+/', ' ', $m[0] );
                        }
                        return $name;
                }
                return '';
        }

        /**
         * Extract a shipping date from a free-text note.
         *
         * Recognized patterns:
         *   «۱۴۰۳/۰۸/۲۶»     — Jalali numeric date
         *   «۲۶ آبان ۱۴۰۳»   — Jalali written date
         *   «1403/08/26»     — Gregorian numeric date
         *   «2024-11-16»     — ISO date
         *
         * @param string $text
         * @return string
         */
        private function extract_shipping_date_from_text( $text ) {
                $patterns = array(
                        // Persian «تاریخ ارسال», «تاریخ» followed by a date.
                        '/(?:تاریخ\s*(?:ارسال|تحویل|پست|ترخیص)?|ارسال\s*در)\s*[:#\-–\s]*\s*([0-9\x{06F0}-\x{06F9}]{4}[\/\-.][0-9\x{06F0}-\x{06F9}]{1,2}[\/\-.][0-9\x{06F0}-\x{06F9}]{1,2})/iu',
                        // Jalali written date: «۲۶ آبان ۱۴۰۳»
                        '/([0-9\x{06F0}-\x{06F9}]{1,2}\s+[\x{0600}-\x{06FF}]{2,8}\s+[0-9\x{06F0}-\x{06F9}]{4})/u',
                        // Generic numeric date: «1403/08/26» or «2024-11-16»
                        '/\b([0-9\x{06F0}-\x{06F9}]{4}[\/\-.][0-9\x{06F0}-\x{06F9}]{1,2}[\/\-.][0-9\x{06F0}-\x{06F9}]{1,2})\b/u',
                );
                foreach ( $patterns as $pattern ) {
                        // Suppress warnings — see comment in extract_courier_from_text().
                        $matched = @preg_match( $pattern, $text, $m );
                        if ( $matched && ! empty( $m[1] ) ) {
                                return trim( $m[1] );
                        }
                }
                return '';
        }

        /**
         * Extract a tracking URL from a free-text note.
         *
         * @param string $text
         * @return string
         */
        private function extract_tracking_link_from_text( $text ) {
                // First: explicit https://... links.
                if ( preg_match_all( '#https?://[^\s<>\"\']+#i', $text, $matches ) ) {
                        foreach ( $matches[0] as $url ) {
                                $url_lower = function_exists( 'mb_strtolower' )
                                        ? mb_strtolower( $url )
                                        : strtolower( $url );
                                if ( false !== strpos( $url_lower, 'tracking' )
                                        || false !== strpos( $url_lower, 'post.ir' )
                                        || false !== strpos( $url_lower, 'tipax' )
                                        || false !== strpos( $url_lower, 'chapar' )
                                        || false !== strpos( $url_lower, 'tracking.post' ) ) {
                                        return rtrim( $url, '.,;)' );
                                }
                        }
                }
                return '';
        }

        /**
         * Scan every meta key on the order for one that looks like a tracking code.
         *
         * This is a LAST-RESORT fallback for stores that use a custom theme with
         * non-standard meta keys. We pull every meta key on the order and look
         * for values that match the Iran Post / Tipax patterns. We accept a value
         * only if it's 13–20 digits (Iran Post) or 10–14 digit alphanumeric and
         * the meta key name contains a tracking-like keyword.
         *
         * @param \WC_Order $order
         * @param array     $info  Passed by reference.
         * @return void
         */
        private function scan_all_meta_for_tracking_code( $order, &$info ) {
                if ( ! method_exists( $order, 'get_meta_data' ) ) {
                        return;
                }
                $meta_data = $order->get_meta_data();
                if ( ! is_array( $meta_data ) || empty( $meta_data ) ) {
                        return;
                }

                // Keyword whitelist: a meta key must contain at least one of these
                // substrings for us to consider its value as a tracking code.
                // This prevents us from picking up phone numbers, prices, etc.
                $key_keywords = array(
                        'track', 'ship', 'post', 'tipax', 'chapar', 'rahgiri',
                        'cod', 'consig', 'parcel', 'waybill', 'follow',
                );

                foreach ( $meta_data as $meta ) {
                        $key   = is_object( $meta ) && method_exists( $meta, 'get_data' )
                                ? (string) ( $meta->get_data()['key'] ?? '' )
                                : (string) ( $meta->key ?? '' );
                        $value = is_object( $meta ) && method_exists( $meta, 'get_data' )
                                ? (string) ( $meta->get_data()['value'] ?? '' )
                                : (string) ( $meta->value ?? '' );

                        if ( '' === $key || '' === $value || ! is_scalar( $value ) ) {
                                continue;
                        }

                        $key_lower   = strtolower( $key );
                        $value_trim  = trim( (string) $value );
                        $matches_keyword = false;
                        foreach ( $key_keywords as $kw ) {
                                if ( false !== strpos( $key_lower, $kw ) ) {
                                        $matches_keyword = true;
                                        break;
                                }
                        }
                        if ( ! $matches_keyword ) {
                                continue;
                        }

                        // Accept 13–20 digit numeric (Iran Post) or 10–14
                        // alphanumeric (Tipax-style). Use @ to suppress any PCRE
                        // warning on hosts without Unicode support.
                        $is_post_code    = @preg_match( '/^[0-9\x{06F0}-\x{06F9}]{13,20}$/', $value_trim );
                        $is_tipax_code   = @preg_match( '/^[A-Za-z0-9]{10,14}$/', $value_trim );
                        if ( $is_post_code || $is_tipax_code ) {
                                $info['tracking_code'] = $this->normalize_digits( $value_trim );
                                return;
                        }
                }
        }

        /**
         * Synthesize a tracking URL for common Iranian couriers.
         *
         * @param string $tracking_code
         * @param string $courier_name
         * @return string  Empty string if no recognized pattern.
         */
        private function synthesize_tracking_link( $tracking_code, $courier_name ) {
                $code    = trim( (string) $tracking_code );
                $courier = strtolower( (string) $courier_name );

                // Tipax.
                if ( false !== strpos( $courier, 'tipax' )
                        || false !== strpos( $courier, 'تیپاکس' ) ) {
                        return 'https://www.tipax.ir/Tracking?code=' . rawurlencode( $code );
                }

                // Chapar.
                if ( false !== strpos( $courier, 'chapar' )
                        || false !== strpos( $courier, 'چاپار' ) ) {
                        return 'https://chapar.ir/track/' . rawurlencode( $code );
                }

                // Iran Post — 13–20 digit numeric codes.
                if ( preg_match( '/^[0-9]{13,20}$/', $code ) ) {
                        return 'https://tracking.post.ir/?id=' . rawurlencode( $code );
                }

                return '';
        }

        /**
         * Convert Persian / Arabic digits in a string to plain ASCII digits.
         *
         * @param string $value
         * @return string
         */
        private function normalize_digits( $value ) {
                $persian = array( '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹' );
                $arabic  = array( '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩' );
                $ascii   = array( '0', '1', '2', '3', '4', '5', '6', '7', '8', '9' );
                $value   = str_replace( $persian, $ascii, $value );
                $value   = str_replace( $arabic, $ascii, $value );
                return $value;
        }

        /** Find a tracking number written by common WooCommerce shipment plugins. */
        private function get_order_tracking_code( $order ) {
                // Deprecated — kept for backwards compatibility. New code should call
                // get_order_shipping_info() which returns a richer object. This method
                // now delegates to get_order_shipping_info so the tracking_code logic
                // lives in exactly one place.
                $info = $this->get_order_shipping_info( $order );
                return $info['tracking_code'];
        }
}
