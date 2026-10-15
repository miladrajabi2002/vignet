<?php
/**
 * Exercises Vigent_Woo_Sync's delta queue against minimal WordPress/WooCommerce
 * stubs: the payload-hash skip, create/delete priority, the time-budgeted
 * multi-batch cron flush and the existing safeguards. Not shipped in the zip.
 *
 * Run: php wordpress-plugin/tests/delta-queue-harness.php   (about 20s)
 */
define( 'ABSPATH', __DIR__ );
define( 'VIGENT_WOO_OPTION', 'vigent_woo_settings' );
define( 'VIGENT_WOO_VERSION', 'test' );

$GLOBALS['opts']   = array( VIGENT_WOO_OPTION => array( 'webhook_url' => 'https://vigent.test/api/sync/woocommerce' ) );
$GLOBALS['meta']   = array();
$GLOBALS['cron']   = array();
$GLOBALS['hooks']  = array();
$GLOBALS['products'] = array();
$GLOBALS['sent']   = array();
$GLOBALS['latency'] = 0.0;
$GLOBALS['fail']   = false;
$GLOBALS['during_send'] = null;
$GLOBALS['meta_writes'] = 0;

function get_option( $k, $d = false ) { return array_key_exists( $k, $GLOBALS['opts'] ) ? $GLOBALS['opts'][ $k ] : $d; }
function add_option( $k, $v, $x = '', $a = 'yes' ) { if ( array_key_exists( $k, $GLOBALS['opts'] ) ) return false; $GLOBALS['opts'][ $k ] = $v; return true; }
function update_option( $k, $v, $a = null ) { $GLOBALS['opts'][ $k ] = $v; return true; }
function delete_option( $k ) { unset( $GLOBALS['opts'][ $k ] ); return true; }
function get_post_meta( $id, $k, $single = false ) { return isset( $GLOBALS['meta'][ $id ][ $k ] ) ? $GLOBALS['meta'][ $id ][ $k ] : ''; }
function update_post_meta( $id, $k, $v ) { $GLOBALS['meta_writes']++; $GLOBALS['meta'][ $id ][ $k ] = $v; return true; }
function delete_post_meta( $id, $k ) { unset( $GLOBALS['meta'][ $id ][ $k ] ); return true; }
function add_action( $h, $cb, $p = 10, $n = 1 ) { $GLOBALS['hooks'][ $h ][] = $cb; return true; }
function do_action( $h ) { foreach ( isset( $GLOBALS['hooks'][ $h ] ) ? $GLOBALS['hooks'][ $h ] : array() as $cb ) call_user_func( $cb ); }
function wp_next_scheduled( $h ) { foreach ( $GLOBALS['cron'] as $e ) if ( $e['hook'] === $h ) return $e['ts']; return false; }
function wp_schedule_single_event( $ts, $h, $args = array() ) { $GLOBALS['cron'][] = array( 'ts' => $ts, 'hook' => $h, 'args' => $args ); return true; }
function wp_generate_uuid4() { return bin2hex( random_bytes( 16 ) ); }
function sanitize_text_field( $s ) { return trim( (string) $s ); }
function absint( $v ) { return abs( (int) $v ); }
function wp_json_encode( $v, $f = 0 ) { return json_encode( $v, $f ); }
function wp_strip_all_tags( $s ) { return strip_tags( $s ); }
function current_time( $t ) { return gmdate( 'Y-m-d H:i:s' ); }
function __( $s, $d = '' ) { return $s; }
function wp_is_post_revision( $id ) { return false; }
function wp_is_post_autosave( $id ) { return false; }
function wp_convert_hr_to_bytes( $v ) { $v = strtolower( trim( $v ) ); $b = (int) $v; if ( false !== strpos( $v, 'g' ) ) $b *= 1 << 30; elseif ( false !== strpos( $v, 'm' ) ) $b *= 1 << 20; elseif ( false !== strpos( $v, 'k' ) ) $b *= 1 << 10; return $b; }
function wp_raise_memory_limit( $c ) { return true; }
function wc_get_product( $id ) { return isset( $GLOBALS['products'][ $id ] ) ? (object) array( 'id' => $id ) : false; }

