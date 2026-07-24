<?php
/**
 * Plugin Name:       ویجنت — اتصال وردپرس و ووکامرس
 * Plugin URI:        https://vigent.ir/docs/woocommerce
 * Description:       سایت وردپرس شما را به ایجنت هوشمند ویجنت متصل می‌کند و محصولات و سفارش‌ها را همگام می‌سازد.
 * Version:           3.1.0
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

define( 'VIGENT_WOO_VERSION', '3.1.0' );
define( 'VIGENT_WOO_OPTION', 'vigent_woo_settings' );
define( 'VIGENT_WOO_NONCE', 'vigent_woo_nonce' );

require_once __DIR__ . '/includes/class-vigent-woo-core.php';
require_once __DIR__ . '/includes/class-vigent-woo-sync.php';
require_once __DIR__ . '/includes/class-vigent-woo-admin.php';
require_once __DIR__ . '/includes/class-vigent-woo-ajax.php';
require_once __DIR__ . '/includes/class-vigent-woo-rest.php';
require_once __DIR__ . '/includes/class-vigent-woo-cli.php';

// ─── فعال‌سازی ────────────────────────────────────────────────────────────

function vigent_woo_activate() {
	if ( false === get_option( VIGENT_WOO_OPTION ) ) {
		add_option(
			VIGENT_WOO_OPTION,
			array(
				'webhook_url'     => '',
				'webhook_secret'  => '',
				'sync_products'   => '1', // default ON
				'sync_orders'     => '',   // default OFF
				'enable_retry'    => '1',
			)
		);
	}
	Vigent_Woo_Core::instance()->create_retry_table();
	if ( ! wp_next_scheduled( 'vigent_woo_retry_cron' ) ) {
		wp_schedule_event( time() + 300, 'five_minutes', 'vigent_woo_retry_cron' );
	}
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'vigent_woo_activate' );

function vigent_woo_deactivate() {
	wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
}
register_deactivation_hook( __FILE__, 'vigent_woo_deactivate' );

function vigent_woo_load_textdomain() {
	load_plugin_textdomain( 'vigent-woo', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'plugins_loaded', 'vigent_woo_load_textdomain' );

function vigent_woo_cron_schedules( $schedules ) {
	$schedules['five_minutes'] = array(
		'interval' => 300,
		'display'  => __( 'هر ۵ دقیقه', 'vigent-woo' ),
	);
	return $schedules;
}
add_filter( 'cron_schedules', 'vigent_woo_cron_schedules' );

// ─── راه‌اندازی کلاس‌ها ──────────────────────────────────────────────────

Vigent_Woo_Core::instance();
Vigent_Woo_Sync::instance();
Vigent_Woo_Admin::instance();
Vigent_Woo_Ajax::instance();

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	Vigent_Woo_CLI::instance();
}

add_action( 'vigent_woo_retry_cron', array( Vigent_Woo_Sync::instance(), 'process_retry_queue' ) );
