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
                        'webhook_url'    => '',
                        'webhook_secret' => '',
                        'sync_products'  => '1',
                        'sync_orders'    => '1',
                        'enable_retry'   => '1',
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
                        'permalink'         => $product->get_permalink(),
                        'date_modified'     => $date_modified ? $date_modified->date( 'c' ) : null,
                        'date_modified_gmt' => $date_modified ? gmdate( 'c', $date_modified->getTimestamp() ) : null,
                        'images'            => $images,
                        'attributes'        => $attrs,
                        'tags'              => $tags,
                        'categories'        => $categories,
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

                // ─── Tracking code ────────────────────────────────────────────────
                // Try every known meta key. The first non-empty, non-zero value wins.
                $tracking_keys = array(
                        '_tracking_number',
                        '_shipment_tracking_number',
                        'tracking_number',
                        '_tracking_code',
                        '_pws_tracking_code',
                        '_post_tracking_code',
                        '_postex_tracking_code',
                        'pa_tracking_code',           // some themes store as attribute
                );
                foreach ( $tracking_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
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
                );
                foreach ( $link_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
                                $info['tracking_link'] = trim( (string) $value );
                                break;
                        }
                }
                // Synthesize a link for پست (Iran Post) if we have a tracking code but
                // no link. The Post.ir tracking URL format is well-known.
                if ( '' === $info['tracking_link'] && '' !== $info['tracking_code'] ) {
                        $tc = $info['tracking_code'];
                        // Iranian Post tracking codes are 13–20 digits.
                        if ( preg_match( '/^\d{13,20}$/', $tc ) ) {
                                $info['tracking_link'] = 'https://tracking.post.ir/?id=' . $tc;
                        }
                }

                // ─── Shipping note / extra description ────────────────────────────
                $note_keys = array(
                        '_shipping_note',
                        '_shipment_note',
                        '_shipping_description',
                        'shipping_note',
                        '_delivery_note',
                );
                foreach ( $note_keys as $key ) {
                        $value = $order->get_meta( $key, true );
                        if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
                                $info['shipping_note'] = trim( (string) $value );
                                break;
                        }
                }

                return $info;
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