class Vigent_Woo_Core {
	private static $i;
	public $log = array();
	public static function instance() { return self::$i ?: ( self::$i = new self() ); }
	public function is_configured() { return true; }
	public function has_wc() { return true; }
	public function sync_products_enabled() { return true; }
	public function sync_orders_enabled() { return true; }
	public function sync_customers_enabled() { return true; }
	public function get_settings() { return get_option( VIGENT_WOO_OPTION ); }
	public function debug_log( $m, $c = array() ) { $this->log[] = array( $m, $c ); }
	public function product_to_payload( $p ) {
		$d = $GLOBALS['products'][ $p->id ];
		// Every save moves the modified date, even one that changes nothing.
		return array_merge( array( 'id' => $p->id ), $d, array( 'date_modified' => gmdate( 'c', time() + mt_rand( 1, 99999 ) ), 'date_modified_gmt' => gmdate( 'c' ) . mt_rand() ) );
	}
	public function send_batch_events( $events, $retry ) {
		if ( $GLOBALS['latency'] ) usleep( (int) ( $GLOBALS['latency'] * 1e6 ) );
		if ( $GLOBALS['during_send'] ) { $cb = $GLOBALS['during_send']; $GLOBALS['during_send'] = null; $cb(); }
		if ( $GLOBALS['fail'] ) return array( 'success' => false, 'code' => 500, 'body' => 'boom' );
		$GLOBALS['sent'][] = $events;
		return array( 'success' => true, 'code' => 200, 'body' => 'ok' );
	}
}

require isset( $argv[1] ) ? $argv[1] : dirname( __DIR__ ) . '/vigent-woo/includes/class-vigent-woo-sync.php';

// ── helpers ────────────────────────────────────────────────────────────
$fails = 0;
function check( $label, $cond ) { global $fails; echo ( $cond ? 'PASS ' : 'FAIL ' ) . $label . "\n"; if ( ! $cond ) $fails++; }
function reset_state() {
	$GLOBALS['opts'] = array( VIGENT_WOO_OPTION => $GLOBALS['opts'][ VIGENT_WOO_OPTION ] );
	$GLOBALS['meta'] = array(); $GLOBALS['cron'] = array(); $GLOBALS['sent'] = array();
	$GLOBALS['latency'] = 0.0; $GLOBALS['fail'] = false; $GLOBALS['meta_writes'] = 0;
	$r = new ReflectionClass( 'Vigent_Woo_Sync' );
	foreach ( array( 'pending_products' => array(), 'pending_drained' => false, 'flush_seconds_spent' => 0.0 ) as $p => $v ) {
		$prop = $r->getProperty( $p ); $prop->setAccessible( true ); $prop->setValue( Vigent_Woo_Sync::instance(), $v );
	}
}
function make_products( $n, $from = 1 ) { for ( $i = $from; $i < $from + $n; $i++ ) $GLOBALS['products'][ $i ] = array( 'name' => "P$i", 'price' => '1000', 'stock_quantity' => 5 ); }
function sent_ids() { $ids = array(); foreach ( $GLOBALS['sent'] as $b ) foreach ( $b as $e ) $ids[] = $e['topic'] . ':' . $e['data']['id']; return $ids; }
function queue() { return Vigent_Woo_Sync::instance()->get_delta_queue(); }
function save_product( $id ) { Vigent_Woo_Sync::instance()->on_product_update( $id ); }
function end_request() { do_action( 'shutdown' ); $GLOBALS['hooks']['shutdown'] = array(); $r = new ReflectionProperty( 'Vigent_Woo_Sync', 'pending_drained' ); $r->setAccessible( true ); $r->setValue( Vigent_Woo_Sync::instance(), false ); }

$sync = Vigent_Woo_Sync::instance();

