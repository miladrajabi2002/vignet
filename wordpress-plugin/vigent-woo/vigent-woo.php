<?php
/**
 * Plugin Name:       ویجنت — اتصال وردپرس و ووکامرس
 * Plugin URI:        https://vigent.ir/docs/woocommerce
 * Description:       سایت وردپرس شما را به ایجنت هوشمند ویجنت متصل می‌کند و محصولات و سفارش‌ها را همگام می‌سازد.
 * Version:           4.2.5
 * Update URI:        https://vigent.ir/api/wordpress-plugin/info
 * Author:            Vigent
 * Author URI:        https://vigent.ir
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       vigent-woo
 * Domain Path:       /languages
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * WC requires at least: 6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit;
}

define( 'VIGENT_WOO_VERSION', '4.2.5' );
define( 'VIGENT_WOO_FILE', __FILE__ );
define( 'VIGENT_WOO_OPTION', 'vigent_woo_settings' );
define( 'VIGENT_WOO_NONCE', 'vigent_woo_nonce' );

// ─── بارگذاری کلاس‌ها (با چک امنیتی) ─────────────────────────────────────

$vg_includes = array(
        __DIR__ . '/includes/class-vigent-woo-core.php',
        __DIR__ . '/includes/class-vigent-woo-sync.php',
        __DIR__ . '/includes/class-vigent-woo-rest.php',
        __DIR__ . '/includes/class-vigent-woo-admin.php',
        __DIR__ . '/includes/class-vigent-woo-ajax.php',
        __DIR__ . '/includes/class-vigent-woo-updater.php',
);

foreach ( $vg_includes as $vg_file ) {
        if ( file_exists( $vg_file ) ) {
                require_once $vg_file;
        }
}

// ─── فعال‌سازی (ساده و امن) ────────────────────────────────────────────────

/**
 * Activation hook — فقط کارهای حداقلی انجام می‌دهد.
 * cron scheduling به admin_init منتقل شده تا از خطای activation جلوگیری شود.
 */
function vigent_woo_activate() {
        // تنظیمات پیش‌فرض.
        if ( false === get_option( VIGENT_WOO_OPTION ) ) {
                add_option(
                        VIGENT_WOO_OPTION,
                        array(
                                'webhook_url'    => '',
                                'webhook_secret' => '',
                                'sync_products'  => '1',
                                'sync_orders'    => '1',
                                'enable_retry'   => '1',
                        )
                );
        }

        // صف retry.
        if ( false === get_option( 'vigent_woo_retry_queue' ) ) {
                add_option( 'vigent_woo_retry_queue', array(), '', 'no' );
        }

        // صف تجمیعی تغییرات؛ autoload خاموش است تا روی همه درخواست‌های سایت بار نشود.
        if ( false === get_option( 'vigent_woo_delta_queue' ) ) {
                add_option( 'vigent_woo_delta_queue', array(), '', 'no' );
        }

        // پاک‌سازی cron‌های قدیمی (از نسخه‌های قبلی).
        wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
        wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );
        wp_clear_scheduled_hook( 'vigent_woo_delta_flush' );
        wp_clear_scheduled_hook( 'vigent_woo_enqueue_delta_retry' );
        wp_clear_scheduled_hook( 'vigent_woo_status_check' );
        wp_clear_scheduled_hook( 'vigent_woo_daily_update_check' );
}
register_activation_hook( __FILE__, 'vigent_woo_activate' );

/**
 * Deactivation — پاک‌سازی cron‌ها.
 */
function vigent_woo_deactivate() {
        wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
        wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );
        wp_clear_scheduled_hook( 'vigent_woo_delta_flush' );
        wp_clear_scheduled_hook( 'vigent_woo_enqueue_delta_retry' );
        wp_clear_scheduled_hook( 'vigent_woo_status_check' );
        wp_clear_scheduled_hook( 'vigent_woo_daily_update_check' );
}
register_deactivation_hook( __FILE__, 'vigent_woo_deactivate' );

/**
 * بارگذاری فایل ترجمه.
 */
