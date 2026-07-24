<?php
/**
 * Plugin Name:       ویجنت — اتصال وردپرس و ووکامرس
 * Plugin URI:        https://vigent.ir/docs/woocommerce
 * Description:       سایت وردپرس شما را به ایجنت هوشمند ویجنت متصل می‌کند و محصولات و سفارش‌ها را همگام می‌سازد.
 * Version:           4.0.1
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

define( 'VIGENT_WOO_VERSION', '4.0.1' );
define( 'VIGENT_WOO_OPTION', 'vigent_woo_settings' );
define( 'VIGENT_WOO_NONCE', 'vigent_woo_nonce' );

// ─── بارگذاری کلاس‌ها (با چک امنیتی) ─────────────────────────────────────

$vg_includes = array(
	__DIR__ . '/includes/class-vigent-woo-core.php',
	__DIR__ . '/includes/class-vigent-woo-sync.php',
	__DIR__ . '/includes/class-vigent-woo-admin.php',
	__DIR__ . '/includes/class-vigent-woo-ajax.php',
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
		add_option( 'vigent_woo_retry_queue', array() );
	}

	// پاک‌سازی cron‌های قدیمی (از نسخه‌های قبلی).
	wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
	wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );
	wp_clear_scheduled_hook( 'vigent_woo_status_check' );
}
register_activation_hook( __FILE__, 'vigent_woo_activate' );

/**
 * Deactivation — پاک‌سازی cron‌ها.
 */
function vigent_woo_deactivate() {
	wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
	wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );
	wp_clear_scheduled_hook( 'vigent_woo_status_check' );
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
	$schedules['thirty_minutes'] = array(
		'interval' => 1800,
		'display'  => __( 'هر ۳۰ دقیقه', 'vigent-woo' ),
	);
	return $schedules;
}
add_filter( 'cron_schedules', 'vigent_woo_cron_schedules' );

/**
 * زمان‌بندی cron‌ها در admin_init (نه در activation) تا از خطا جلوگیری شود.
 * این تابع در اولین بار مراجعه کاربر به admin اجرا می‌شود و cron‌ها را می‌سازد.
 */
function vigent_woo_setup_cron() {
	if ( ! wp_next_scheduled( 'vigent_woo_retry_cron' ) ) {
		wp_schedule_event( time() + 300, 'five_minutes', 'vigent_woo_retry_cron' );
	}
	if ( ! wp_next_scheduled( 'vigent_woo_auto_sync' ) ) {
		wp_schedule_event( time() + 1800, 'thirty_minutes', 'vigent_woo_auto_sync' );
	}
}
add_action( 'admin_init', 'vigent_woo_setup_cron' );

// ─── راه‌اندازی کلاس‌ها (با چک امنیتی) ─────────────────────────────────────

if ( class_exists( 'Vigent_Woo_Core' ) ) {
	Vigent_Woo_Core::instance();
}

if ( class_exists( 'Vigent_Woo_Sync' ) ) {
	Vigent_Woo_Sync::instance();
	// Cron hooks.
	add_action( 'vigent_woo_retry_cron', array( Vigent_Woo_Sync::instance(), 'process_retry_queue' ) );
	add_action( 'vigent_woo_auto_sync', array( Vigent_Woo_Sync::instance(), 'run_auto_sync' ) );
}

if ( class_exists( 'Vigent_Woo_Admin' ) ) {
	Vigent_Woo_Admin::instance();
}

if ( class_exists( 'Vigent_Woo_Ajax' ) ) {
	Vigent_Woo_Ajax::instance();
}