// ── 1. Hash skip at enqueue time ───────────────────────────────────────
echo "\n# 1. no-op re-saves are not queued\n";
reset_state(); make_products( 3 );
save_product( 1 ); save_product( 1 ); save_product( 2 );
check( 'nothing queued before the request ends', 0 === count( queue() ) );
end_request();
check( 'first save of unknown products queued (no stored hash)', array( 'product:1', 'product:2' ) === array_keys( queue() ) );
$r = $sync->flush_delta_queue();
check( 'flush sent both', 2 === $r['sent'] && 0 === $r['remaining'] );
check( 'hash stored for both', '' !== get_post_meta( 1, '_vigent_woo_sync_hash' ) && '' !== get_post_meta( 2, '_vigent_woo_sync_hash' ) );
save_product( 1 ); save_product( 2 ); end_request();
check( 're-save with only date_modified moved is NOT queued', 0 === count( queue() ) );
$GLOBALS['products'][2]['price'] = '900';
save_product( 1 ); save_product( 2 ); end_request();
check( 'real price change IS queued, no-op is not', array( 'product:2' ) === array_keys( queue() ) );
$sync->flush_delta_queue();
check( 'price change sent', array( 'product.updated:2' ) === array_slice( sent_ids(), -1 ) );
// A variable product: 20 variation saves fire 20 hooks for the parent.
$before = $GLOBALS['meta_writes'];
$GLOBALS['products'][2]['price'] = '800';
for ( $i = 0; $i < 20; $i++ ) $sync->on_product_variation_change( 0, new class { function get_parent_id() { return 2; } } );
$r = new ReflectionProperty( 'Vigent_Woo_Sync', 'pending_products' ); $r->setAccessible( true );
check( '20 variation hooks coalesce into one pending check', 1 === count( $r->getValue( $sync ) ) );
end_request();
check( 'parent queued once', array( 'product:2' ) === array_keys( queue() ) );
// Reconnecting to another workspace invalidates every stored hash.
$sync->flush_delta_queue();
$GLOBALS['opts'][ VIGENT_WOO_OPTION ]['webhook_url'] = 'https://other.test/hook';
save_product( 1 ); end_request();
check( 'different webhook URL resends', array( 'product:1' ) === array_keys( queue() ) );
$GLOBALS['opts'][ VIGENT_WOO_OPTION ]['webhook_url'] = 'https://vigent.test/api/sync/woocommerce';

// ── 2. Hash skip at materialize time (backlog queued before the upgrade) ─
echo "\n# 2. pre-upgrade backlog: unchanged entries leave without being sent\n";
reset_state(); $GLOBALS['products'] = array(); make_products( 120 );
for ( $i = 1; $i <= 120; $i++ ) $sync->enqueue_delta( 'product', $i, 'product.updated' );
$sync->flush_delta_queue( 50, 10, 0 ); // everything sent once, hashes stored
$sent_before = count( sent_ids() );
for ( $i = 1; $i <= 120; $i++ ) $sync->enqueue_delta( 'product', $i, 'product.updated' ); // direct, like the old hook did
$GLOBALS['products'][77]['price'] = '1';
$r = $sync->flush_delta_queue( 50, 10, 0 );
check( 'only the changed product was sent', array( 'product.updated:77' ) === array_slice( sent_ids(), $sent_before ) );
check( '119 dropped as unchanged, queue empty', 119 === $r['unchanged'] && 0 === $r['remaining'] );

