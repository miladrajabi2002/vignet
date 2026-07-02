<?php
/**
 * Plugin Name:       ویجنت — اتصال ووکامرس
 * Plugin URI:        https://vigent.ir/docs/woocommerce
 * Description:       محصولات و سفارش‌های ووکامرس را به ایجنت ویجنت می‌فرستد تا پاسخگوی هوش مصنوعی همیشه از قیمت و موجودی و وضعیت سفارش خبر داشته باشد.
 * Version:           1.0.0
 * Author:            Vigent
 * Author URI:        https://vigent.ir
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       vigent-woo
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * WC requires at least: 6.0
 *
 * این افزونه به‌صورت خودکار تغییرات محصول و سفارش را به webhook ویجنت ارسال می‌کند
 * و در صفحه تنظیمات دکمه‌ای برای هم‌گام‌سازی کامل دستی هم ارائه می‌دهد.
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit; // دسترسی مستقیم مسدود است.
}

define( 'VIGENT_WOO_VERSION', '1.0.0' );
define( 'VIGENT_WOO_OPTION', 'vigent_woo_settings' );

/**
 * تنظیمات پیش‌فرض هنگام فعال‌سازی.
 */
function vigent_woo_activate() {
        if ( false === get_option( VIGENT_WOO_OPTION ) ) {
                add_option(
                        VIGENT_WOO_OPTION,
                        array(
                                'webhook_url'      => '',
                                'webhook_secret'   => '',
                                'sync_products'    => '1',
                                'sync_orders'      => '1',
                        )
                );
        }
}
register_activation_hook( __FILE__, 'vigent_woo_activate' );

/**
 * گرفتن تنظیمات با مقادیر پیش‌فرض.
 *
 * @return array
 */
function vigent_woo_get_settings() {
        $defaults = array(
                'webhook_url'      => '',
                'webhook_secret'   => '',
                'sync_products'    => '1',
                'sync_orders'      => '1',
        );
        $saved   = get_option( VIGENT_WOO_OPTION, array() );
        if ( ! is_array( $saved ) ) {
                $saved = array();
        }
        return array_merge( $defaults, $saved );
}

/**
 * آیا هم‌گام‌سازی محصولات فعال است؟
 *
 * @return bool
 */
function vigent_woo_sync_products_enabled() {
        $s = vigent_woo_get_settings();
        return ! empty( $s['sync_products'] ) && ! empty( $s['webhook_url'] ) && ! empty( $s['webhook_secret'] );
}

/**
 * آیا هم‌گام‌سازی سفارش‌ها فعال است؟
 *
 * @return bool
 */
function vigent_woo_sync_orders_enabled() {
        $s = vigent_woo_get_settings();
        return ! empty( $s['sync_orders'] ) && ! empty( $s['webhook_url'] ) && ! empty( $s['webhook_secret'] );
}

// ─── ارسال رویداد به webhook ویجنت ──────────────────────────────────────────

/**
 * ارسال یک رویداد (product.created و غیره) به webhook ویجنت.
 * بدنه با HMAC-SHA256 امضا می‌شود تا سمت ویجنت بتواند صحت را بررسی کند.
 *
 * @param string $topic  موضوع رویداد (مثلاً product.created).
 * @param mixed  $data   دادهٔ رویداد (آرایه یا شیء قابل json_encode).
 * @return array         پاسخ شامل کد HTTP و بدنه.
 */
