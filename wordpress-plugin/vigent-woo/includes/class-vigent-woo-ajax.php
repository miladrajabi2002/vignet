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
		add_action( 'wp_ajax_vigent_woo_flush_delta', array( $this, 'ajax_flush_delta' ) );
		add_action( 'wp_ajax_vigent_woo_save_toggles', array( $this, 'ajax_save_toggles' ) );
		add_action( 'wp_ajax_vigent_woo_connect', array( $this, 'ajax_connect' ) );
		add_action( 'wp_ajax_vigent_woo_disconnect', array( $this, 'ajax_disconnect' ) );
		add_action( 'wp_ajax_vigent_woo_clear_retry', array( $this, 'ajax_clear_retry' ) );
		add_action( 'wp_ajax_vigent_woo_mark_pushed', array( $this, 'ajax_mark_pushed' ) );
		add_action( 'wp_ajax_vigent_woo_check_update', array( $this, 'ajax_check_update' ) );
		add_action( 'wp_ajax_vigent_woo_install_update', array( $this, 'ajax_install_update' ) );
		add_action( 'wp_ajax_vigent_woo_view_log', array( $this, 'ajax_view_log' ) );
		add_action( 'wp_ajax_vigent_woo_clear_log', array( $this, 'ajax_clear_log' ) );
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
			'connect'        => 5,
			'disconnect'     => 5,
			'mark_pushed'    => 60,
			'save_toggles'   => 60,
			'sync_batch'     => 120,
			'flush_delta'    => 30,
			'status'         => 120,
			'test'           => 10,
			'check_update'   => 15,
			'install_update' => 5,
			'view_log'       => 60,
			'clear_log'      => 30,
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
		wp_clear_scheduled_hook( 'vigent_woo_delta_flush' );
		wp_clear_scheduled_hook( 'vigent_woo_enqueue_delta_retry' );
		update_option( Vigent_Woo_Sync::DELTA_QUEUE_OPTION, array(), false );

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
		if ( ! $this->check_rate_limit( 'status' ) ) {
			wp_send_json_error( array( 'message' => __( 'لطفاً کمی بعد دوباره تلاش کنید.', 'vigent-woo' ) ), 429 );
		}
		$status     = $this->core()->get_connection_status();
		$configured = $this->core()->is_configured();
		$delta      = Vigent_Woo_Sync::instance()->get_delta_status();
		wp_send_json_success( array_merge( $status, $delta, array( 'configured' => $configured ) ) );
	}

	public function ajax_test() {
		$this->verify_nonce();
		if ( ! $this->check_rate_limit( 'test' ) ) {
			wp_send_json_error( array( 'message' => __( 'لطفاً کمی بعد دوباره تلاش کنید.', 'vigent-woo' ) ), 429 );
		}
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
		if ( ! $this->check_rate_limit( 'sync_batch' ) ) {
			wp_send_json_error( array( 'message' => __( 'تعداد درخواست‌ها بیش از حد مجاز است.', 'vigent-woo' ) ), 429 );
		}
		$kind   = isset( $_POST['kind'] ) ? sanitize_text_field( wp_unslash( $_POST['kind'] ) ) : '';
		$offset = isset( $_POST['offset'] ) ? max( 0, (int) $_POST['offset'] ) : 0;
		$filter = isset( $_POST['filter'] ) ? json_decode( wp_unslash( $_POST['filter'] ), true ) : array();
		if ( ! is_array( $filter ) ) {
			$filter = array();
		}
		if ( ! in_array( $kind, array( 'products', 'orders' ), true ) ) {
			wp_send_json_error( array( 'message' => __( 'نوع نامعتبر.', 'vigent-woo' ) ) );
		}
		$result = Vigent_Woo_Sync::instance()->sync_batch( $kind, $offset, 50, $filter );
		wp_send_json_success( $result );
	}

	public function ajax_flush_delta() {
		$this->verify_nonce();
		if ( ! $this->check_rate_limit( 'flush_delta' ) ) {
			wp_send_json_error( array( 'message' => __( 'لطفاً کمی بعد دوباره تلاش کنید.', 'vigent-woo' ) ), 429 );
		}
		$result = Vigent_Woo_Sync::instance()->flush_delta_queue( 50 );
		if ( ! empty( $result['success'] ) ) {
			wp_send_json_success( $result );
		}
		wp_send_json_error( $result, 502 );
	}

	public function ajax_save_toggles() {
		$this->verify_nonce();
		if ( ! $this->check_rate_limit( 'save_toggles' ) ) {
			wp_send_json_error( array( 'message' => __( 'لطفاً کمی بعد دوباره تلاش کنید.', 'vigent-woo' ) ), 429 );
		}
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
		if ( ! $this->check_rate_limit( 'mark_pushed' ) ) {
			wp_send_json_error( array( 'message' => __( 'لطفاً کمی بعد دوباره تلاش کنید.', 'vigent-woo' ) ), 429 );
		}
		update_option( 'vigent_woo_initial_push_done', 1 );
		wp_send_json_success( array( 'message' => __( 'ثبت شد.', 'vigent-woo' ) ) );
	}

	/**
	 * AJAX: View the debug log (last N lines).
	 *
	 * Returns the tail of wp-content/uploads/vigent-woo-logs/debug.log so the
	 * admin can diagnose sync failures without FTP access. The log contains
	 * every send_event request with topic, body size, HTTP code, response body
	 * (truncated), and duration.
	 */
	public function ajax_view_log() {
		$this->verify_nonce();
		if ( ! $this->check_rate_limit( 'view_log' ) ) {
			wp_send_json_error( array( 'message' => __( 'تعداد درخواست‌ها بیش از حد مجاز است.', 'vigent-woo' ) ), 429 );
		}
		$lines = isset( $_POST['lines'] ) ? max( 50, min( 1000, (int) $_POST['lines'] ) ) : 200;
		$log   = $this->core()->read_debug_log( $lines );
		$file  = $this->core()->get_debug_log_file();
		wp_send_json_success( array(
			'log'  => $log,
			'file' => $file,
		) );
	}

	/**
	 * AJAX: Clear (truncate) the debug log file.
	 */
	public function ajax_clear_log() {
		$this->verify_nonce();
		if ( ! $this->check_rate_limit( 'clear_log' ) ) {
			wp_send_json_error( array( 'message' => __( 'تعداد درخواست‌ها بیش از حد مجاز است.', 'vigent-woo' ) ), 429 );
		}
		$ok = $this->core()->clear_debug_log();
		if ( ! $ok ) {
			wp_send_json_error( array( 'message' => __( "پاک‌سازی لاگ ناموفق بود. ممکن است پوشه uploads قابل نوشتن نباشد.", 'vigent-woo' ) ), 500 );
		}
		wp_send_json_success( array( 'message' => __( 'لاگ پاک شد.', 'vigent-woo' ) ) );
	}

	/**
	 * AJAX: Check for a plugin update against the Vigent server.
	 *
	 * Bypasses the 6-hour cache so the user gets an immediate answer
	 * when they click the "بررسی بروزرسانی" button. Rate-limited to 15
	 * checks per 10 minutes per IP — generous enough for normal use,
	 * tight enough that a hijacked session can't DOS the endpoint.
	 *
	 * Response shape (success):
	 *   {
	 *     "success": true,
	 *     "data": {
	 *       "update_available": bool,
	 *       "current_version": "4.1.0",
	 *       "latest_version":  "4.2.0",
	 *       "message": "نسخه جدید 4.2.0 موجود است...",
	 *       "download_url": "https://vigent.ir/...",
	 *       "install_url": "https://example.com/wp-admin/update-core.php?action=upgrade-plugin&plugin=vigent-woo/vigent-woo.php&_wpnonce=..."
	 *     }
	 *   }
	 *
	 * If an update is available, we also build an `install_url` that
	 * points at WP's native `update-core.php` with the plugin-upgrade
	 * action + a fresh nonce. The plugin's UI uses this URL for the
	 * "نصب بروزرسانی" button so the actual install runs through
	 * WordPress Core's upgrader (no custom install code on our side).
	 */
	public function ajax_check_update() {
		$this->verify_nonce();
		if ( ! $this->check_rate_limit( 'check_update' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'تعداد درخواست‌ها بیش از حد مجاز است. ۱۰ دقیقه دیگر تلاش کنید.', 'vigent-woo' ) ),
				429
			);
		}

		if ( ! class_exists( 'Vigent_Woo_Updater' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'ماژول بروزرسانی بارگذاری نشده است.', 'vigent-woo' ) ),
				500
			);
		}

		$result = Vigent_Woo_Updater::instance()->manual_check();

		// Build the WP-native install URL when an update exists.
		// This is the FALLBACK URL used only if our custom AJAX
		// installer (ajax_install_update) fails. We use update.php
		// (NOT update-core.php) because update.php is the actual
		// upgrade runner that shows the standard progress UI;
		// update-core.php just lists available updates and was
		// producing a blank page for some users.
		if ( ! empty( $result['update_available'] ) ) {
			$result['fallback_install_url'] = wp_nonce_url(
				admin_url( 'update.php?action=upgrade-plugin&plugin=' . rawurlencode( Vigent_Woo_Updater::plugin_file() ) ),
				'upgrade-plugin_' . Vigent_Woo_Updater::plugin_file()
			);

			// Also force-refresh WP's update transient so both
			// our AJAX installer AND the fallback URL can find
			// the package URL on the first click.
			delete_site_transient( 'update_plugins' );
			wp_update_plugins();
		}

		// Include last-auto-check metadata so the UI can show
		// "آخرین بررسی خودکار: ۱۴۰۳/۰۵/۰۱ ۱۲:۳۰". The manual check
		// itself doesn't update this option (only the daily cron
		// does), so the value reflects the most recent 24h tick.
		$result['last_auto_check'] = Vigent_Woo_Updater::instance()->get_last_check();
		// Next-scheduled timestamp for the daily cron — lets the UI
		// show "بررسی بعدی: ۱۴:۳۰" so the user knows when the next
		// automatic check will happen.
		$next_ts = wp_next_scheduled( 'vigent_woo_daily_update_check' );
		$result['next_auto_check_ts'] = $next_ts ? (int) $next_ts : 0;

		wp_send_json( array( 'success' => $result['success'], 'data' => $result ) );
	}

	/**
	 * AJAX: Install the latest plugin update using WP Core's Plugin_Upgrader.
	 *
	 * This is the primary install path — the user clicks "نصب بروزرسانی"
	 * in the banner, JS calls this endpoint, and we use WP Core's own
	 * Plugin_Upgrader (the same code that powers the Plugins screen's
	 * "Update now" link) to download the ZIP from the Vigent server
	 * and replace the plugin files in place.
	 *
	 * Why we do this instead of redirecting to update-core.php:
	 *   - update-core.php?action=upgrade-plugin shows a blank page on
	 *     some WP installs because that action isn't a real upgrade
	 *     runner — it's just the list-of-updates page. The correct
	 *     page is update.php?action=upgrade-plugin.
	 *   - But even update.php does a full page navigation. With our
	 *     own AJAX installer we get:
	 *       1. In-page progress (spinner on the button)
	 *       2. No navigation/disorientation
	 *       3. Custom error messages in Persian
	 *       4. Automatic page reload on success
	 *
	 * If this endpoint fails (most commonly because the site needs
	 * FTP credentials and the user hasn't entered them), the JS
	 * offers the fallback URL to update.php.
	 *
	 * Rate-limited to 5 attempts per 10 minutes per IP — the same
	 * window as connect/disconnect, since this is a write operation.
	 */
	public function ajax_install_update() {
		$this->verify_nonce();
		if ( ! current_user_can( 'update_plugins' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'دسترسی غیرمجاز — نیاز به مجوز بروزرسانی افزونه‌ها.', 'vigent-woo' ) ),
				403
			);
		}
		if ( ! $this->check_rate_limit( 'install_update' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'تعداد درخواست‌ها بیش از حد مجاز است. ۱۰ دقیقه دیگر تلاش کنید.', 'vigent-woo' ) ),
				429
			);
		}
		if ( ! class_exists( 'Vigent_Woo_Updater' ) ) {
			wp_send_json_error(
				array( 'message' => __( 'ماژول بروزرسانی بارگذاری نشده است.', 'vigent-woo' ) ),
				500
			);
		}

		// Force-refresh the update transient so the upgrader can find
		// the package URL. Without this, get_site_transient('update_plugins')
		// might still hold the old (no-update) state and Plugin_Upgrader
		// would return false ("up_to_date") immediately.
		delete_site_transient( 'update_plugins' );
		wp_update_plugins();

		// Verify the transient now has our update info.
		$current = get_site_transient( 'update_plugins' );
		if ( ! is_object( $current ) || ! isset( $current->response[ Vigent_Woo_Updater::plugin_file() ] ) ) {
			wp_send_json_error(
				array( 'message' => __( 'بروزرسانی در زمان مقرر یافت نشد. چند ثانیه دیگر دوباره دکمه «بررسی بروزرسانی» را بزنید.', 'vigent-woo' ) ),
				500
			);
		}

		// Bootstrap WP Core's upgrader classes.
		if ( ! class_exists( 'WP_Ajax_Upgrader_Skin' ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		}
		if ( ! function_exists( 'request_filesystem_credentials' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		if ( ! function_exists( 'get_plugin_data' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		// Run the upgrade. WP_Ajax_Upgrader_Skin is designed for
		// AJAX use — it doesn't print HTML, just collects feedback
		// and errors. If anything fails (filesystem creds, download,
		// unzip, etc.) we get a WP_Error back.
		$skin     = new WP_Ajax_Upgrader_Skin();
		$upgrader = new Plugin_Upgrader( $skin );
		$result   = $upgrader->upgrade( Vigent_Woo_Updater::plugin_file() );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error(
				array(
					'message' => sprintf(
						/* translators: %s: error message */
						__( 'خطا در نصب بروزرسانی: %s', 'vigent-woo' ),
						$result->get_error_message()
					),
				),
				500
			);
		}

		if ( false === $result ) {
			// The upgrader returned false — usually means no update
			// was found in the transient (race condition) OR the
			// filesystem method isn't 'direct' (needs FTP creds).
			$fs_method = function_exists( 'get_filesystem_method' ) ? get_filesystem_method() : 'unknown';
			$msg = 'direct' === $fs_method
				? __( 'بروزرسانی انجام نشد. لطفاً دوباره دکمه «بررسی بروزرسانی» را بزنید و امتحان کنید.', 'vigent-woo' )
				: sprintf(
					/* translators: %s: filesystem method */
					__( 'روش فایل‌سیستم این هاست (%s) نیاز به اطلاعات FTP دارد. از روش جایگزین وردپرس استفاده کنید.', 'vigent-woo' ),
					$fs_method
				);
			wp_send_json_error( array( 'message' => $msg ), 500 );
		}

		// Success — read the new version from the freshly-installed
		// plugin header. This is more reliable than trusting the
		// remote info (which might have been cached).
		$new_version = VIGENT_WOO_VERSION;
		$plugin_path = WP_PLUGIN_DIR . '/' . Vigent_Woo_Updater::plugin_file();
		if ( file_exists( $plugin_path ) ) {
			$plugin_data = get_plugin_data( $plugin_path, false, false );
			if ( ! empty( $plugin_data['Version'] ) ) {
				$new_version = $plugin_data['Version'];
			}
		}

		// Clear our update-info cache so the next check is fresh.
		delete_transient( 'vigent_woo_update_info' );
		delete_option( 'vigent_woo_last_update_check' );

		// Reactivate the plugin if it was active before the upgrade
		// (Plugin_Upgrader preserves activation state, but be defensive).
		if ( ! is_plugin_active( Vigent_Woo_Updater::plugin_file() ) ) {
			activate_plugin( Vigent_Woo_Updater::plugin_file() );
		}

		wp_send_json_success( array(
			'message'     => sprintf(
				/* translators: %s: new version number */
				__( 'افزونه با موفقیت به نسخه %s بروزرسانی شد.', 'vigent-woo' ),
				$new_version
			),
			'new_version' => $new_version,
		) );
	}
}
