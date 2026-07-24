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
wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
wp_clear_scheduled_hook( 'vigent_woo_auto_sync' );
wp_clear_scheduled_hook( 'vigent_woo_status_check' );