function vigent_woo_load_textdomain() {
        load_plugin_textdomain( 'vigent-woo', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'plugins_loaded', 'vigent_woo_load_textdomain' );

/**
 * اضافه کردن intervalهای سفارشی برای WP-Cron.
 */
function vigent_woo_cron_schedules( $schedules ) {
        $schedules['five_minutes'] = array(
                'interval' => 300,
                'display'  => __( 'هر ۵ دقیقه', 'vigent-woo' ),
        );
        $schedules['twenty_four_hours'] = array(
                'interval' => DAY_IN_SECONDS, // 86400 ثانیه = ۲۴ ساعت
                'display'  => __( 'هر ۲۴ ساعت', 'vigent-woo' ),
        );
        return $schedules;
}
add_filter( 'cron_schedules', 'vigent_woo_cron_schedules' );

/**
 * زمان‌بندی cron‌ها در admin_init (نه در activation) تا از خطا جلوگیری شود.
 * این تابع در اولین بار مراجعه کاربر به admin اجرا می‌شود و cron‌ها را می‌سازد.
 */
function vigent_woo_setup_cron() {
        $configured = class_exists( 'Vigent_Woo_Core' ) && Vigent_Woo_Core::instance()->is_configured();
        if ( $configured ) {
                if ( ! wp_next_scheduled( 'vigent_woo_retry_cron' ) ) {
                        wp_schedule_event( time() + 300, 'five_minutes', 'vigent_woo_retry_cron' );
                }
                if ( ! wp_next_scheduled( 'vigent_woo_delta_flush' ) ) {
                        wp_schedule_event( time() + 300, 'five_minutes', 'vigent_woo_delta_flush' );
                }
        }
        // بررسی بروزرسانی افزونه — هر ۲۴ ساعت یک‌بار به‌صورت خودکار.
        // این cron فایل info رو از سرور ویجنت می‌خونه و در صورت وجود نسخه جدید،
        // آن را در transient بروزرسانی‌ها ثبت می‌کنه تا وردپرس بنر آپدیت رو نشون بده.
        if ( ! wp_next_scheduled( 'vigent_woo_daily_update_check' ) ) {
                wp_schedule_event( time() + 3600, 'twenty_four_hours', 'vigent_woo_daily_update_check' );
        }
}
add_action( 'admin_init', 'vigent_woo_setup_cron' );

/**
 * Migration — برای کاربران فعلی که قبلاً اتصال را برقرار کرده‌اند.
 *
 * این تابع در admin_init اجرا می‌شود و اگر کاربر قبلاً اتصال را برقرار
 * کرده باشد (یعنی webhook_url و webhook_secret در تنظیمات موجود است) ولی
 * هنوز فلگ `vigent_woo_initial_push_done` تنظیم نشده، آن را به‌صورت خودکار
 * روی ۱ تنظیم می‌کند. این یعنی کاربران فعلی پس از آپدیت به 4.0.2، ویزارد
 * ارسال اولیه را نمی‌بینند و مستقیماً به صفحه مدیریت هدایت می‌شوند — که
 * همان تجربه‌ای است که قبلاً داشته‌اند.
 *
 * همچنین اگر webhook_secret هنوز به‌صورت plaintext ذخیره شده باشد، آن را
 * به‌صورت شیفته‌شده مهاجرت می‌دهد.
 */
function vigent_woo_migrate_existing_users() {
        $migrated = get_option( 'vigent_woo_migrated_4_0_2', false );
        if ( $migrated ) {
                return; // فقط یک بار اجرا شود.
        }

        $settings = get_option( VIGENT_WOO_OPTION, array() );
        if ( is_array( $settings ) && ! empty( $settings['webhook_url'] ) && ! empty( $settings['webhook_secret'] ) ) {
                // این کاربر قبلاً اتصال را برقرار کرده. فرض می‌کنیم push هم انجام شده
                // تا ویزارد برایش ظاهر نشود.
                if ( ! get_option( 'vigent_woo_initial_push_done' ) ) {
                        update_option( 'vigent_woo_initial_push_done', 1 );
                }
        }

        // مهاجرت webhook_secret به حالت encrypt‌شده. اگر هنوز با پیشوند 'enc:'
        // شروع نشده، یعنی plaintext است و باید رمزگذاری شود. این کار از طریق
        // update_settings انجام می‌شود تا همان مسیر رمزگذاری طی شود.
        if ( is_array( $settings ) && ! empty( $settings['webhook_secret'] ) ) {
                if ( 0 !== strpos( $settings['webhook_secret'], 'enc:' ) ) {
                        // plaintext → باید رمزگذاری شود. Core::update_settings این کار را انجام می‌دهد.
                        if ( class_exists( 'Vigent_Woo_Core' ) ) {
                                $core = Vigent_Woo_Core::instance();
                                // ابتدا secret فعلی (plaintext) را بخوانیم، سپس دوباره ذخیره کنیم
                                // تا update_settings آن را رمزگذاری کند.
                                $decrypted = $settings['webhook_secret']; // فعلاً plaintext
                                $settings['webhook_secret'] = $decrypted;
                                $core->update_settings( $settings );
                        }
                }
        }

        update_option( 'vigent_woo_migrated_4_0_2', 1 );
}
add_action( 'admin_init', 'vigent_woo_migrate_existing_users' );

/** Upgrade storage and schedules for the 4.2 delta-sync protocol. */
function vigent_woo_migrate_4_2_0() {
        if ( get_option( 'vigent_woo_migrated_4_2_0', false ) ) {
                return;
        }

        if ( false === get_option( 'vigent_woo_delta_queue', false ) ) {
                add_option( 'vigent_woo_delta_queue', array(), '', 'no' );
        }
        if ( false === get_option( 'vigent_woo_sync_state', false ) ) {
                add_option( 'vigent_woo_sync_state', array(), '', 'no' );
        }

        // Full catalogue polling is intentionally retired. Product/order hooks now
        // populate the compact queue and this queue is flushed every five minutes.
        wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );
        if ( class_exists( 'Vigent_Woo_Core' ) && Vigent_Woo_Core::instance()->is_configured() && ! wp_next_scheduled( 'vigent_woo_delta_flush' ) ) {
                wp_schedule_event( time() + 60, 'five_minutes', 'vigent_woo_delta_flush' );
        }

        if ( class_exists( 'Vigent_Woo_Sync' ) ) {
                Vigent_Woo_Sync::instance()->migrate_legacy_retry_queue();
        }
        update_option( 'vigent_woo_migrated_4_2_0', 1, false );
}
add_action( 'admin_init', 'vigent_woo_migrate_4_2_0' );