function vigent_woo_send_event( $topic, $data ) {
        $s = vigent_woo_get_settings();
        if ( empty( $s['webhook_url'] ) || empty( $s['webhook_secret'] ) ) {
                return array(
                        'code'    => 0,
                        'body'    => __( 'تنظیمات webhook کامل نیست.', 'vigent-woo' ),
                        'success' => false,
                );
        }

        // json_encode با حفظ یونیکد برای خوانایی لاگ‌ها.
        $body = wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
        if ( false === $body ) {
                return array(
                        'code'    => 0,
                        'body'    => __( 'خطا در ساخت JSON.', 'vigent-woo' ),
                        'success' => false,
                );
        }

        // امضای HMAC-SHA256 روی بدنهٔ خام.
        $signature = hash_hmac( 'sha256', $body, $s['webhook_secret'] );

        $response = wp_remote_post(
                $s['webhook_url'],
                array(
                        'method'      => 'POST',
                        'timeout'     => 30,
                        'redirection' => 5,
                        'headers'     => array(
                                'Content-Type'           => 'application/json; charset=utf-8',
                                'X-WC-Webhook-Topic'     => $topic,
                                'X-WC-Webhook-Signature' => $signature,
                        ),
                        'body'        => $body,
                )
        );

        if ( is_wp_error( $response ) ) {
                return array(
                        'code'    => 0,
                        'body'    => $response->get_error_message(),
                        'success' => false,
                );
        }

        $code = (int) wp_remote_retrieve_response_code( $response );
        return array(
                'code'    => $code,
                'body'    => wp_remote_retrieve_body( $response ),
                'success' => $code >= 200 && $code < 300,
        );
}

// ─── تبدیل محصول/سفارش به آرایهٔ قابل ارسال ───────────────────────────────

/**
 * تبدیل محصول ووکامرس به آرایهٔ مشابه خروجی REST API.
 *
 * @param WC_Product $product شیء محصول.
 * @return array
 */
function vigent_woo_product_to_payload( $product ) {
        if ( ! $product ) {
                return array();
        }

        $images = array();
        foreach ( $product->get_gallery_image_ids() as $id ) {
                $src = wp_get_attachment_image_url( $id, 'full' );
                if ( $src ) {
                        $images[] = array( 'src' => $src );
                }
        }
        $thumb = $product->get_image_id();
        if ( $thumb ) {
                $src = wp_get_attachment_image_url( $thumb, 'full' );
                if ( $src ) {
                        array_unshift( $images, array( 'src' => $src ) );
                }
        }

        $attrs = array();
        foreach ( $product->get_attributes() as $key => $value ) {
                $name = wc_attribute_label( $key );
                if ( is_array( $value ) ) {
                        $value = implode( ', ', $value );
                }
                $attrs[] = array(
                        'name'    => $name,
                        'options' => array_map( 'strval', (array) $value ),
                );
        }

        $tags = array();
        $terms = get_the_terms( $product->get_id(), 'product_tag' );
        if ( is_array( $terms ) ) {
                foreach ( $terms as $term ) {
                        $tags[] = array( 'name' => $term->name );
                }
        }

        return array(
                'id'                => $product->get_id(),
                'name'              => $product->get_name(),
                'sku'               => $product->get_sku(),
                'description'       => $product->get_description(),
                'short_description' => $product->get_short_description(),
                'price'             => $product->get_price(),
                'regular_price'     => $product->get_regular_price(),
                'sale_price'        => $product->get_sale_price(),
                'status'            => $product->get_status(),
                'manage_stock'      => $product->get_manage_stock(),
                'stock_quantity'    => $product->get_stock_quantity(),
                'in_stock'          => $product->is_in_stock(),
                'images'            => $images,
                'attributes'        => $attrs,
                'tags'              => $tags,
        );
}

/**
 * تبدیل سفارش ووکامرس به آرایهٔ مشابه خروجی REST API.
 *
 * @param WC_Order $order شیء سفارش.
 * @return array
 */
