<?php
/**
 * Uninstall handler for Vigent Woo plugin.
 *
 * Removes all plugin data when the user deletes the plugin from WordPress
 * (not just deactivates). Includes:
 *   - Plugin settings option
 *   - Retry queue option
 *   - Connection status transient
 *   - WP-Cron schedules
 *
 * @package VigentWoo
 */

// Security: only run when called by WordPress uninstall mechanism.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// ─── Remove options ────────────────────────────────────────────────────

delete_option( 'vigent_woo_settings' );
delete_option( 'vigent_woo_retry_queue' );
delete_option( 'vigent_woo_db_version' );

// ─── Remove transients ─────────────────────────────────────────────────

delete_transient( 'vigent_woo_status' );

// ─── Clear WP-Cron schedules ──────────────────────────────────────────

wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
wp_clear_scheduled_hook( 'vigent_woo_status_check' );

// ─── Remove dashboard widget user meta (if any) ────────────────────────

// The widget doesn't store user meta, but we clean up just in case
// the user has hidden the widget (stored in `meta-box-order_dashboard`).
// We leave that alone — it's a user preference and removing it would
// affect other widgets too.

// ─── Done ──────────────────────────────────────────────────────────────