// ── 3. Priority ────────────────────────────────────────────────────────
echo "\n# 3. creates and deletes skip ahead of updates\n";
reset_state(); $GLOBALS['products'] = array(); make_products( 2000 ); make_products( 1, 69754 );
for ( $i = 1; $i <= 2000; $i++ ) $sync->enqueue_delta( 'product', $i, 'product.updated' );
$sync->on_product_new( 69754 );
$sync->enqueue_delta( 'product', 555555, 'product.deleted', array( 'id' => 555555 ) );
$sync->enqueue_delta( 'order', 42, 'order.deleted', array( 'id' => 42 ) );
$sync->enqueue_delta( 'product', 5, 'product.updated' ); // re-save keeps its place
$keys = array_keys( queue() );
check( 'new product sits at the tail of the queue', 'product:69754' === $keys[2000] );
$r = $sync->flush_delta_queue();
$first = array_slice( sent_ids(), 0, 3 );
check( 'first batch starts with create, deletes', array( 'product.created:69754', 'product.deleted:555555', 'order.deleted:42' ) === $first );
check( 'first batch is still 50 events', 50 === count( $GLOBALS['sent'][0] ) );
// Full queue trims updates before creates.
$q = queue();
$ref = new ReflectionMethod( 'Vigent_Woo_Sync', 'oldest_droppable_key' ); $ref->setAccessible( true );
check( 'full queue drops oldest update, not a create', 'product:1' === $ref->invoke( $sync, array( 'product:9' => array( 'topic' => 'product.created' ), 'product:1' => array( 'topic' => 'product.updated' ) ) ) );

// ── 4. Multi-batch scheduled flush ────────────────────────────────────
echo "\n# 4. scheduled flush: many batches inside the time budget\n";
reset_state(); $GLOBALS['products'] = array(); make_products( 2000 );
for ( $i = 1; $i <= 2000; $i++ ) $sync->enqueue_delta( 'product', $i, 'product.updated' );
$GLOBALS['latency'] = 1.0;
$t = microtime( true );
$sync->run_scheduled_flush();
$took = microtime( true ) - $t;
$run = end( Vigent_Woo_Core::instance()->log )[1];
printf( "     run: %d batches, %d sent, %d remaining, stopped=%s, %.1fs\n", $run['batches'], $run['sent'], $run['remaining'], $run['stopped'], $took );
check( 'more than one batch in one run', $run['batches'] > 1 );
check( 'every batch at most 50 events', max( array_map( 'count', $GLOBALS['sent'] ) ) <= 50 );
check( 'run stayed inside ~20s budget', $took <= 21.5 );
check( 'stopped for time with work left', 'time' === $run['stopped'] && $run['remaining'] > 0 );
check( 'no event sent twice', count( sent_ids() ) === count( array_unique( sent_ids() ) ) );
check( 'follow-up single event scheduled once', 1 === count( array_filter( $GLOBALS['cron'], function ( $e ) { return 'vigent_woo_delta_flush_more' === $e['hook']; } ) ) );
// The follow-up firing in the same PHP process (both events due in one cron request).
$t = microtime( true );
$sync->run_scheduled_flush();
check( 'second run in same process does not exceed the shared budget', ( microtime( true ) - $t ) < 2.5 );
check( 'still exactly one follow-up event', 1 === count( array_filter( $GLOBALS['cron'], function ( $e ) { return 'vigent_woo_delta_flush_more' === $e['hook']; } ) ) );
// A fresh cron request (new process) drains the rest with no latency.
$r = new ReflectionProperty( 'Vigent_Woo_Sync', 'flush_seconds_spent' ); $r->setAccessible( true ); $r->setValue( $sync, 0.0 );
$GLOBALS['latency'] = 0.0; $GLOBALS['cron'] = array();
$sync->run_scheduled_flush();
$run = end( Vigent_Woo_Core::instance()->log )[1];
check( 'next run empties the queue, no follow-up', 0 === $run['remaining'] && 'empty' === $run['stopped'] && empty( $GLOBALS['cron'] ) );
check( 'all 2000 sent exactly once', 2000 === count( array_unique( sent_ids() ) ) && 2000 === count( sent_ids() ) );
// Manual (AJAX) flush still sends a single batch.
reset_state();
for ( $i = 1; $i <= 120; $i++ ) { $GLOBALS['products'][ $i ]['price'] = '7'; $sync->enqueue_delta( 'product', $i, 'product.updated' ); }
$r = $sync->flush_delta_queue( 50 );
check( 'manual flush sends one batch of 50', 1 === $r['batches'] && 50 === $r['sent'] && 70 === $r['remaining'] && 'limit' === $r['stopped'] );

