<?php
/**
 * Uninstall — clean up all plugin data.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
        exit;
}

delete_option( 'vigent_woo_settings' );
delete_option( 'vigent_woo_retry_queue' );
delete_option( 'vigent_woo_initial_push_done' );
delete_option( 'vigent_woo_migrated_4_0_2' );
delete_option( 'vigent_woo_migrated_4_2_0' );
delete_option( 'vigent_woo_delta_queue' );
delete_option( 'vigent_woo_sync_state' );
delete_option( 'vigent_woo_delta_queue_lock' );
delete_option( 'vigent_woo_delta_flush_lock' );
// Clean up any rate-limit transients (keyed by IP+action, so we use a LIKE
// pattern via direct DB query — these are short-lived and would expire on
// their own, but cleaning them keeps the options table tidy).
global $wpdb;
$wpdb->query(
        "DELETE FROM {$wpdb->options}
         WHERE option_name LIKE '\_transient\_vigent\_woo\_rl\_%'
            OR option_name LIKE '\_transient\_timeout\_vigent\_woo\_rl\_%'"
);
delete_transient( 'vigent_woo_status' );
delete_transient( 'vigent_woo_pairing_challenge' );
wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );
wp_clear_scheduled_hook( 'vigent_woo_delta_flush' );
wp_clear_scheduled_hook( 'vigent_woo_enqueue_delta_retry' );
wp_clear_scheduled_hook( 'vigent_woo_status_check' );
wp_clear_scheduled_hook( 'vigent_woo_daily_update_check' );