function vigent_woo_order_to_payload( $order ) {
        if ( ! $order ) {
                return array();
        }

        $line_items = array();
        foreach ( $order->get_items() as $item ) {
                $line_items[] = array(
                        'name'     => $item->get_name(),
                        'quantity' => $item->get_quantity(),
                        'total'    => $item->get_total(),
                        'sku'      => $item->get_product() ? $item->get_product()->get_sku() : '',
                );
        }

        $shipping_methods = array();
        foreach ( $order->get_shipping_methods() as $shipping ) {
                $shipping_methods[] = array(
                        'method_title' => $shipping->get_method_title(),
                );
        }

        $billing = $order->get_billing();

        return array(
                'id'                  => $order->get_id(),
                'number'              => $order->get_order_number(),
                'status'              => $order->get_status(),
                'currency'            => $order->get_currency(),
                'total'               => $order->get_total(),
                'customer_id'         => $order->get_customer_id(),
                'payment_method'      => $order->get_payment_method(),
                'payment_method_title'=> $order->get_payment_method_title(),
                'date_created'        => $order->get_date_created() ? $order->get_date_created()->date( 'c' ) : null,
                'date_created_gmt'    => $order->get_date_created() ? $order->get_date_created()->date( 'Y-m-d\TH:i:s' ) : null,
                'billing'             => array(
                        'first_name' => isset( $billing['first_name'] ) ? $billing['first_name'] : '',
                        'last_name'  => isset( $billing['last_name'] ) ? $billing['last_name'] : '',
                        'phone'      => isset( $billing['phone'] ) ? $billing['phone'] : '',
                        'email'      => isset( $billing['email'] ) ? $billing['email'] : '',
                ),
                'shipping'            => ! empty( $shipping_methods ) ? $shipping_methods[0] : array(),
                'line_items'          => $line_items,
        );
}

// ─── هوک‌های رویداد ووکامرس ─────────────────────────────────────────────────

/**
 * محصول ساخته یا به‌روزرسانی شد → product.created یا product.updated.
 */
function vigent_woo_on_product_save( $product_id, $is_new = false ) {
        if ( ! vigent_woo_sync_products_enabled() ) {
                return;
        }
        // واکنش به ویرایش‌های خودکار بازاریابی/گروه محصول را نادیده بگیر.
        if ( wp_is_post_revision( $product_id ) || wp_is_post_autosave( $product_id ) ) {
                return;
        }
        $product = wc_get_product( $product_id );
        if ( ! $product ) {
                return;
        }
        $topic   = $is_new ? 'product.created' : 'product.updated';
        $payload = vigent_woo_product_to_payload( $product );
        vigent_woo_send_event( $topic, $payload );
}
add_action( 'woocommerce_new_product', 'vigent_woo_on_product_new', 10, 2 );
add_action( 'woocommerce_update_product', 'vigent_woo_on_product_update', 10, 2 );

/**
 * Wrapper: new product hook (تنها آرگومان اول).
 */
function vigent_woo_on_product_new( $product_id, $product ) {
        vigent_woo_on_product_save( $product_id, true );
}

/**
 * Wrapper: update product hook.
 */
function vigent_woo_on_product_update( $product_id, $product ) {
        vigent_woo_on_product_save( $product_id, false );
}

/**
 * محصول حذف شد → product.deleted.
 * در رویداد trash و before_delete_post هنوز شیء محصول در دسترس است، پس
 * اطلاعات کامل (شامل sku و name) را می‌فرستیم تا سمت ویجنت بتوانیم دقیق‌تر
 * تطبیق بدهیم.
 *
 * @param int $post_id شناسهٔ پست (محصول).
 */
function vigent_woo_on_product_delete( $post_id ) {
        if ( ! vigent_woo_sync_products_enabled() ) {
                return;
        }
        // روی before_delete_post برای همهٔ پست‌تیپ‌ها صدا می‌شود؛ فقط محصول را پردازش کن.
        if ( 'product' !== get_post_type( $post_id ) ) {
                return;
        }
        $product = wc_get_product( $post_id );
        $payload = array( 'id' => (int) $post_id );
        if ( $product ) {
                $payload['sku']  = $product->get_sku();
                $payload['name'] = $product->get_name();
        }
        vigent_woo_send_event( 'product.deleted', $payload );
}
add_action( 'woocommerce_trash_product', 'vigent_woo_on_product_delete' );
add_action( 'before_delete_post', 'vigent_woo_on_product_delete' );

/**
 * وضعیت سفارش تغییر کرد → order.updated.
 */
