<?php
/**
 * WP-CLI commands for Vigent Woo plugin.
 *
 * Commands:
 *   wp vigent status           — Show connection status
 *   wp vigent test-connection  — Test the connection to Vigent
 *   wp vigent sync products    — Sync all products
 *   wp vigent sync orders      — Sync all orders
 *   wp vigent sync content     — Sync all posts and pages
 *   wp vigent retry-queue      — Show retry queue
 *   wp vigent clear-retry      — Clear retry queue
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Vigent_Woo_CLI {

	public static function instance() {
		if ( ! class_exists( 'WP_CLI' ) ) return;
		WP_CLI::add_command( 'vigent', __CLASS__ );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	/**
	 * Show current connection status.
	 *
	 * ## EXAMPLES
	 *
	 *     wp vigent status
	 *
	 * @subcommand status
	 */
	public function status() {
		$core   = $this->core();
		$s      = $core->get_settings();
		$status = $core->get_connection_status();

		WP_CLI::line( '═════════════════════════════════════════════' );
		WP_CLI::line( '  Vigent Woo — Status' );
		WP_CLI::line( '═════════════════════════════════════════════' );
		WP_CLI::line( '  Plugin version:    ' . VIGENT_WOO_VERSION );
		WP_CLI::line( '  WordPress:         ' . get_bloginfo( 'version' ) );
		WP_CLI::line( '  PHP:               ' . PHP_VERSION );
		WP_CLI::line( '  WooCommerce:       ' . ( $core->has_wc() ? WC()->version : 'not active' ) );
		WP_CLI::line( '  HPOS:              ' . ( $this->is_hpos_enabled() ? 'enabled' : 'disabled' ) );
		WP_CLI::line( '' );
		WP_CLI::line( '  Webhook URL:       ' . ( $s['webhook_url'] ? '✓ set' : '✗ not set' ) );
		WP_CLI::line( '  Webhook secret:    ' . ( $s['webhook_secret'] ? '✓ set' : '✗ not set' ) );
		WP_CLI::line( '  Configured:        ' . ( $core->is_configured() ? '✓ yes' : '✗ no' ) );
		WP_CLI::line( '' );

		if ( null === $status['connected'] ) {
			WP_CLI::line( '  Connection:        unknown (run `wp vigent test-connection`)' );
		} else {
			WP_CLI::line( '  Connection:        ' . ( $status['connected'] ? '✓ connected' : '✗ disconnected' ) );
			WP_CLI::line( '  Last HTTP code:    ' . $status['http_code'] );
			if ( $status['error'] ) {
				WP_CLI::line( '  Last error:        ' . substr( $status['error'], 0, 200 ) );
			}
			WP_CLI::line( '  Last check:        ' . $status['last_check'] );
		}

		$queue = $core->get_retry_queue();
		WP_CLI::line( '  Retry queue:       ' . count( $queue ) . ' item(s)' );
	}

	/**
	 * Test the connection to Vigent.
	 *
	 * ## EXAMPLES
	 *
	 *     wp vigent test-connection
	 *
	 * @subcommand test-connection
	 */
	public function test_connection() {
		if ( ! $this->core()->is_configured() ) {
			WP_CLI::error( 'Plugin is not configured. Set webhook URL and secret first.' );
		}
		WP_CLI::log( 'Sending test ping to Vigent...' );
		$result = $this->core()->refresh_connection_status();
		if ( $result['connected'] ) {
			WP_CLI::success( 'Connection successful!' );
		} else {
			WP_CLI::error( sprintf( 'Connection failed (HTTP %d): %s', $result['http_code'], $result['error'] ?? '' ) );
		}
	}

	/**
	 * Sync data to Vigent.
	 *
	 * ## OPTIONS
	 *
	 * <kind>
	 * : What to sync (products, orders, content).
	 *
	 * ## EXAMPLES
	 *
	 *     wp vigent sync products
	 *     wp vigent sync orders
	 *     wp vigent sync content
	 *
	 * @subcommand sync
	 */
	public function sync( $args, $assoc_args ) {
		if ( ! isset( $args[0] ) ) {
			WP_CLI::error( 'Usage: wp vigent sync <products|orders|content>' );
		}
		$kind = $args[0];
		if ( ! in_array( $kind, array( 'products', 'orders', 'content' ), true ) ) {
			WP_CLI::error( 'Kind must be one of: products, orders, content' );
		}
		if ( ! $this->core()->is_configured() ) {
			WP_CLI::error( 'Plugin is not configured.' );
		}

		$sync   = Vigent_Woo_Sync::instance();
		$total  = $sync->count_items( $kind );
		WP_CLI::log( sprintf( 'Syncing %d %s...', $total, $kind ) );

		$offset = 0;
		$sent   = 0;
		$errors = array();
		$progress = \WP_CLI\Utils\make_progress_bar( "Syncing $kind", $total > 0 ? $total : 1 );

		while ( true ) {
			$result = $sync->sync_batch( $kind, $offset, 50 );
			$sent += $result['sent'];
			$errors = array_merge( $errors, $result['errors'] );
			$progress->tick( $result['sent'] > 0 ? $result['sent'] : 1 );
			if ( $result['done'] ) break;
			$offset += 50;
		}
		$progress->finish();

		WP_CLI::success( sprintf( 'Synced %d/%d %s with %d error(s).', $sent, $total, $kind, count( $errors ) ) );
		if ( ! empty( $errors ) && WP_CLI::get_config( 'debug' ) ) {
			foreach ( array_slice( $errors, 0, 20 ) as $err ) {
				WP_CLI::debug( $err );
			}
		}
	}

	/**
	 * Show the retry queue.
	 *
	 * ## EXAMPLES
	 *
	 *     wp vigent retry-queue
	 *
	 * @subcommand retry-queue
	 */
	public function retry_queue() {
		$queue = $this->core()->get_retry_queue();
		if ( empty( $queue ) ) {
			WP_CLI::log( 'Retry queue is empty.' );
			return;
		}
		WP_CLI::log( sprintf( '%d item(s) in retry queue:', count( $queue ) ) );
		foreach ( $queue as $i => $item ) {
			WP_CLI::log( sprintf( '  [%d] %s — attempts: %d — created: %s', $i + 1, $item['topic'], $item['attempts'], $item['created_at'] ) );
		}
	}

	/**
	 * Clear the retry queue.
	 *
	 * ## EXAMPLES
	 *
	 *     wp vigent clear-retry
	 *
	 * @subcommand clear-retry
	 */
	public function clear_retry() {
		$this->core()->clear_retry_queue();
		WP_CLI::success( 'Retry queue cleared.' );
	}

	private function is_hpos_enabled() {
		if ( ! $this->core()->has_wc() ) return false;
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		}
		return false;
	}
}
