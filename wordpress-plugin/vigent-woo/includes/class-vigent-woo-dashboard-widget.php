<?php
/**
 * Dashboard widget for Vigent Woo plugin.
 *
 * Adds a small widget to the WordPress admin dashboard showing connection
 * status + quick stats.
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_Dashboard_Widget {

	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'wp_dashboard_setup', array( $this, 'register_widget' ) );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	public function register_widget() {
		$s = $this->core()->get_settings();
		if ( empty( $s['enable_dashboard_widget'] ) ) {
			return;
		}

		wp_add_dashboard_widget(
			'vigent_woo_dashboard_widget',
			__( 'ویجنت — وضعیت اتصال', 'vigent-woo' ),
			array( $this, 'render_widget' )
		);
	}

	public function render_widget() {
		$core   = $this->core();
		$status = $core->get_connection_status();
		$has_wc = $core->has_wc();

		$connected = $status['connected'];
		$cls   = true === $connected ? 'ok' : ( false === $connected ? 'err' : 'unknown' );
		$label = true === $connected ? __( 'متصل', 'vigent-woo' ) : ( false === $connected ? __( 'قطع', 'vigent-woo' ) : __( 'نامشخص', 'vigent-woo' ) );

		echo '<div style="font-family: -apple-system, IRANSansWeb, Tahoma, sans-serif;">';

		// Status line
		printf(
			'<div style="display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:8px; margin-bottom:12px; background:%s; color:%s;">',
			true === $connected ? '#ecfdf5' : ( false === $connected ? '#fef2f2' : '#f3f4f6' ),
			true === $connected ? '#047857' : ( false === $connected ? '#b91c1c' : '#6b7280' )
		);
		printf( '<span style="width:8px; height:8px; border-radius:50%%; background:currentColor;"></span>' );
		printf( '<strong>%s</strong>', esc_html( $label ) );
		if ( $status['last_check'] ) {
			printf( '<small style="margin-right:auto; opacity:.7;">%s</small>', esc_html( $status['last_check'] ) );
		}
		echo '</div>';

		// Quick stats
		echo '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">';
		$this->mini_stat( __( 'محصولات', 'vigent-woo' ), $has_wc ? $this->count_products() : '—' );
		$this->mini_stat( __( 'سفارش‌ها', 'vigent-woo' ), $has_wc ? $this->count_orders() : '—' );
		echo '</div>';

		// Quick actions
		echo '<div style="display:flex; gap:6px; flex-wrap:wrap;">';
		printf(
			'<a href="%s" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#6366f1; color:#fff; border-radius:6px; text-decoration:none; font-size:12px; font-weight:600;">%s</a>',
			esc_url( admin_url( 'admin.php?page=vigent-woo' ) ),
			esc_html__( 'داشبورد', 'vigent-woo' )
		);
		if ( $core->is_configured() ) {
			printf(
				'<a href="%s" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#fff; color:#374151; border:1px solid #d1d5db; border-radius:6px; text-decoration:none; font-size:12px; font-weight:600;">%s</a>',
				esc_url( admin_url( 'admin.php?page=vigent-woo-sync' ) ),
				esc_html__( 'هم‌گام‌سازی', 'vigent-woo' )
			);
		} else {
			printf(
				'<a href="%s" style="display:inline-flex; align-items:center; gap:4px; padding:6px 12px; background:#fff; color:#374151; border:1px solid #d1d5db; border-radius:6px; text-decoration:none; font-size:12px; font-weight:600;">%s</a>',
				esc_url( admin_url( 'admin.php?page=vigent-woo-settings' ) ),
				esc_html__( 'پیکربندی', 'vigent-woo' )
			);
		}
		echo '</div>';

		echo '</div>';
	}

	private function mini_stat( $label, $value ) {
		printf(
			'<div style="background:#f9fafb; padding:8px 10px; border-radius:8px; border:1px solid #f3f4f6;"><div style="font-size:10px; color:#9ca3af;">%s</div><div style="font-size:16px; font-weight:700; color:#111827;">%s</div></div>',
			esc_html( $label ),
			esc_html( $value )
		);
	}

	private function count_products() {
		if ( ! $this->core()->has_wc() ) return 0;
		$ids = wc_get_products( array( 'limit' => -1, 'return' => 'ids' ) );
		return is_array( $ids ) ? count( $ids ) : 0;
	}

	private function count_orders() {
		if ( ! $this->core()->has_wc() ) return 0;
		return wc_orders_count( 'shop_order' );
	}
}