function vigent_woo_on_order_status_changed( $order_id, $old_status, $new_status, $order ) {
        if ( ! vigent_woo_sync_orders_enabled() ) {
                return;
        }
        if ( ! $order ) {
                $order = wc_get_order( $order_id );
        }
        if ( ! $order ) {
                return;
        }
        $payload = vigent_woo_order_to_payload( $order );
        vigent_woo_send_event( 'order.updated', $payload );
}
add_action( 'woocommerce_order_status_changed', 'vigent_woo_on_order_status_changed', 10, 4 );

// ─── هم‌گام‌سازی کامل دستی ─────────────────────────────────────────────────

/**
 * هم‌گام‌سازی کامل: همهٔ محصولات و سفارش‌ها را در دسته‌های ۵۰تایی می‌فرستد.
 *
 * @param string $kind 'products' یا 'orders'.
 * @return array خلاصهٔ تعداد ارسالی + خطاها.
 */
function vigent_woo_full_sync( $kind = 'products' ) {
        $s = vigent_woo_get_settings();
        if ( empty( $s['webhook_url'] ) || empty( $s['webhook_secret'] ) ) {
                return array(
                        'sent'   => 0,
                        'errors' => array( __( 'تنظیمات webhook کامل نیست.', 'vigent-woo' ) ),
                );
        }

        $sent    = 0;
        $errors  = array();
        $per_page = 50;
        $page     = 1;

        if ( 'products' === $kind ) {
                if ( ! vigent_woo_sync_products_enabled() ) {
                        return array( 'sent' => 0, 'errors' => array( __( 'هم‌گام‌سازی محصولات غیرفعال است.', 'vigent-woo' ) ) );
                }
                while ( true ) {
                        $products = wc_get_products(
                                array(
                                        'status'  => 'publish',
                                        'limit'   => $per_page,
                                        'page'    => $page,
                                        'orderby' => 'date',
                                        'order'   => 'DESC',
                                        'return'  => 'objects',
                                )
                        );
                        if ( empty( $products ) ) {
                                break;
                        }
                        foreach ( $products as $product ) {
                                $payload = vigent_woo_product_to_payload( $product );
                                $result  = vigent_woo_send_event( 'product.created', $payload );
                                if ( ! empty( $result['success'] ) ) {
                                        $sent++;
                                } else {
                                        $errors[] = sprintf(
                                                /* translators: 1: product id, 2: error message */
                                                __( 'محصول #%1$d: %2$s', 'vigent-woo' ),
                                                $product->get_id(),
                                                $result['body']
                                        );
                                }
                        }
                        if ( count( $products ) < $per_page ) {
                                break;
                        }
                        $page++;
                }
        } elseif ( 'orders' === $kind ) {
                if ( ! vigent_woo_sync_orders_enabled() ) {
                        return array( 'sent' => 0, 'errors' => array( __( 'هم‌گام‌سازی سفارش‌ها غیرفعال است.', 'vigent-woo' ) ) );
                }
                while ( true ) {
                        $orders = wc_get_orders(
                                array(
                                        'limit'   => $per_page,
                                        'page'    => $page,
                                        'orderby' => 'date',
                                        'order'   => 'DESC',
                                        'return'  => 'objects',
                                )
                        );
                        if ( empty( $orders ) ) {
                                break;
                        }
                        foreach ( $orders as $order ) {
                                $payload = vigent_woo_order_to_payload( $order );
                                $result  = vigent_woo_send_event( 'order.created', $payload );
                                if ( ! empty( $result['success'] ) ) {
                                        $sent++;
                                } else {
                                        $errors[] = sprintf(
                                                /* translators: 1: order id, 2: error message */
                                                __( 'سفارش #%1$d: %2$s', 'vigent-woo' ),
                                                $order->get_id(),
                                                $result['body']
                                        );
                                }
                        }
                        if ( count( $orders ) < $per_page ) {
                                break;
                        }
                        $page++;
                }
        }

        return array( 'sent' => $sent, 'errors' => $errors );
}

// ─── صفحهٔ تنظیمات زیر منوی WooCommerce ─────────────────────────────────────

/**
 * افزودن زیرمنوی تنظیمات به منوی WooCommerce.
 */
