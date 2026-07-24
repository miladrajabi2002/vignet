<?php
/**
 * Plugin Name:       ویجنت — اتصال وردپرس و ووکامرس
 * Plugin URI:        https://vigent.ir/docs/woocommerce
 * Description:       سایت وردپرس شما را به ایجنت هوشمند ویجنت متصل می‌کند: نوشته‌ها و برگه‌ها به پایگاه دانش ایجنت می‌روند و اگر ووکامرس فعال باشد، محصولات و سفارش‌ها هم خودکار همگام می‌شوند.
 * Version:           3.0.0
 * Author:            Vigent
 * Author URI:        https://vigent.ir
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       vigent-woo
 * Domain Path:       /languages
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * WC requires at least: 6.0
 *
 * This plugin connects your WordPress site to the Vigent AI agent platform.
 * Posts and pages flow into the agent's knowledge base; if WooCommerce is
 * active, products and orders sync automatically.
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit;
}

define( 'VIGENT_WOO_VERSION', '3.0.0' );
define( 'VIGENT_WOO_OPTION', 'vigent_woo_settings' );
define( 'VIGENT_WOO_DB_VERSION', '1' );
define( 'VIGENT_WOO_NONCE', 'vigent_woo_nonce' );

// ─── بارگذاری فایل‌های کمکی ────────────────────────────────────────────────

require_once __DIR__ . '/includes/class-vigent-woo-core.php';
require_once __DIR__ . '/includes/class-vigent-woo-sync.php';
require_once __DIR__ . '/includes/class-vigent-woo-admin.php';
require_once __DIR__ . '/includes/class-vigent-woo-dashboard-widget.php';
require_once __DIR__ . '/includes/class-vigent-woo-ajax.php';
require_once __DIR__ . '/includes/class-vigent-woo-rest.php';
require_once __DIR__ . '/includes/class-vigent-woo-cli.php';

// ─── مقداردهی اولیه ────────────────────────────────────────────────────────

/**
 * فعال‌سازی افزونه: ساخت تنظیمات پیش‌فرض و جدول صف retry.
 */
function vigent_woo_activate() {
        // تنظیمات پیش‌فرض.
        if ( false === get_option( VIGENT_WOO_OPTION ) ) {
                add_option(
                        VIGENT_WOO_OPTION,
                        array(
                                'webhook_url'         => '',
                                'webhook_secret'      => '',
                                'sync_products'       => '1',
                                'sync_orders'         => '1',
                                'sync_content'        => '1',
                                'product_filter'      => 'all', // all | published | priced | category
                                'product_categories'  => array(),
                                'exclude_product_ids' => array(),
                                'enable_dashboard_widget' => '1',
                                'enable_retry'        => '1',
                        )
                );
        }

        // جدول صف retry برای webhook های ناموفق.
        Vigent_Woo_Core::instance()->create_retry_table();

        // زمان‌بندی WP-Cron برای retry.
        if ( ! wp_next_scheduled( 'vigent_woo_retry_cron' ) ) {
                wp_schedule_event( time() + 300, 'five_minutes', 'vigent_woo_retry_cron' );
        }

        // زمان‌بندی پینگ وضعیت اتصال.
        if ( ! wp_next_scheduled( 'vigent_woo_status_check' ) ) {
                wp_schedule_event( time() + 600, 'hourly', 'vigent_woo_status_check' );
        }

        flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'vigent_woo_activate' );

/**
 * غیرفعال‌سازی افزونه: پاک‌سازی cron‌ها.
 */
function vigent_woo_deactivate() {
        wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
        wp_clear_scheduled_hook( 'vigent_woo_status_check' );
}
register_deactivation_hook( __FILE__, 'vigent_woo_deactivate' );

/**
 * بارگذاری فایل‌های ترجمه.
 */
function vigent_woo_load_textdomain() {
        load_plugin_textdomain( 'vigent-woo', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'plugins_loaded', 'vigent_woo_load_textdomain' );

/**
 * افزودن interval پنج‌دقیقه‌ای برای WP-Cron.
 */
function vigent_woo_cron_schedules( $schedules ) {
        $schedules['five_minutes'] = array(
                'interval' => 300,
                'display'  => __( 'هر ۵ دقیقه', 'vigent-woo' ),
        );
        return $schedules;
}
add_filter( 'cron_schedules', 'vigent_woo_cron_schedules' );

// ─── راه‌اندازی کلاس‌ها ─────────────────────────────────────────────────────

Vigent_Woo_Core::instance();
Vigent_Woo_Sync::instance();
Vigent_Woo_Admin::instance();
Vigent_Woo_Dashboard_Widget::instance();
Vigent_Woo_Ajax::instance();

// ثبت WP-CLI commands اگر در محیط CLI هستیم.
if ( defined( 'WP_CLI' ) && WP_CLI ) {
        Vigent_Woo_CLI::instance();
}

// ─── هوک‌های cron ───────────────────────────────────────────────────────────

add_action( 'vigent_woo_retry_cron', array( Vigent_Woo_Sync::instance(), 'process_retry_queue' ) );
add_action( 'vigent_woo_status_check', array( Vigent_Woo_Core::instance(), 'refresh_connection_status' ) );
