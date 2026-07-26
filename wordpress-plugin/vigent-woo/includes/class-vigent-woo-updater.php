<?php
/**
 * Plugin updater — checks https://vigent.ir/api/wordpress-plugin/info for new
 * versions and integrates with WordPress's native update system.
 *
 * How it works:
 *  1. WordPress runs `wp_update_plugins()` on a 12-hour cron. That function
 *     builds a `$transient->checked` map of slug => installed version, then
 *     passes the empty `$transient->response` through the
 *     `pre_set_site_transient_update_plugins` filter.
 *  2. We hook that filter, fetch the latest version info from the Vigent
 *     server (cached for 6 hours in a transient), and if the remote version
 *     is newer than VIGENT_WOO_VERSION we inject a stdClass into
 *     `$transient->response[ $plugin_file ]` so WordPress shows the update
 *     on the Plugins page (yellow banner + "update now" link).
 *  3. We also hook `plugins_api` so when the user clicks "View version x.y.z
 *     details" they see a proper modal with the changelog fetched from the
 *     same endpoint.
 *  4. The admin page exposes a manual "بررسی بروزرسانی" button. Clicking it
 *     calls `vigent_woo_check_update` AJAX → `manual_check()` → forces a
 *     fresh fetch (bypasses the cache) and returns a status payload. If a
 *     new version is available, the JS also triggers the WordPress
 *     `wp-ajax` updater flow so the user can install it from inside the
 *     plugin's own page (not just the Plugins screen).
 *
 * Security: the download_url comes from our own server (vigent.ir), so we
 * trust it the same way we trust the webhook-url lookup. WordPress still
 * validates the zip integrity and runs the standard install flow.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit;
}

class Vigent_Woo_Updater {

        private static $instance = null;

        /**
         * Endpoint that returns the latest plugin info as JSON.
         * Must match the route registered in the Next.js app:
         * app/api/wordpress-plugin/info/route.ts
         */
        const API_URL = 'https://vigent.ir/api/wordpress-plugin/info';

        /**
         * Plugin slug (folder name). Used by WordPress to match installed
         * plugins against update-transient entries.
         */
        const SLUG = 'vigent-woo';

        /**
         * Full plugin file path relative to wp-content/plugins/.
         * WordPress uses this as the key in $transient->response.
         */
	const PLUGIN_FILE = 'vigent-woo/vigent-woo.php';

	/** Resolve the installed basename even when the folder was renamed. */
	public static function plugin_file() {
		return defined( 'VIGENT_WOO_FILE' ) ? plugin_basename( VIGENT_WOO_FILE ) : self::PLUGIN_FILE;
	}

        public static function instance() {
                if ( null === self::$instance ) {
                        self::$instance = new self();
                }
                return self::$instance;
        }

        private function __construct() {
                // Hook into WordPress's update transient.
                add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'filter_update_transient' ) );
                // Hook into the plugin-information modal (View details link).
                add_filter( 'plugins_api', array( $this, 'filter_plugins_api' ), 20, 3 );
                // Clear our cache after a successful update so the next check is fresh.
                add_action( 'upgrader_process_complete', array( $this, 'on_upgrader_complete' ), 10, 2 );
                // Show a custom "update available" notice on the plugin's own admin page.
                add_action( 'admin_notices', array( $this, 'maybe_show_update_notice' ) );
                // Cron — چک خودکار هر ۲۴ ساعت.
                // این cron به‌صورت اختصاصی پیاده‌سازی شده تا مستقل از چک پیش‌فرض
                // وردپرس (که هر ۱۲ ساعت است) عمل کنه و cache رو force-refresh کنه.
                add_action( 'vigent_woo_daily_update_check', array( $this, 'daily_check' ) );
        }

        // ─── Public API used by the AJAX layer ───────────────────────────────

        /**
         * Cron callback — چک خودکار روزانه بروزرسانی.
         *
         * این متد هر ۲۴ ساعت یک‌بار توسط WP-Cron اجرا می‌شه (cron event
         * `vigent_woo_daily_update_check`). کارهای زیر رو انجام می‌ده:
         *
         *   1. fetch_latest_info( true ) — اطلاعات نسخه رو از سرور ویجنت با
         *      bypass کش می‌خونه (force_refresh).
         *   2. در صورت وجود نسخه جدید، transient بروزرسانی‌های وردپرس رو
         *      پاک می‌کنه تا در بار بعدی wp_update_plugins اطلاعات جدید ما
         *      وارد transient بشه و بنر آپدیت در صفحه Plugins نمایش داده بشه.
         *   3. اطلاعاتی مثل آخرین زمان چک و نسخه آخرین بررسی‌شده رو در یک
         *      option ذخیره می‌کنه تا در پنل افزونه نمایش بدیم.
         *
         * این متد silent هست — هیچ alert یا notice‌ای به کاربر نمایش نمی‌ده.
         * فقط در صورت وجود بروزرسانی، بنر زرد وردپرس در صفحه Plugins
         * نشون داده می‌شه و در پنل افزونه هم notice آبی نشون داده می‌شه.
         *
         * @return void
         */
        public function daily_check() {
                // اطلاعات جدید رو از سرور بگیر (بدون کش).
                $info = $this->fetch_latest_info( true );

                // ذخیره آخرین زمان چک و آخرین نسخه دیده‌شده برای نمایش در پنل.
                $last_check = array(
                        'checked_at'   => current_time( 'mysql' ),
                        'checked_at_ts' => time(),
                        'latest_version' => is_array( $info ) && ! empty( $info['version'] )
                                ? $info['version']
                                : '',
                        'current_version' => VIGENT_WOO_VERSION,
                        'update_available' => is_array( $info ) && ! empty( $info['version'] )
                                ? version_compare( VIGENT_WOO_VERSION, $info['version'], '<' )
                                : false,
                );
                update_option( 'vigent_woo_last_update_check', $last_check, false );

                // اگر نسخه جدید پیدا شد، transient وردپرس رو پاک کن تا در بار
                // بعدی wp_update_plugins اطلاعات جدید ما واردش بشه.
                if ( $last_check['update_available'] ) {
                        delete_site_transient( 'update_plugins' );
                        // force WP to re-build the transient on next admin page-load.
                        // wp_update_plugins() خودش در قالب pre_set_site_transient_update_plugins
                        // از filter_update_transient ما رد می‌شه و اطلاعات ما رو می‌خونه.
                        wp_update_plugins();
                }
        }

        /**
         * Get the last automatic check metadata (for UI display).
         *
         * @return array|false داده‌های ذخیره‌شده، یا false اگر هنوز چکی انجام نشده.
         */
        public function get_last_check() {
                $data = get_option( 'vigent_woo_last_update_check', false );
                if ( ! is_array( $data ) ) {
                        return false;
                }
                return $data;
        }

        /**
         * Force a fresh check (bypass cache). Called by `vigent_woo_check_update`.
         *
         * @return array {
         *   @type bool   $success
         *   @type bool   $update_available
         *   @type string $current_version
         *   @type string $latest_version
         *   @type string $message       Localized status message (fa-IR).
         *   @type string $download_url  Empty unless an update is available.
         * }
         */
        public function manual_check() {
                $info = $this->fetch_latest_info( true );
                if ( ! $info ) {
                        return array(
                                'success'         => false,
                                'update_available' => false,
                                'current_version' => VIGENT_WOO_VERSION,
                                'latest_version'  => VIGENT_WOO_VERSION,
                                'message'         => __( 'خطا در ارتباط با سرور ویجنت. چند لحظه دیگر تلاش کنید.', 'vigent-woo' ),
                                'download_url'    => '',
                        );
                }

                $latest = isset( $info['version'] ) ? (string) $info['version'] : '0.0.0';

                if ( version_compare( VIGENT_WOO_VERSION, $latest, '>=' ) ) {
                        return array(
                                'success'          => true,
                                'update_available' => false,
                                'current_version'  => VIGENT_WOO_VERSION,
                                'latest_version'   => $latest,
                                'message'          => sprintf(
                                        /* translators: %s: version number */
                                        __( 'شما از آخرین نسخه (%s) استفاده می‌کنید.', 'vigent-woo' ),
                                        VIGENT_WOO_VERSION
                                ),
                                'download_url'     => '',
                        );
                }

                return array(
                        'success'          => true,
                        'update_available' => true,
                        'current_version'  => VIGENT_WOO_VERSION,
                        'latest_version'   => $latest,
                        'message'          => sprintf(
                                /* translators: %s: new version number */
                                __( 'نسخه جدید %s موجود است. روی «نصب بروزرسانی» بزنید.', 'vigent-woo' ),
                                $latest
                        ),
                        'download_url'     => isset( $info['download_url'] ) ? $info['download_url'] : '',
                        'info'             => $info,
                );
        }

        // ─── WordPress hooks ─────────────────────────────────────────────────

        /**
         * Filter `pre_set_site_transient_update_plugins`.
         *
         * Adds our plugin to the response map if a newer version exists on
         * the Vigent server. WordPress then shows the standard yellow
         * "update available" row on the Plugins screen.
         *
         * @param object $transient The update_plugins transient.
         * @return object Mutated transient.
         */
        public function filter_update_transient( $transient ) {
                if ( empty( $transient ) || ! isset( $transient->checked ) ) {
                        return $transient;
                }

                $info = $this->fetch_latest_info();
                if ( ! $info || empty( $info['version'] ) ) {
                        return $transient;
                }

                // No update needed.
                if ( version_compare( VIGENT_WOO_VERSION, $info['version'], '>=' ) ) {
                        // Mark as "no update" so WP doesn't keep re-checking.
                        $no_update            = new stdClass();
			$no_update->id        = self::plugin_file();
                        $no_update->slug      = self::SLUG;
			$no_update->plugin    = self::plugin_file();
                        $no_update->new_version = VIGENT_WOO_VERSION;
                        $no_update->url       = isset( $info['homepage'] ) ? $info['homepage'] : 'https://vigent.ir';
                        $no_update->package   = '';
                        $no_update->tested    = isset( $info['tested'] ) ? $info['tested'] : '';
                        $no_update->requires  = isset( $info['requires'] ) ? $info['requires'] : '';
                        $no_update->requires_php = isset( $info['requires_php'] ) ? $info['requires_php'] : '';
			$transient->no_update[ self::plugin_file() ] = $no_update;
                        return $transient;
                }

                // Build the update object — these fields are the ones
                // WP-Core actually reads when rendering the Plugins screen.
                $obj                  = new stdClass();
		$obj->id              = self::plugin_file();
                $obj->slug            = self::SLUG;
		$obj->plugin          = self::plugin_file();
                $obj->new_version     = sanitize_text_field( $info['version'] );
                $obj->url             = isset( $info['homepage'] ) ? esc_url_raw( $info['homepage'] ) : 'https://vigent.ir';
                $obj->package         = isset( $info['download_url'] ) ? esc_url_raw( $info['download_url'] ) : '';
                $obj->tested          = isset( $info['tested'] ) ? sanitize_text_field( $info['tested'] ) : '';
                $obj->requires        = isset( $info['requires'] ) ? sanitize_text_field( $info['requires'] ) : '';
                $obj->requires_php    = isset( $info['requires_php'] ) ? sanitize_text_field( $info['requires_php'] ) : '';
                $obj->icons           = array();
                $obj->banners         = array();
                $obj->banners_rtl     = array();

		$transient->response[ self::plugin_file() ] = $obj;
                return $transient;
        }

        /**
         * Filter `plugins_api` — feeds the "View details" modal.
         *
         * Called when the user clicks "View version x.y.z details" on the
         * Plugins screen. We only respond when the requested slug is ours.
         *
         * @param false|object|array $result
         * @param string             $action  'plugin_information'
         * @param object             $args
         * @return false|object
         */
        public function filter_plugins_api( $result, $action, $args ) {
                if ( 'plugin_information' !== $action ) {
                        return $result;
                }
                if ( ! isset( $args->slug ) || self::SLUG !== $args->slug ) {
                        return $result;
                }

                $info = $this->fetch_latest_info();
                if ( ! $info ) {
                        return $result;
                }

                $obj                  = new stdClass();
                $obj->name            = isset( $info['name'] ) ? $info['name'] : 'Vigent WooCommerce';
                $obj->slug            = self::SLUG;
                $obj->version         = isset( $info['version'] ) ? $info['version'] : '';
                $obj->author          = isset( $info['author'] ) ? $info['author'] : 'Vigent';
                $obj->author_profile  = isset( $info['author_profile'] ) ? $info['author_profile'] : 'https://vigent.ir';
                $obj->homepage        = isset( $info['homepage'] ) ? $info['homepage'] : 'https://vigent.ir';
                $obj->download_link   = isset( $info['download_url'] ) ? $info['download_url'] : '';
                $obj->tested          = isset( $info['tested'] ) ? $info['tested'] : '';
                $obj->requires        = isset( $info['requires'] ) ? $info['requires'] : '';
                $obj->requires_php    = isset( $info['requires_php'] ) ? $info['requires_php'] : '';
                $obj->last_updated    = isset( $info['last_updated'] ) ? $info['last_updated'] : '';
                $obj->sections        = isset( $info['sections'] ) && is_array( $info['sections'] )
                        ? $info['sections']
                        : array(
                                'description' => __( 'افزونه ویجنت برای وردپرس و ووکامرس.', 'vigent-woo' ),
                                'changelog'   => '',
                        );
                $obj->icons   = array();
                $obj->banners = array();
                return $obj;
        }

        /**
         * Action `upgrader_process_complete` — clear our cache after a
         * successful update so the next transient-refresh sees the new
         * version immediately.
         *
         * @param WP_Upgrader $upgrader
         * @param array       $options { action, type, plugins, ... }
         */
        public function on_upgrader_complete( $upgrader, $options ) {
                if ( ! is_array( $options ) ) {
                        return;
                }
                if ( 'update' !== $options['action'] || 'plugin' !== $options['type'] ) {
                        return;
                }
                if ( empty( $options['plugins'] ) || ! is_array( $options['plugins'] ) ) {
                        return;
                }
		if ( ! in_array( self::plugin_file(), $options['plugins'], true ) ) {
                        return;
                }
                delete_transient( 'vigent_woo_update_info' );
        }

        /**
         * Show an "update available" notice on the plugin's own admin page.
         *
         * This mirrors the yellow banner on the Plugins screen, but appears
         * inside the Vigent admin page so users who live in that screen
         * still see the prompt. The notice is rendered as a dismissible
         * WP-style admin notice (only on `toplevel_page_vigent-woo`).
         */
        public function maybe_show_update_notice() {
                $screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
                if ( ! $screen || 'toplevel_page_vigent-woo' !== $screen->id ) {
                        return;
                }
                $info = $this->fetch_latest_info();
                if ( ! $info || empty( $info['version'] ) ) {
                        return;
                }
                if ( version_compare( VIGENT_WOO_VERSION, $info['version'], '>=' ) ) {
                        return;
                }
                $latest = esc_html( $info['version'] );
                $plugins_url = esc_url( admin_url( 'plugins.php' ) );
                ?>
                <div class="notice notice-info is-dismissible" style="border-inline-start-color:#000;">
                        <p>
                                <strong><?php printf( esc_html__( 'بروزرسانی افزونه ویجنت (%s) موجود است.', 'vigent-woo' ), $latest ); ?></strong>
                                <a href="<?php echo $plugins_url; ?>" class="button button-primary" style="margin-inline-start:8px;vertical-align:baseline;">
                                        <?php esc_html_e( 'نصب بروزرسانی', 'vigent-woo' ); ?>
                                </a>
                        </p>
                </div>
                <?php
        }

        // ─── Internal helpers ────────────────────────────────────────────────

        /**
         * Fetch the latest plugin info from the Vigent server.
         *
         * Result is cached in a transient for 6 hours to avoid hammering
         * the server. Pass `true` to bypass the cache (used by the manual
         * "check for updates" button).
         *
         * @param bool $force_refresh
         * @return array|false Parsed JSON array, or false on failure.
         */
        public function fetch_latest_info( $force_refresh = false ) {
                $cache_key = 'vigent_woo_update_info';

                if ( ! $force_refresh ) {
                        $cached = get_transient( $cache_key );
                        if ( $cached && is_array( $cached ) && ! empty( $cached['version'] ) ) {
                                return $cached;
                        }
                }

                $response = wp_remote_get( self::API_URL, array(
                        'timeout' => 15,
                        'headers' => array(
                                'Accept' => 'application/json',
                        ),
                ) );

                if ( is_wp_error( $response ) ) {
                        return false;
                }

                $code = (int) wp_remote_retrieve_response_code( $response );
                $body = wp_remote_retrieve_body( $response );
                $data = json_decode( $body, true );

                if ( 200 !== $code || ! is_array( $data ) || empty( $data['version'] ) ) {
                        return false;
                }

                // Cache for 6 hours — long enough to be cheap, short enough
                // to pick up a hot-fix release within a reasonable window.
                set_transient( $cache_key, $data, 6 * HOUR_IN_SECONDS );

                return $data;
        }
}