// ─── راه‌اندازی کلاس‌ها (با چک امنیتی) ─────────────────────────────────────

if ( class_exists( 'Vigent_Woo_Core' ) ) {
        Vigent_Woo_Core::instance();
}

if ( class_exists( 'Vigent_Woo_Sync' ) ) {
        Vigent_Woo_Sync::instance();
        // Cron hooks.
        add_action( 'vigent_woo_retry_cron', array( Vigent_Woo_Sync::instance(), 'process_retry_queue' ) );
        add_action( 'vigent_woo_delta_flush', array( Vigent_Woo_Sync::instance(), 'flush_delta_queue' ) );
}

if ( class_exists( 'Vigent_Woo_REST' ) ) {
        Vigent_Woo_REST::instance();
}

if ( class_exists( 'Vigent_Woo_Admin' ) ) {
        Vigent_Woo_Admin::instance();
}

if ( class_exists( 'Vigent_Woo_Ajax' ) ) {
        Vigent_Woo_Ajax::instance();
}

// Updater — آپدیت خودکار از طریق سرور ویجنت.
// نکته: این کلاس باید بعد از بقیه کلاس‌ها لود شود تا VIGENT_WOO_VERSION در دسترس باشد.
if ( class_exists( 'Vigent_Woo_Updater' ) ) {
        Vigent_Woo_Updater::instance();
}

// ─── Fatal error capture ─────────────────────────────────────────────────
//
// PHP fatal errors (memory_limit exhausted, class-not-found, etc.) bypass
// all try/catch blocks and produce a raw HTML error page or an empty body.
// When that happens during an admin-ajax.php call, the browser receives
// HTML instead of JSON and throws "Unexpected token '<'" — useless.
//
// register_shutdown_function runs AFTER the fatal error, giving us one last
// chance to log what went wrong. We write the error type, message, file, and
// line into the plugin's debug.log so the admin (or Vigent support) can see
// exactly what crashed — even if the host has display_errors=Off.
//
// The AJAX handler's response is already lost at this point (headers may have
// been sent, or the output buffer may already contain HTML), but at least the
// NEXT time the admin opens "View Debug Log" they'll see the real cause.

if ( ! function_exists( 'vigent_woo_capture_shutdown' ) ) {
        function vigent_woo_capture_shutdown() {
                $error = error_get_last();
                // Only care about fatal-level errors (E_ERROR, E_PARSE, E_CORE_ERROR,
                // E_COMPILE_ERROR, E_USER_ERROR). Warnings and notices are handled by
                // the regular error handler and would just spam the log.
                if ( ! is_array( $error ) ) {
                        return;
                }
                $fatal_types = array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR );
                if ( ! in_array( $error['type'], $fatal_types, true ) ) {
                        return;
                }

                // Map the numeric type to a readable name.
                $type_map = array(
                        E_ERROR             => 'E_ERROR',
                        E_PARSE             => 'E_PARSE',
                        E_CORE_ERROR        => 'E_CORE_ERROR',
                        E_COMPILE_ERROR     => 'E_COMPILE_ERROR',
                        E_USER_ERROR        => 'E_USER_ERROR',
                );
                $type_name = isset( $type_map[ $error['type'] ] ) ? $type_map[ $error['type'] ] : 'UNKNOWN';

                // Write to the plugin's debug log. We call the Core method directly
                // (the class is loaded by now) so the entry lands in the same file
                // as the regular send_event logs.
                if ( class_exists( 'Vigent_Woo_Core' ) ) {
                        $context = array(
                                'type'    => $type_name,
                                'message' => $error['message'],
                                'file'    => isset( $error['file'] ) ? $error['file'] : '',
                                'line'    => isset( $error['line'] ) ? $error['line'] : 0,
                        );

                        // Try to detect if this happened during an AJAX call (the common
                        // case where the HTML-vs-JSON problem manifests). The DOING_AJAX
                        // constant is set by admin-ajax.php.
                        if ( defined( 'DOING_AJAX' ) && DOING_AJAX ) {
                                $action = isset( $_POST['action'] ) ? sanitize_text_field( wp_unslash( $_POST['action'] ) ) : '';
                                if ( 0 === strpos( $action, 'vigent_woo_' ) ) {
                                        $context['ajax_action'] = $action;
                                        $context['note']        = 'This fatal error happened during a Vigent AJAX call and is why the browser saw HTML instead of JSON.';
                                }
                        }

                        Vigent_Woo_Core::instance()->debug_log( 'FATAL ERROR (shutdown)', $context );
                }
        }
}
register_shutdown_function( 'vigent_woo_capture_shutdown' );