function vigent_woo_add_admin_menu() {
        add_submenu_page(
                'woocommerce',
                __( 'ویجنت — اتصال', 'vigent-woo' ),
                __( 'ویجنت', 'vigent-woo' ),
                'manage_woocommerce',
                'vigent-woo',
                'vigent_woo_render_settings_page'
        );
}
add_action( 'admin_menu', 'vigent_woo_add_admin_menu' );

/**
 * نمایش صفحهٔ تنظیمات + دکمهٔ هم‌گام‌سازی دستی.
 */
function vigent_woo_render_settings_page() {
        if ( ! current_user_can( 'manage_woocommerce' ) ) {
                wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
        }

        // پردازش دکمه‌های هم‌گام‌سازی دستی (با nonce).
        $sync_result = null;
        if ( isset( $_GET['sync'] ) && check_admin_referer( 'vigent_woo_sync' ) ) {
                $kind = sanitize_text_field( wp_unslash( $_GET['sync'] ) );
                if ( in_array( $kind, array( 'products', 'orders' ), true ) ) {
                        $sync_result = vigent_woo_full_sync( $kind );
                }
        }

        $settings = vigent_woo_get_settings();
        ?>
        <div class="wrap">
                <h1><?php echo esc_html__( 'ویجنت — اتصال ووکامرس', 'vigent-woo' ); ?></h1>
                <p><?php echo esc_html__( 'این افزونه محصولات و سفارش‌های ووکامرس را به ایجنت ویجنت می‌فرستد تا هوش مصنوعی همیشه از اطلاعات فروشگاه خبر داشته باشد.', 'vigent-woo' ); ?></p>

                <?php if ( ! empty( $sync_result ) ) : ?>
                        <div class="notice notice-<?php echo empty( $sync_result['errors'] ) ? 'success' : 'warning'; ?> is-dismissible">
                                <p>
                                        <?php
                                        /* translators: %d: count */
                                        printf( esc_html__( 'تعداد ارسالی: %d', 'vigent-woo' ), (int) $sync_result['sent'] );
                                        ?>
                                </p>
                                <?php if ( ! empty( $sync_result['errors'] ) ) : ?>
                                        <ul style="list-style:disc; margin-left:20px;">
                                                <?php foreach ( array_slice( $sync_result['errors'], 0, 10 ) as $err ) : ?>
                                                        <li><?php echo esc_html( $err ); ?></li>
                                                <?php endforeach; ?>
                                        </ul>
                                <?php endif; ?>
                        </div>
                <?php endif; ?>

                <form method="post" action="options.php">
                        <?php settings_fields( 'vigent_woo_settings_group' ); ?>
                        <?php do_settings_sections( 'vigent-woo' ); ?>
                        <table class="form-table" role="presentation">
                                <tr>
                                        <th scope="row"><label for="vigent_woo_webhook_url"><?php esc_html_e( 'آدرس webhook ویجنت', 'vigent-woo' ); ?></label></th>
                                        <td>
                                                <input type="url" id="vigent_woo_webhook_url" name="vigent_woo_settings[webhook_url]"
                                                        value="<?php echo esc_attr( $settings['webhook_url'] ); ?>"
                                                        class="regular-text" placeholder="https://vigent.ir/api/sync/woocommerce?token=..." />
                                                <p class="description"><?php esc_html_e( 'این آدرس را از پنل ویجنت کپی کنید.', 'vigent-woo' ); ?></p>
                                        </td>
                                </tr>
                                <tr>
                                        <th scope="row"><label for="vigent_woo_webhook_secret"><?php esc_html_e( 'کلید امنیتی (webhook secret)', 'vigent-woo' ); ?></label></th>
                                        <td>
                                                <input type="text" id="vigent_woo_webhook_secret" name="vigent_woo_settings[webhook_secret]"
                                                        value="<?php echo esc_attr( $settings['webhook_secret'] ); ?>"
                                                        class="regular-text" autocomplete="off" />
                                                <p class="description"><?php esc_html_e( 'همان کلیدی که در پنل ویجنت برای اتصال نمایش داده شده است.', 'vigent-woo' ); ?></p>
                                        </td>
                                </tr>
                                <tr>
                                        <th scope="row"><?php esc_html_e( 'هم‌گام‌سازی محصولات', 'vigent-woo' ); ?></th>
                                        <td>
                                                <label>
                                                        <input type="checkbox" name="vigent_woo_settings[sync_products]" value="1" <?php checked( $settings['sync_products'], '1' ); ?> />
                                                        <?php esc_html_e( 'هنگام ساخت، ویرایش یا حذف محصول، آن را به ویجنت بفرست.', 'vigent-woo' ); ?>
                                                </label>
                                        </td>
                                </tr>
                                <tr>
                                        <th scope="row"><?php esc_html_e( 'هم‌گام‌سازی سفارش‌ها', 'vigent-woo' ); ?></th>
                                        <td>
                                                <label>
                                                        <input type="checkbox" name="vigent_woo_settings[sync_orders]" value="1" <?php checked( $settings['sync_orders'], '1' ); ?> />
                                                        <?php esc_html_e( 'هنگام تغییر وضعیت سفارش، آن را به ویجنت بفرست.', 'vigent-woo' ); ?>
                                                </label>
                                        </td>
                                </tr>
                        </table>
                        <?php submit_button( __( 'ذخیره تنظیمات', 'vigent-woo' ) ); ?>
                </form>

                <h2><?php esc_html_e( 'هم‌گام‌سازی کامل دستی', 'vigent-woo' ); ?></h2>
                <p><?php esc_html_e( 'اگر می‌خواهید همهٔ محصولات یا سفارش‌های فعلی را یک‌باره به ویجنت بفرستید، از دکمه‌های زیر استفاده کنید.', 'vigent-woo' ); ?></p>
                <p>
                        <a class="button button-primary" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin.php?page=vigent-woo&sync=products' ), 'vigent_woo_sync' ) ); ?>">
                                <?php esc_html_e( 'ارسال همهٔ محصولات', 'vigent-woo' ); ?>
                        </a>
                        <a class="button button-secondary" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin.php?page=vigent-woo&sync=orders' ), 'vigent_woo_sync' ) ); ?>">
                                <?php esc_html_e( 'ارسال همهٔ سفارش‌ها', 'vigent-woo' ); ?>
                        </a>
                </p>
        </div>
        <?php
}

