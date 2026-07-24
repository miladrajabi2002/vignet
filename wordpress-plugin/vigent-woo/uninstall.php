<?php
/**
 * Uninstall — clean up all plugin data.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'vigent_woo_settings' );
delete_option( 'vigent_woo_retry_queue' );
delete_transient( 'vigent_woo_status' );
wp_clear_scheduled_hook( 'vigent_woo_retry_cron' );
