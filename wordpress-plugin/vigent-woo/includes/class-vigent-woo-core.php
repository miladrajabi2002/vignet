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
                                        // Vigent records the plugin version per delivery. Without this
                                        // header it only learned the version from a manual connection
                                        // test, so an auto-updated site kept reporting its old version.
                                        'X-Vigent-Plugin-Version' => defined( 'VIGENT_WOO_VERSION' ) ? VIGENT_WOO_VERSION : '',
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

                $code      = (int) wp_remote_retrieve_response_code( $response );
                $resp_body = wp_remote_retrieve_body( $response );
                $success   = $code >= 200 && $code < 300;

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

		$first_name    = method_exists( $order, 'get_billing_first_name' ) ? $order->get_billing_first_name() : '';
                $last_name  = method_exists( $order, 'get_billing_last_name' ) ? $order->get_billing_last_name() : '';
                $phone      = method_exists( $order, 'get_billing_phone' ) ? $order->get_billing_phone() : '';
		$email         = method_exists( $order, 'get_billing_email' ) ? $order->get_billing_email() : '';
		$date_created  = $order->get_date_created();
		$date_modified = method_exists( $order, 'get_date_modified' ) ? $order->get_date_modified() : null;
		$tracking_code = $this->get_order_tracking_code( $order );

                return array(
                        'id'                   => $order->get_id(),
                        'number'               => $order->get_order_number(),
                        'status'               => $order->get_status(),
                        'currency'             => $order->get_currency(),
                        'total'                => $order->get_total(),
                        'customer_id'          => $order->get_customer_id(),
                        'payment_method'       => $order->get_payment_method(),
                        'payment_method_title' => $order->get_payment_method_title(),
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
                        'line_items'           => $line_items,
		);
        }

	/** Find a tracking number written by common WooCommerce shipment plugins. */
	private function get_order_tracking_code( $order ) {
		foreach ( array( '_tracking_number', '_shipment_tracking_number', 'tracking_number' ) as $key ) {
			$value = $order->get_meta( $key, true );
			if ( is_scalar( $value ) && '' !== trim( (string) $value ) ) {
				return trim( (string) $value );
			}
		}

		$items = $order->get_meta( '_wc_shipment_tracking_items', true );
		if ( is_array( $items ) ) {
			foreach ( $items as $item ) {
				if ( is_array( $item ) && ! empty( $item['tracking_number'] ) ) {
					return trim( (string) $item['tracking_number'] );
				}
			}
		}
		return '';
	}
}