/**
 * ثبت تنظیمات برای ذخیره‌سازی امن.
 */
function vigent_woo_register_settings() {
        register_setting(
                'vigent_woo_settings_group',
                VIGENT_WOO_OPTION,
                array(
                        'type'              => 'array',
                        'sanitize_callback' => 'vigent_woo_sanitize_settings',
                        'default'           => array(
                                'webhook_url'      => '',
                                'webhook_secret'   => '',
                                'sync_products'    => '1',
                                'sync_orders'      => '1',
                        ),
                )
        );
}
add_action( 'admin_init', 'vigent_woo_register_settings' );

/**
 * پاک‌سازی ورودی تنظیمات با sanitize_text_field.
 *
 * @param array $input ورودی خام.
 * @return array
 */
function vigent_woo_sanitize_settings( $input ) {
        $out = array(
                'webhook_url'    => '',
                'webhook_secret' => '',
                'sync_products'  => '',
                'sync_orders'    => '',
        );

        if ( isset( $input['webhook_url'] ) ) {
                $out['webhook_url'] = sanitize_text_field( $input['webhook_url'] );
        }
        if ( isset( $input['webhook_secret'] ) ) {
                $out['webhook_secret'] = sanitize_text_field( $input['webhook_secret'] );
        }
        if ( isset( $input['sync_products'] ) ) {
                $out['sync_products'] = $input['sync_products'] ? '1' : '';
        }
        if ( isset( $input['sync_orders'] ) ) {
                $out['sync_orders'] = $input['sync_orders'] ? '1' : '';
        }

        return $out;
}
