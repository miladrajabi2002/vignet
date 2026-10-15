<?php
/**
 * Exercises Vigent_Woo_Checkout::rest_place (POST checkout/place, 5.2+)
 * against minimal WordPress/WooCommerce stubs: a paid order at the price the
 * customer paid, the retry returning the same order, a sold-out line still
 * recorded with a note, the mismatch note, and the empty-store refusal.
 * Not shipped in the zip.
 *
 * Run: php wordpress-plugin/tests/place-order-harness.php
 */
define( 'ABSPATH', __DIR__ );
define( 'VIGENT_WOO_VERSION', 'test' );
define( 'WC_VERSION', '9.0.0' );

$GLOBALS['opts']     = array();
$GLOBALS['orders']   = array();
$GLOBALS['products'] = array();

function add_action() {}
function add_filter() {}
function __( $t ) { return $t; }
function absint( $v ) { return abs( (int) $v ); }
function sanitize_text_field( $v ) { return trim( (string) $v ); }
function sanitize_textarea_field( $v ) { return trim( (string) $v ); }
function sanitize_email( $v ) { return (string) $v; }
function sanitize_key( $v ) { return strtolower( (string) $v ); }
function esc_url_raw( $v ) { return (string) $v; }
function wc_format_coupon_code( $v ) { return (string) $v; }
function wc_format_decimal( $v, $dp = 0 ) { return number_format( (float) $v, $dp, '.', '' ); }
function home_url() { return 'https://shop.test'; }
function untrailingslashit( $v ) { return rtrim( $v, '/' ); }
function wc_get_order_statuses() { return array( 'wc-pending' => 1, 'wc-processing' => 1, 'wc-completed' => 1 ); }
function get_option( $k, $d = false ) { return array_key_exists( $k, $GLOBALS['opts'] ) ? $GLOBALS['opts'][ $k ] : $d; }
function add_option( $k, $v ) { if ( array_key_exists( $k, $GLOBALS['opts'] ) ) return false; $GLOBALS['opts'][ $k ] = $v; return true; }
function delete_option( $k ) { unset( $GLOBALS['opts'][ $k ] ); return true; }
function taxonomy_exists() { return false; }
function rest_ensure_response( $v ) { return $v; }
function is_wp_error( $v ) { return $v instanceof WP_Error; }

class WP_Error {
	public $code; public $data;
	public function __construct( $code, $message = '', $data = array() ) { $this->code = $code; $this->data = $data; }
}
class WP_REST_Request {
	private $body;
	public function __construct( $body ) { $this->body = $body; }
	public function get_json_params() { return $this->body; }
}
class Countries { public function get_states() { return array( 'THR' => 'تهران', 'FRS' => 'فارس' ); } }
function WC() { static $wc; if ( ! $wc ) { $wc = new stdClass(); $wc->countries = new Countries(); } return $wc; }

class Product {
	public $id; public $name; public $stock;
	public function __construct( $id, $name, $stock ) { $this->id = $id; $this->name = $name; $this->stock = $stock; }
	public function get_status() { return 'publish'; }
	public function is_type( $t ) { return 'simple' === $t; }
	public function is_in_stock() { return $this->stock > 0; }
	public function has_enough_stock( $q ) { return $this->stock >= $q; }
	public function get_name() { return $this->name; }
	public function get_id() { return $this->id; }
}
function wc_get_product( $id ) { return $GLOBALS['products'][ $id ] ?? null; }

class WC_Order_Item_Shipping {
	public $title; public $total = 0;
	public function set_method_title( $t ) { $this->title = $t; }
	public function set_method_id() {}
	public function set_total( $t ) { $this->total = $t; }
}
class WC_Order {
	public $id; public $items = array(); public $meta = array(); public $notes = array(); public $status = 'pending';
	public $address = array(); public $method = ''; public $method_title = ''; public $transaction = ''; public $total = 0; public $paid = false; public $deleted = false;
	public function __construct( $id ) { $this->id = $id; }
	public function add_product( $p, $q, $args = array() ) { $this->items[] = array( 'product' => $p, 'qty' => $q, 'total' => $args['total'] ?? 1000 * $q ); }
	public function get_items() { return $this->items; }
	public function add_item( $item ) { $this->items[] = array( 'shipping' => $item ); }
	public function set_address( $a, $type ) { $this->address[ $type ] = $a; }
	public function set_customer_note() {}
	public function update_meta_data( $k, $v ) { $this->meta[ $k ] = $v; }
	public function get_meta( $k ) { return $this->meta[ $k ] ?? ''; }
	public function set_payment_method( $m ) { $this->method = $m; }
	public function set_payment_method_title( $t ) { $this->method_title = $t; }
	public function calculate_totals() { $this->total = 0; foreach ( $this->items as $i ) { $this->total += isset( $i['shipping'] ) ? $i['shipping']->total : $i['total']; } return $this->total; }
	public function save() { $GLOBALS['orders'][ $this->id ] = $this; }
	public function delete() { $this->deleted = true; unset( $GLOBALS['orders'][ $this->id ] ); }
	public function add_order_note( $n ) { $this->notes[] = $n; }
	public function get_total() { return $this->total; }
	public function payment_complete( $tx ) { $this->transaction = $tx; $this->paid = true; $this->status = 'processing'; }
	public function get_id() { return $this->id; }
	public function get_order_number() { return (string) $this->id; }
	public function get_status() { return $this->status; }
	public function is_paid() { return $this->paid; }
	public function get_date_paid() { return null; }
	public function get_shipping_total() { return 0; }
	public function get_discount_total() { return 0; }
	public function get_currency() { return 'IRT'; }
	public function get_payment_method() { return $this->method; }
	public function get_payment_method_title() { return $this->method_title; }
	public function get_transaction_id() { return $this->transaction; }
	public function needs_payment() { return ! $this->paid; }
	public function get_checkout_payment_url() { return ''; }
}
function wc_create_order() { static $next = 1047; $next++; return new WC_Order( $next ); }
function wc_get_orders( $q ) {
	$out = array();
	foreach ( $GLOBALS['orders'] as $o ) {
		if ( $o->get_meta( $q['meta_key'] ) === $q['meta_value'] ) $out[] = $o;
	}
	return $out;
}