// ── 5. Safeguards ──────────────────────────────────────────────────────
echo "\n# 5. locks, failures, byte budget, event_id check\n";
add_option( 'vigent_woo_delta_flush_lock', time() );
$r = $sync->flush_delta_queue( 50, 10, 0 );
check( 'held flush lock: nothing sent, reported busy', 0 === $r['sent'] && 'busy' === $r['stopped'] && $r['success'] );
delete_option( 'vigent_woo_delta_flush_lock' );
$GLOBALS['fail'] = true; $GLOBALS['cron'] = array();
$sync->run_scheduled_flush();
$run = end( Vigent_Woo_Core::instance()->log )[1];
$q = queue();
check( 'failed send stops after one batch, no follow-up', 1 === $run['batches'] && 'error' === $run['stopped'] && empty( $GLOBALS['cron'] ) );
check( 'failed entries counted against', 1 === $q['product:51']['attempts'] && 'boom' === $q['product:51']['last_error'] );
check( 'no hash stored for failed entries', '' === get_post_meta( 51, '_vigent_woo_sync_hash' ) );
$GLOBALS['fail'] = false;
// Dead-lettering still applies.
foreach ( $q as $k => $e ) $q[ $k ]['attempts'] = 11;
update_option( 'vigent_woo_delta_queue', $q );
$GLOBALS['fail'] = true; $before = count( $q );
$sync->flush_delta_queue( 50 );
check( 'twelfth failure dead-letters the batch', $before - 50 === count( queue() ) );
$GLOBALS['fail'] = false;
// Byte budget: big payloads split; rest stays queued for the next batch.
reset_state(); $GLOBALS['products'] = array();
for ( $i = 1; $i <= 10; $i++ ) { $GLOBALS['products'][ $i ] = array( 'description' => str_repeat( 'x', 600000 ) ); $sync->enqueue_delta( 'product', $i, 'product.updated' ); }
$r = $sync->flush_delta_queue( 50, 10, 0 );
check( 'oversized batch split into byte-budget requests', count( $GLOBALS['sent'] ) > 1 && max( array_map( function ( $b ) { return strlen( json_encode( $b ) ); }, $GLOBALS['sent'] ) ) <= 2097152 + 1024 );
check( 'all ten delivered across batches', 10 === count( sent_ids() ) && 0 === $r['remaining'] );
// A save during the send gets a new event_id and stays queued.
reset_state(); $GLOBALS['products'] = array(); make_products( 3 );
foreach ( array( 1, 2, 3 ) as $i ) $sync->enqueue_delta( 'product', $i, 'product.updated' );
$GLOBALS['during_send'] = function () use ( $sync ) { $GLOBALS['products'][2]['price'] = '5'; $sync->enqueue_delta( 'product', 2, 'product.updated' ); };
$r = $sync->flush_delta_queue( 50, 10, 1 );
check( 'entry changed mid-send stays queued (event_id check)', array( 'product:2' ) === array_keys( queue() ) );
$sync->flush_delta_queue();
check( 'and goes out on the next flush with the new price', '5' === end( $GLOBALS['sent'] )[0]['data']['price'] );
// Trash then restore: the delete clears the hash so the restore is sent.
reset_state(); $GLOBALS['products'] = array(); make_products( 1 );
$sync->enqueue_delta( 'product', 1, 'product.updated' ); $sync->flush_delta_queue();
$sync->enqueue_delta( 'product', 1, 'product.deleted', array( 'id' => 1 ) ); $sync->flush_delta_queue();
check( 'sent delete clears the stored hash', '' === get_post_meta( 1, '_vigent_woo_sync_hash' ) );
save_product( 1 ); end_request();
check( 'restored product is queued again', array( 'product:1' ) === array_keys( queue() ) );

echo "\n" . ( $fails ? "$fails FAILED\n" : "ALL PASSED\n" );
exit( $fails ? 1 : 0 );