class Vigent_Woo_Core {
	public static function instance() { static $i; return $i ? $i : ( $i = new self() ); }
	public function get_settings() { return array( 'webhook_secret' => 's' ); }
	public function is_configured() { return true; }
	public function debug_log() {}
}

require dirname( __DIR__ ) . '/vigent-woo/includes/class-vigent-woo-checkout.php';

$fails = 0;
function check( $label, $ok ) {
	global $fails;
	echo ( $ok ? '  ok   ' : '  FAIL ' ) . $label . "\n";
	if ( ! $ok ) $fails++;
}

$GLOBALS['products'][10] = new Product( 10, 'میز TV آرتا', 5 );
$GLOBALS['products'][11] = new Product( 11, 'پاف مخمل', 0 );
$checkout = Vigent_Woo_Checkout::instance();
$body     = array(
	'code'     => 'A7K2Q9',
	'channel'  => 'INSTAGRAM',
	'items'    => array( array( 'product_id' => 10, 'variation_id' => 0, 'quantity' => 2, 'name' => 'میز TV آرتا', 'unit_price' => 3450000 ) ),
	'customer' => array( 'first_name' => 'نگار', 'last_name' => 'رضایی', 'phone' => '09120000000', 'province' => '', 'city' => 'شیراز', 'address' => 'خیابان زند', 'postcode' => '' ),
	'note'     => '',
	'shipping' => array( 'label' => 'پست پیشتاز', 'cost' => 80000 ),
	'payment'  => array( 'amount' => 6980000, 'reference' => 'A7K2Q9', 'card' => '…5675', 'confirmed_by' => 'AUTO' ),
);

echo "place a paid order\n";
$first = $checkout->rest_place( new WP_REST_Request( $body ) );
check( 'answers ok and created', is_array( $first ) && true === $first['ok'] && true === $first['created'] );
$order = $GLOBALS['orders'][ $first['order_id'] ] ?? null;
check( 'order is paid and processing', $order && $order->paid && 'processing' === $first['status'] );
check( 'line priced at what the customer paid', $order && 6900000.0 === (float) $order->items[0]['total'] );
check( 'shipping line added', $order && 6980000.0 === (float) $order->get_total() );
check( 'payment method is the Vigent card', 'vigent_card' === $first['payment_method'] && '' !== $first['payment_method_title'] );
check( 'chat code tagged for status events', $order && 'A7K2Q9' === $order->get_meta( '_vigent_cart_code' ) && 'card_transfer' === $order->get_meta( '_vigent_checkout_flow' ) );
check( 'province resolved from the city', $order && 'FRS' === $order->address['billing']['state'] );
check( 'no mismatch note', $order && 1 === count( $order->notes ) );

echo "retry\n";
$again = $checkout->rest_place( new WP_REST_Request( $body ) );
check( 'same order, not created again', $again['order_id'] === $first['order_id'] && false === $again['created'] && 1 === count( $GLOBALS['orders'] ) );

echo "sold-out line and a different total\n";
$sold = $body;
$sold['code']     = 'B1C2D3';
$sold['items'][]  = array( 'product_id' => 11, 'variation_id' => 0, 'quantity' => 1, 'name' => 'پاف مخمل', 'unit_price' => 900000 );
$sold['shipping'] = null;
$res              = $checkout->rest_place( new WP_REST_Request( $sold ) );
$o2               = $GLOBALS['orders'][ $res['order_id'] ] ?? null;
check( 'still created with both lines', $o2 && 2 === count( $o2->items ) );
check( 'stock and amount notes added', $o2 && 3 === count( $o2->notes ) );

echo "nothing on the store\n";
$none          = $body;
$none['code']  = 'Z9Z9Z9';
$none['items'] = array( array( 'product_id' => 99, 'variation_id' => 0, 'quantity' => 1, 'name' => 'x', 'unit_price' => 1 ) );
$err           = $checkout->rest_place( new WP_REST_Request( $none ) );
check( 'refused with 422 and no order left', $err instanceof WP_Error && 422 === $err->data['status'] && 2 === count( $GLOBALS['orders'] ) );

echo $fails ? "\n{$fails} failed\n" : "\nall passed\n";
exit( $fails ? 1 : 0 );
