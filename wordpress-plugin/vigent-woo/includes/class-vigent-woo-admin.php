<?php
/**
 * Admin class — single tab, auto-connect button, minimal black/white UI.
 *
 *  Flow:
 *   1. Not configured → big centered "اتصال" button.
 *   2. Connected but not yet pushed → "ارسال محصولات" centered wizard with
 *      optional "ارسال سفارش‌ها" toggle + live progress bar.
 *   3. After push → "با موفقیت وصل شد" centered success card + compact
 *      management section (counts, manual re-sync, settings toggles).
 *
 * @package VigentWoo
 */

if ( ! defined( 'ABSPATH' ) ) {
        exit;
}

class Vigent_Woo_Admin {

        private static $instance = null;

        public static function instance() {
                if ( null === self::$instance ) {
                        self::$instance = new self();
                }
                return self::$instance;
        }

        private function __construct() {
                add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
                add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
                add_filter( 'plugin_action_links_' . plugin_basename( dirname( __DIR__ ) . '/vigent-woo.php' ), array( $this, 'add_action_links' ) );
        }

        private function core() {
                return Vigent_Woo_Core::instance();
        }

        // ─── Menu — single page ──────────────────────────────────────────────

        public function add_admin_menu() {
                add_menu_page(
                        __( 'ویجنت', 'vigent-woo' ),
                        __( 'ویجنت', 'vigent-woo' ),
                        'manage_options',
                        'vigent-woo',
                        array( $this, 'render_page' ),
                        'data:image/svg+xml;base64,' . base64_encode( $this->get_logo_svg() ),
                        56
                );
        }

        public function add_action_links( $links ) {
                $settings_link = sprintf(
                        '<a href="%s">%s</a>',
                        esc_url( admin_url( 'admin.php?page=vigent-woo' ) ),
                        __( 'ویجنت', 'vigent-woo' )
                );
                array_unshift( $links, $settings_link );
                return $links;
        }

        private function get_logo_svg() {
                return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" rx="4" fill="#000"/><path d="M5 6l5 8 5-8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        }

        // ─── Assets ──────────────────────────────────────────────────────────

        public function enqueue_assets( $hook ) {
                if ( false === strpos( $hook, 'vigent-woo' ) ) {
                        return;
                }
                $this->output_inline_styles();
                $this->output_inline_scripts();
        }

        private function output_inline_styles() {
                ?>
                <style>
                        .vg-wrap { max-width: 760px; margin: 0 auto; padding: 20px 0 40px; font-family: -apple-system, "IRANSansWeb", "Vazirmatn", Tahoma, sans-serif; }
                        .vg-wrap * { box-sizing: border-box; }

                        /* Header — black, minimal */
                        .vg-header { display: flex; align-items: center; gap: 14px; padding: 20px 24px; background: #000; border-radius: 16px; color: #fff; margin-bottom: 20px; }
                        .vg-logo { width: 40px; height: 40px; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                        .vg-logo svg { width: 24px; height: 24px; }
                        .vg-header h1 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; color: #fff; }
                        .vg-header .sub { margin: 3px 0 0; font-size: 12px; opacity: .6; color: #fff; }
                        .vg-header .last-check { margin: 2px 0 0; font-size: 10px; opacity: .45; color: #fff; }
                        .vg-header .pill { padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; }
                        /* Disconnect button in header — red tint, sits next to the status pill */
                        .vg-header .vg-btn-disconnect { margin-inline-start: auto; display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,.2); background: rgba(239,68,68,.15); color: #fca5a5; transition: all .12s; min-height: 44px; }
                        .vg-header .vg-btn-disconnect:hover { background: rgba(239,68,68,.3); color: #fff; border-color: rgba(239,68,68,.5); }
                        .vg-header .vg-btn-disconnect:disabled { opacity: .4; cursor: not-allowed; }
                        /* Update button in header — subtle blue tint, sits next to the disconnect button */
                        .vg-header .vg-btn-update { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,.2); background: rgba(59,130,246,.15); color: #93c5fd; transition: all .12s; min-height: 44px; }
                        .vg-header .vg-btn-update:hover { background: rgba(59,130,246,.3); color: #fff; border-color: rgba(59,130,246,.5); }
                        .vg-header .vg-btn-update:disabled { opacity: .4; cursor: not-allowed; }
                        .vg-header .vg-btn-update.has-update { background: rgba(16,185,129,.25); color: #6ee7b7; border-color: rgba(16,185,129,.5); animation: vg-pulse 1.8s ease-in-out infinite; }
                        @keyframes vg-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,.4); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } }
                        .vg-update-banner { background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #93c5fd; border-radius: 14px; padding: 16px 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 14px; }
                        .vg-update-banner .icon { width: 38px; height: 38px; border-radius: 10px; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                        .vg-update-banner .text { flex: 1; font-size: 13px; color: #1e3a8a; line-height: 1.6; }
                        .vg-update-banner .text strong { display: block; font-weight: 700; margin-bottom: 2px; color: #1e40af; }
                        .vg-update-banner .vg-btn-install { background: #3b82f6; color: #fff; padding: 9px 18px; border-radius: 10px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all .12s; min-height: 36px; }
                        .vg-update-banner .vg-btn-install:hover { background: #2563eb; color: #fff; }
                        .vg-header .pill.ok { background: rgba(16, 185, 129, .2); color: #6ee7b7; }
                        .vg-header .pill.warn { background: rgba(245, 158, 11, .2); color: #fcd34d; }
                        .vg-header .pill.err { background: rgba(239, 68, 68, .2); color: #fca5a5; }

                        /* Card — white, soft border */
                        .vg-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 16px; }
                        .vg-card h2 { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #111; }
                        .vg-card p { margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6; }
                        .vg-card p:last-child { margin-bottom: 0; }
                        /* Card variant for a change that had to be dropped from the queue. */
                        .vg-card.vg-warn { background: #fffbeb; border-color: #fde68a; }
                        .vg-card.vg-warn p { color: #92400e; }

                        /* Live status banner */
                        .vg-live { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid; }
                        .vg-live.connected { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
                        .vg-live.disconnected { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
                        .vg-live.pending { background: #fffbeb; border-color: #fde68a; color: #92400e; }
                        .vg-live .icon { width: 20px; height: 20px; flex-shrink: 0; font-size: 18px; line-height: 1; }
                        .vg-live .text { flex: 1; font-size: 13px; }
                        .vg-live .text strong { display: block; font-weight: 700; margin-bottom: 2px; }
                        .vg-live .text small { font-size: 11px; opacity: .8; }

                        /* Buttons — black/white */
                        .vg-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
                        .vg-btns-center { justify-content: center; }
                        .vg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; cursor: pointer; border: 1px solid transparent; text-decoration: none; transition: all .12s; min-height: 44px; }
                        .vg-btn-black { background: #000; color: #fff; }
                        .vg-btn-black:hover { background: #1a1a1a; color: #fff; }
                        .vg-btn-white { background: #fff; border-color: #d1d5db; color: #111; }
                        .vg-btn-white:hover { background: #f9fafb; }
                        .vg-btn:disabled { opacity: .4; cursor: not-allowed; }

                        /* Form */
                        .vg-field { margin-bottom: 14px; }
                        .vg-field label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 5px; }
                        .vg-field input, .vg-field select { width: 100%; padding: 11px 13px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 13px; font-family: "SF Mono", "Vazirmatn", monospace; direction: ltr; text-align: left; transition: border-color .12s; }
                        .vg-field input:focus, .vg-field select:focus { outline: none; border-color: #000; }
                        .vg-field .hint { font-size: 11px; color: #9ca3af; margin-top: 4px; }

                        /* Minimal select — used for the category filter, RTL-friendly */
                        .vg-select-minimal { width: 100%; padding: 10px 36px 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 13px; font-family: inherit; background-color: #fff; color: #111; cursor: pointer; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3e%3cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3e%3c/svg%3e"); background-repeat: no-repeat; background-position: left 10px center; background-size: 16px; transition: border-color .12s, box-shadow .12s; direction: rtl; text-align: right; }
                        .vg-select-minimal:focus { outline: none; border-color: #000; box-shadow: 0 0 0 3px rgba(0,0,0,.05); }
                        .vg-select-minimal:hover { border-color: #9ca3af; }

                        /* Toggle */
                        .vg-toggle { display: flex; align-items: flex-start; gap: 10px; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: background-color .12s; }
                        .vg-toggle:hover { background: #fafafa; }
                        .vg-toggle input { margin-top: 2px; width: 18px; height: 18px; accent-color: #000; }
                        .vg-toggle .label { font-size: 13px; font-weight: 600; color: #111; }
                        .vg-toggle .sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
                        .vg-toggle.off { opacity: .5; }

                        /* Progress */
                        .vg-progress { margin: 16px 0; }
                        .vg-progress-bar-wrap { background: #f3f4f6; border-radius: 999px; height: 24px; overflow: hidden; position: relative; }
                        .vg-progress-bar { background: #000; height: 100%; border-radius: 999px; transition: width .4s ease; width: 0%; }
                        .vg-progress-text { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }
                        .vg-progress-info { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: #6b7280; }

                        /* Stats — compact, used in management section after first push */
                        .vg-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
                        .vg-stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; text-align: center; }
                        .vg-stat .num { font-size: 26px; font-weight: 800; color: #000; line-height: 1; }
                        .vg-stat .lbl { font-size: 11px; color: #9ca3af; margin-top: 5px; }
                        /* Highlighted stat for "paying customers" — distinct accent so it stands out. */
                        .vg-stat.vg-stat-payers { background: #f0fdf4; border-color: #bbf7d0; }
                        .vg-stat.vg-stat-payers .num { color: #15803d; }
                        .vg-stat.vg-stat-payers .lbl { color: #16a34a; }

                        /* Action card: "Add all paying customers" — sits right under the stats. */
                        .vg-payers-card { padding: 18px 20px; }
                        .vg-payers-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
                        .vg-payers-copy { flex: 1 1 320px; min-width: 0; }
                        .vg-payers-copy h2 { margin: 0 0 6px; font-size: 15px; font-weight: 800; color: #000; }
                        .vg-payers-copy p { margin: 0 0 4px; font-size: 13px; color: #374151; line-height: 1.7; }
                        .vg-payers-copy .vg-payers-sub { color: #6b7280; font-size: 12px; }
                        .vg-payers-actions { flex-shrink: 0; }

                        /* Steps list */
                        .vg-steps { list-style: none; padding: 0; margin: 12px 0 0; }
                        .vg-steps li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; font-size: 13px; color: #374151; line-height: 1.6; }
                        .vg-steps li .num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: #000; color: #fff; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
                        .vg-steps li .txt { flex: 1; }
                        .vg-steps li .txt strong { color: #111; display: block; margin-bottom: 2px; font-size: 13px; }

                        /* Spinner */
                        .vg-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: vg-spin .6s linear infinite; }
                        @keyframes vg-spin { to { transform: rotate(360deg); } }

                        /* ─── Centered connect / push / done cards ─── */
                        .vg-center-card { text-align: center; padding: 48px 24px; }
                        .vg-center-icon { display: flex; justify-content: center; margin-bottom: 20px; }
                        .vg-center-icon svg { opacity: .8; }
                        .vg-center-title { font-size: 22px; font-weight: 800; color: #111; margin: 0 0 8px; }
                        .vg-center-sub { font-size: 14px; color: #6b7280; max-width: 460px; margin: 0 auto 32px; line-height: 1.7; }
                        .vg-center-btn-wrap { display: flex; justify-content: center; margin-bottom: 32px; }
                        .vg-btn-center { background: #000; color: #fff; padding: 16px 40px; font-size: 16px; font-weight: 700; border-radius: 14px; min-height: 56px; display: inline-flex; align-items: center; gap: 10px; transition: all .15s; text-decoration: none; border: none; cursor: pointer; }
                        .vg-btn-center:hover { background: #1a1a1a; color: #fff; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,.15); }
                        .vg-btn-center:disabled { opacity: .5; cursor: not-allowed; transform: none; box-shadow: none; }
                        .vg-center-steps { max-width: 420px; margin: 0 auto; text-align: center; }
                        .vg-center-steps li { flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 14px 0; }
                        .vg-center-steps li .num { width: 32px; height: 32px; font-size: 13px; margin: 0; }
                        .vg-center-steps li .txt { text-align: center; }
                        .vg-center-steps li .txt strong { text-align: center; margin-bottom: 4px; }
                        .vg-center-info { background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 18px 22px; max-width: 420px; margin: 24px auto 0; text-align: center; }
                        .vg-center-info p { font-size: 12px; font-weight: 600; color: #374151; margin: 0 0 8px; text-align: center; }
                        .vg-center-info ul { list-style: none; padding: 0; margin: 0; text-align: center; }
                        .vg-center-info ul li { font-size: 12px; color: #6b7280; line-height: 1.8; text-align: center; }

                        /* Push wizard steps (visual indicator) — horizontal pill row:
                              (1) ─── (2) ─── (3)
                           Each step is a self-contained pill with the number on the LEFT
                           and the label on the RIGHT, separated by a thin line. The number
                           stays inline (not on top) because horizontal space is tight when
                           "سفارش‌ها" is shown. */
                        .vg-wizard-steps { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; margin: 0 auto 24px; max-width: 520px; }
                        .vg-wizard-step { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px; background: #f3f4f6; font-size: 12px; color: #9ca3af; font-weight: 600; transition: all .2s; }
                        .vg-wizard-step .dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9ca3af; background: #fff; flex-shrink: 0; }
                        .vg-wizard-step.active { color: #111; background: #f3f4f6; }
                        .vg-wizard-step.active .dot { background: #000; border-color: #000; color: #fff; }
                        .vg-wizard-step.done { color: #10b981; background: #ecfdf5; }
                        .vg-wizard-step.done .dot { background: #10b981; border-color: #10b981; color: #fff; }
                        .vg-wizard-line { width: 20px; height: 2px; background: #e5e7eb; flex-shrink: 0; }

                        .vg-connected-summary { display: flex; align-items: center; gap: 14px; padding: 20px; }
                        .vg-connected-icon { flex: 0 0 auto; display: flex; }
                        .vg-connected-copy { flex: 1; min-width: 180px; }
                        .vg-connected-copy h2 { margin-bottom: 4px; }
                        .vg-connected-copy p { margin: 0; }
                        .vg-sync-note { color: #059669 !important; font-size: 11px !important; margin-top: 4px !important; }
                        .vg-connected-actions { margin: 0; justify-content: flex-end; }
                        .vg-btn:focus-visible, .vg-btn-center:focus-visible, .vg-btn-update:focus-visible, .vg-btn-disconnect:focus-visible { outline: 3px solid #60a5fa; outline-offset: 2px; }
                        @media (max-width: 680px) {
                                .vg-wrap { padding-inline: 10px; }
                                .vg-header, .vg-connected-summary { flex-wrap: wrap; }
                                .vg-header .vg-btn-disconnect { margin-inline-start: 0; }
                                .vg-connected-actions { width: 100%; justify-content: stretch; }
                                .vg-connected-actions .vg-btn { flex: 1; justify-content: center; }
                                .vg-stats { grid-template-columns: repeat(2, 1fr); }
                        }
                        @media (prefers-reduced-motion: reduce) {
                                .vg-wrap *, .vg-wrap *::before, .vg-wrap *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
                        }
                </style>
                <?php
        }

        private function output_inline_scripts() {
                $ajax_url = admin_url( 'admin-ajax.php' );
                $nonce    = wp_create_nonce( VIGENT_WOO_NONCE );
                $has_wc   = $this->core()->has_wc();
                $pushed   = (int) get_option( 'vigent_woo_initial_push_done', 0 ) === 1;

                ?>
                <script>
                        window.VG = {
                                ajaxUrl: '<?php echo esc_js( $ajax_url ); ?>',
                                nonce: '<?php echo esc_js( $nonce ); ?>',
                                hasWc: <?php echo $has_wc ? 'true' : 'false'; ?>,
                                pushed: <?php echo $pushed ? 'true' : 'false'; ?>,
                                i18n: {
                                        connecting: '<?php echo esc_js( __( 'در حال اتصال…', 'vigent-woo' ) ); ?>',
                                        syncing: '<?php echo esc_js( __( 'در حال ارسال…', 'vigent-woo' ) ); ?>',
                                        done: '<?php echo esc_js( __( 'تکمیل شد', 'vigent-woo' ) ); ?>',
                                        sendingProducts: '<?php echo esc_js( __( 'در حال ارسال محصولات…', 'vigent-woo' ) ); ?>',
                                        sendingOrders: '<?php echo esc_js( __( 'در حال ارسال سفارش‌ها…', 'vigent-woo' ) ); ?>',
                                        finalizing: '<?php echo esc_js( __( 'در حال نهایی‌سازی…', 'vigent-woo' ) ); ?>',
                                        productSent: '<?php echo esc_js( __( 'محصولات ارسال شد', 'vigent-woo' ) ); ?>',
                                        ordersSent: '<?php echo esc_js( __( 'سفارش‌ها ارسال شد', 'vigent-woo' ) ); ?>',
                                        checkingUpdate: '<?php echo esc_js( __( 'بررسی…', 'vigent-woo' ) ); ?>',
                                },
                        };

                        // ─── AJAX helper ───────────────────────────────────────────────
                        // Centralized fetch + response parsing. Handles three failure modes
                        // that WordPress admin-ajax.php can produce:
                        //   1. Empty body  — PHP fatal error with display_errors off.
                        //   2. HTML body   — PHP fatal error / warning rendered as HTML, or a
                        //      security plugin injecting markup. Without this the browser's
                        //      JSON parser throws "Unexpected token '<'" which is useless.
                        //   3. Malformed JSON — shouldn't happen, but defensive.
                        // On success resolves with the parsed object; on failure rejects with
                        // an Error whose .message is a localized, human-readable description
                        // (including the raw response text so the admin can see exactly what
                        // the server returned).
                        //
                        // The error object carries a `.transient` boolean flag so callers
                        // can decide whether to retry. HTML/empty/network errors are
                        // transient (the WordPress host is temporarily down — DB connection
                        // error, server restart, etc.) and usually recover within seconds.
                        // JSON errors (success:false with a message) are NOT transient —
                        // retrying won't help.
                        function vgAjax(formData) {
                                return fetch(window.VG.ajaxUrl, { method: 'POST', body: formData })
                                        .then(function(r) {
                                                // Network-level failure (server unreachable, DNS failure,
                                                // CORS). fetch() rejects with a TypeError — we catch it
                                                // below and flag it as transient.
                                                if (!r.ok && r.status === 0) {
                                                        var err = new Error('<?php echo esc_js( __( "خطای شبکه — سرور در دسترس نیست.", "vigent-woo" ) ); ?>');
                                                        err.transient = true;
                                                        throw err;
                                                }
                                                return r.text().then(function(text) {
                                                        var trimmed = text ? text.trim() : '';
                                                        if (trimmed === '') {
                                                                var emptyErr = new Error('<?php echo esc_js( __( "پاسخ خالی از سرور دریافت شد. احتمالاً خطای زمان اجرای PHP (مثل کمبود حافظه) رخ داده.", "vigent-woo" ) ); ?>');
                                                                emptyErr.transient = true;
                                                                throw emptyErr;
                                                        }
                                                        if (trimmed.charAt(0) === '<') {
                                                                // HTML response — strip tags and keep the first 500 chars.
                                                                var stripped = trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                                                                if (stripped.length > 500) stripped = stripped.substring(0, 500) + '…';
                                                                var htmlErr = new Error('<?php echo esc_js( __( "سرور پاسخ HTML (نه JSON) برگرداند — احتمالاً خطای PHP:", "vigent-woo" ) ); ?>\n' + stripped);
                                                                // HTML errors (DB connection error, 500, fatal error) are
                                                                // transient — the WordPress host usually recovers within
                                                                // a few seconds. Flag for retry.
                                                                htmlErr.transient = true;
                                                                throw htmlErr;
                                                        }
                                                        try {
                                                                return JSON.parse(trimmed);
                                                        } catch (e) {
                                                                var jsonErr = new Error('<?php echo esc_js( __( "پاسخ نامعتبر از سرور:", "vigent-woo" ) ); ?>\n' + trimmed.substring(0, 500));
                                                                jsonErr.transient = false;
                                                                throw jsonErr;
                                                        }
                                                });
                                        })
                                        .catch(function(err) {
                                                // fetch() rejects with TypeError on network failures. Mark
                                                // these as transient so vgAjaxWithRetry will retry them.
                                                if (err && !err.transient && err instanceof TypeError) {
                                                        err.transient = true;
                                                }
                                                throw err;
                                        });
                        }

                        // ─── AJAX helper with retry ────────────────────────────────────
                        // Wraps vgAjax with automatic retry for transient failures.
                        // When the WordPress host returns HTML (DB connection error, 500,
                        // server restart) or is unreachable, we retry up to `maxRetries`
                        // times with `delayMs` between attempts. This is essential for
                        // stores on shared hosting where the MySQL server briefly drops
                        // connections under load — the error self-heals within seconds,
                        // but without retry the entire sync batch fails and the user has
                        // to restart manually.
                        //
                        // JSON responses (success or error) are NEVER retried — only
                        // transport-level failures (HTML, empty, network) qualify.
                        function vgAjaxWithRetry(formData, options) {
                                options = options || {};
                                var maxRetries = options.maxRetries || 5;
                                var delayMs    = options.delayMs || 1500;
                                var attempt    = 0;

                                function attemptOnce() {
                                        return vgAjax(formData).then(
                                                function(data) {
                                                        // Success — return the parsed data immediately.
                                                        return data;
                                                },
                                                function(err) {
                                                        // Only retry transient errors (HTML/empty/network).
                                                        // JSON parse failures and real server errors are
                                                        // not retried.
                                                        if (err && err.transient && attempt < maxRetries) {
                                                                attempt++;
                                                                // Update the progress info so the user sees we're
                                                                // retrying, not frozen.
                                                                var pInfo = document.getElementById('vg-pinfo');
                                                                if (pInfo) {
                                                                        var retryNote = '<?php echo esc_js( __( "خطای موقت سرور — تلاش مجدد", "vigent-woo" ) ); ?> ' + attempt + '/' + maxRetries + '…';
                                                                        pInfo.innerHTML = '<span>' + retryNote + '</span><span style="color:#f59e0b;">⚠</span>';
                                                                }
                                                                // Wait delayMs, then retry the SAME request.
                                                                return new Promise(function(resolve) {
                                                                        setTimeout(resolve, delayMs);
                                                                }).then(attemptOnce);
                                                        }
                                                        // Non-transient error, or retries exhausted → throw.
                                                        throw err;
                                                }
                                        );
                                }

                                return attemptOnce();
                        }

                        // ─── Step 1: Connect to Vigent ──────────────────────────────
                        function vgConnect(btn) {
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VG.i18n.connecting;

                                var body = new FormData();
                                body.append('action', 'vigent_woo_connect');
                                body.append('nonce', window.VG.nonce);

                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (data.success) {
                                                        // Reload → page will now show the "push products" wizard.
                                                        location.reload();
                                                } else {
                                                        alert(data.data && data.data.message ? data.data.message : '<?php echo esc_js( __( 'خطا در اتصال.', 'vigent-woo' ) ); ?>');
                                                        btn.disabled = false;
                                                        btn.innerHTML = orig;
                                                }
                                        })
                                        .catch(function() { alert('<?php echo esc_js( __( 'خطا در ارتباط.', 'vigent-woo' ) ); ?>'); btn.disabled = false; btn.innerHTML = orig; });
                        }

                        // ─── Step 2: Initial push wizard ────────────────────────────
                        // Each page contains up to 50 events and becomes one HTTP request.
                        var vgRunning = false;
                        function vgStartPush(btn) {
                                if (vgRunning) return;
                                vgRunning = true;
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VG.i18n.sendingProducts;

                                var includeOrders = document.getElementById('vg-include-orders');
                                includeOrders = includeOrders ? includeOrders.checked : false;
                                var includeCustomers = document.getElementById('vg-include-customers');
                                includeCustomers = includeCustomers ? includeCustomers.checked : false;

                                // Show progress section.
                                var progress = document.getElementById('vg-push-progress');
                                if (progress) progress.style.display = 'block';

                                // Compute the visible step count so the finalize dot shows
                                // the right number. Products is always step 1. If orders is
                                // included it becomes step 2 (and customers step 3, finalize 4).
                                // If orders is skipped but customers is included, customers
                                // becomes step 2 and finalize step 3.
                                var visibleSteps = 1; // products
                                if (includeOrders) visibleSteps++;
                                if (includeCustomers) visibleSteps++;
                                var finalizeStepNum = visibleSteps + 1;

                                // Reset step indicators.
                                vgSetStep('products', 'active');

                                // Toggle orders step visibility.
                                var stepOrders = document.getElementById('vg-step-orders');
                                var stepOrdersLine = document.getElementById('vg-step-orders-line');
                                if (stepOrders) stepOrders.style.display = includeOrders ? 'inline-flex' : 'none';
                                if (stepOrdersLine) stepOrdersLine.style.display = includeOrders ? 'block' : 'none';

                                // Toggle customers step visibility.
                                var stepCustomers = document.getElementById('vg-step-customers');
                                var stepCustomersLine = document.getElementById('vg-step-customers-line');
                                if (stepCustomers) stepCustomers.style.display = includeCustomers ? 'inline-flex' : 'none';
                                if (stepCustomersLine) stepCustomersLine.style.display = includeCustomers ? 'block' : 'none';

                                // Renumber the visible step dots.
                                // Products is always "1". Orders (if visible) is "2".
                                // Customers (if visible) is the next number after orders.
                                // Finalize is the last number.
                                var ordersDot = stepOrders ? stepOrders.querySelector('.dot') : null;
                                var customersDot = stepCustomers ? stepCustomers.querySelector('.dot') : null;
                                var finalizeDot = document.getElementById('vg-step-finalize-dot');
                                var nextNum = 2;
                                if (includeOrders) {
                                        if (ordersDot) ordersDot.textContent = String(nextNum);
                                        nextNum++;
                                }
                                if (includeCustomers) {
                                        if (customersDot) customersDot.textContent = String(nextNum);
                                        nextNum++;
                                }
                                if (finalizeDot) finalizeDot.textContent = String(nextNum);

                                // Chain: products → orders → customers → finalize.
                                // Each step's callback invokes the next step only if the
                                // corresponding "include" checkbox is checked.
                                vgPushKind('products', 0, 0, 0, function(totalProducts, productErrors, complete, errorMsg) {
                                        if (!complete) { vgAbortPush(btn, orig, errorMsg); return; }
                                        vgSetStep('products', 'done');
                                        vgSetStepLabel('products', window.VG.i18n.productSent + ' (' + totalProducts + ')');
                                        if (includeOrders) {
                                                vgSetStep('orders', 'active');
                                                vgPushKind('orders', 0, 0, 0, function(totalOrders, orderErrors, ordersComplete, ordersErrorMsg) {
                                                        if (!ordersComplete) { vgAbortPush(btn, orig, ordersErrorMsg); return; }
                                                        vgSetStep('orders', 'done');
                                                        vgSetStepLabel('orders', window.VG.i18n.ordersSent + ' (' + totalOrders + ')');
                                                        if (includeCustomers) {
                                                                vgSetStep('customers', 'active');
                                                                vgPushKind('customers', 0, 0, 0, function(totalCustomers, customerErrors, customersComplete, customersErrorMsg) {
                                                                        if (!customersComplete) { vgAbortPush(btn, orig, customersErrorMsg); return; }
                                                                        vgSetStep('customers', 'done');
                                                                        vgSetStepLabel('customers', '<?php echo esc_js( __( "مشتری‌ها ارسال شد", "vigent-woo" ) ); ?>' + ' (' + totalCustomers + ')');
                                                                        vgFinalize(btn, orig, totalProducts, productErrors, totalOrders, orderErrors);
                                                                }, btn, orig);
                                                        } else {
                                                                vgFinalize(btn, orig, totalProducts, productErrors, totalOrders, orderErrors);
                                                        }
                                                }, btn, orig);
                                        } else if (includeCustomers) {
                                                // Orders skipped — go straight to customers.
                                                vgSetStep('customers', 'active');
                                                vgPushKind('customers', 0, 0, 0, function(totalCustomers, customerErrors, customersComplete, customersErrorMsg) {
                                                        if (!customersComplete) { vgAbortPush(btn, orig, customersErrorMsg); return; }
                                                        vgSetStep('customers', 'done');
                                                        vgSetStepLabel('customers', '<?php echo esc_js( __( "مشتری‌ها ارسال شد", "vigent-woo" ) ); ?>' + ' (' + totalCustomers + ')');
                                                        vgFinalize(btn, orig, totalProducts, productErrors, 0, []);
                                                }, btn, orig);
                                        } else {
                                                vgFinalize(btn, orig, totalProducts, productErrors, 0, []);
                                        }
                                }, btn, orig);
                        }

                        // Push one kind (products|orders|customers) in batches of 50.
                        function vgPushKind(kind, offset, totalSent, totalErrors, cb, btn, orig) {
                                var pBar = document.getElementById('vg-pbar');
                                var pText = document.getElementById('vg-ptext');
                                var pInfo = document.getElementById('vg-pinfo');

                                var body = new FormData();
                                body.append('action', 'vigent_woo_sync_batch');
                                body.append('nonce', window.VG.nonce);
                                body.append('kind', kind);
                                body.append('offset', offset);

                                vgAjaxWithRetry(body)
                                        .then(function(data) {
                                                if (!data.success) {
                                                        cb(totalSent, totalErrors + 1, false, (data.data && data.data.message) ? data.data.message : '<?php echo esc_js( __( "ارسال ناموفق بود.", "vigent-woo" ) ); ?>');
                                                        return;
                                                }
                                                var d = data.data;
                                                totalSent += d.sent;
                                                if (d.errors && d.errors.length) totalErrors += d.errors.length;
                                                var pct = d.total > 0 ? Math.min(100, Math.round(((offset + 50) / d.total) * 100)) : 100;
                                                if (pBar) pBar.style.width = pct + '%';
                                                if (pText) pText.textContent = pct + '%';
                                                // When syncing ORDERS, show a hint that we only sync the
                                                // most recent 1000 records (MAX_ORDERS_TO_SYNC). Customers
                                                // are no longer capped — every paying customer is synced.
                                                var capNote = '';
                                                if (kind === 'orders' && d.total >= 1000) {
                                                        capNote = ' · فقط آخرین ۱۰۰۰ سفارش';
                                                }
                                                if (pInfo) pInfo.innerHTML = '<span>' + totalSent + ' / ' + d.total + capNote + '</span><span>خطا: ' + totalErrors + '</span>';
                                                if (d.errors && d.errors.length) {
                                                        cb(totalSent, totalErrors, false, d.errors[0]);
                                                } else if (d.done) {
                                                        cb(totalSent, totalErrors, true, '');
                                                } else {
                                                        setTimeout(function() {
                                                                vgPushKind(kind, offset + 50, totalSent, totalErrors, cb, btn, orig);
                                                        }, 120);
                                                }
                                        })
                                        .catch(function(err) { cb(totalSent, totalErrors + 1, false, err && err.message ? err.message : '<?php echo esc_js( __( "خطای شبکه.", "vigent-woo" ) ); ?>'); });
                        }

                        function vgAbortPush(btn, orig, message) {
                                vgRunning = false;
                                btn.disabled = false;
                                btn.innerHTML = orig;
                                var generic = '<?php echo esc_js( __( "ارسال کامل نشد. اتصال را بررسی کنید و دوباره ادامه دهید؛ موارد موفق دوباره‌کاری نمی‌شوند.", "vigent-woo" ) ); ?>';
                                if (message) {
                                        alert('<?php echo esc_js( __( "ارسال متوقف شد:", "vigent-woo" ) ); ?>\n\n' + message + '\n\n' + generic + '\n\n<?php echo esc_js( __( "برای جزئیات بیشتر، لاگ دیباگ را در پنل افزونه ببینید.", "vigent-woo" ) ); ?>');
                                } else {
                                        alert(generic);
                                }
                        }

                        function vgSetStep(name, state) {
                                var el = document.getElementById('vg-step-' + name);
                                if (!el) return;
                                el.classList.remove('active', 'done');
                                el.classList.add(state);
                        }
                        function vgSetStepLabel(name, text) {
                                var el = document.getElementById('vg-step-' + name + '-label');
                                if (el) el.textContent = text;
                        }

                        // Final step — mark the initial push as done so on next page-load
                        // we show the success card instead of the wizard.
                        function vgFinalize(btn, orig, totalProducts, productErrors, totalOrders, orderErrors) {
                                var pBar = document.getElementById('vg-pbar');
                                var pText = document.getElementById('vg-ptext');
                                var pInfo = document.getElementById('vg-pinfo');
                                if (pBar) pBar.style.width = '100%';
                                if (pText) pText.textContent = '100%';
                                if (pInfo) pInfo.innerHTML = '<span>' + window.VG.i18n.done + '</span><span>محصول: ' + totalProducts + ' · سفارش: ' + totalOrders + '</span>';

                                // Tell the server the initial push is complete.
                                var body = new FormData();
                                body.append('action', 'vigent_woo_mark_pushed');
                                body.append('nonce', window.VG.nonce);
                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (!data.success) { vgAbortPush(btn, orig); return; }
                                                setTimeout(function() { location.reload(); }, 400);
                                        })
                                        .catch(function() { vgAbortPush(btn, orig); });
                        }

                        // ─── Manual re-sync (management section, after initial push) ───
                        function vgSync(kind, btn) {
                                if (vgRunning) return;
                                vgRunning = true;
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VG.i18n.syncing;

                                var pBar = document.getElementById('vg-pbar');
                                var pText = document.getElementById('vg-ptext');
                                var pInfo = document.getElementById('vg-pinfo');
                                var filter = {};
                                var catSel = document.getElementById('filter-category');
                                if (catSel && catSel.value) filter.category = catSel.value;

                                if (pBar) { pBar.style.width = '0%'; pText.textContent = '0%'; }
                                var progressEl = document.getElementById('vg-progress');
                                if (progressEl) progressEl.style.display = 'block';

                                var offset = 0;
                                var totalSent = 0;
                                var allErrors = [];

                                function batch() {
                                        var body = new FormData();
                                        body.append('action', 'vigent_woo_sync_batch');
                                        body.append('nonce', window.VG.nonce);
                                        body.append('kind', kind);
                                        body.append('offset', offset);
                                        body.append('filter', JSON.stringify(filter));

                                        vgAjaxWithRetry(body)
                                                .then(function(data) {
                                                        if (!data.success) {
                                                                finish(false, data.data && data.data.message ? data.data.message : '<?php echo esc_js( __( 'ارسال ناموفق بود.', 'vigent-woo' ) ); ?>');
                                                                return;
                                                        }
                                                        var d = data.data;
                                                        totalSent += d.sent;
                                                        if (d.errors && d.errors.length) allErrors = allErrors.concat(d.errors);
                                                        var pct = d.total > 0 ? Math.min(100, Math.round(((offset + 50) / d.total) * 100)) : 100;
                                                        if (pBar) pBar.style.width = pct + '%';
                                                        if (pText) pText.textContent = pct + '%';
                                                        if (pInfo) pInfo.innerHTML = '<span>' + totalSent + ' / ' + d.total + '</span><span>خطا: ' + allErrors.length + '</span>';
                                                        if (d.errors && d.errors.length) {
                                                                finish(false, d.errors[0]);
                                                        } else if (d.done) {
                                                                finish(true);
                                                        } else {
                                                                offset += 50;
                                                                setTimeout(batch, 120);
                                                        }
                                                })
                                                .catch(function(error) { finish(false, error.message); });
                                }

                                function finish(success, message) {
                                        vgRunning = false;
                                        btn.disabled = false;
                                        btn.innerHTML = orig;
                                        if (success) {
                                                if (pBar) pBar.style.width = '100%';
                                                if (pText) pText.textContent = '100%';
                                                if (pInfo) pInfo.innerHTML = '<span>' + window.VG.i18n.done + ' — ' + totalSent + ' مورد</span><span>خطا: 0</span>';
                                                var note = document.getElementById('vg-sync-note');
                                                if (note) note.textContent = '<?php echo esc_js( __( 'ارسال کامل محصولات با موفقیت انجام شد.', 'vigent-woo' ) ); ?>';
                                        } else {
                                                if (pText) pText.textContent = '<?php echo esc_js( __( 'خطا', 'vigent-woo' ) ); ?>';
                                                alert(message || '<?php echo esc_js( __( 'ارسال کامل نشد؛ دوباره تلاش کنید.', 'vigent-woo' ) ); ?>');
                                        }
                                }

                                batch();
                        }

                        // Send only coalesced changes since the previous flush.
                        function vgFlushDelta(btn) {
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VG.i18n.syncing;
                                var body = new FormData();
                                body.append('action', 'vigent_woo_flush_delta');
                                body.append('nonce', window.VG.nonce);
                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                var d = data.data || {};
                                                if (!data.success) throw new Error(d.message || '<?php echo esc_js( __( 'ارسال تغییرات ناموفق بود.', 'vigent-woo' ) ); ?>');
                                                var count = document.getElementById('vg-queue-count');
                                                if (count) count.textContent = d.remaining || 0;
                                                var note = document.getElementById('vg-sync-note');
                                                if (note) note.textContent = d.message || '<?php echo esc_js( __( 'تغییرات ارسال شد.', 'vigent-woo' ) ); ?>';
                                                btn.innerHTML = '<?php echo esc_js( __( '✓ انجام شد', 'vigent-woo' ) ); ?>';
                                                setTimeout(function() { btn.innerHTML = orig; btn.disabled = false; }, 1200);
                                        })
                                        .catch(function(error) {
                                                alert(error.message || '<?php echo esc_js( __( 'خطا در ارتباط.', 'vigent-woo' ) ); ?>');
                                                btn.innerHTML = orig;
                                                btn.disabled = false;
                                        });
                        }

                        // ─── Save toggles ───────────────────────────────────────────
                        function vgSaveToggles(btn) {
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> <?php echo esc_js( __( "ذخیره…", "vigent-woo" ) ); ?>';

                                var syncProducts = document.getElementById('sync_products') ? document.getElementById('sync_products').checked : false;
                                var syncOrders = document.getElementById('sync_orders') ? document.getElementById('sync_orders').checked : false;
                                var syncCustomers = document.getElementById('sync_customers') ? document.getElementById('sync_customers').checked : false;

                                var body = new FormData();
                                body.append('action', 'vigent_woo_save_toggles');
                                body.append('nonce', window.VG.nonce);
                                body.append('sync_products', syncProducts ? '1' : '0');
                                body.append('sync_orders', syncOrders ? '1' : '0');
                                body.append('sync_customers', syncCustomers ? '1' : '0');

                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (!data.success) throw new Error(data.data && data.data.message ? data.data.message : '<?php echo esc_js( __( 'ذخیره ناموفق بود.', 'vigent-woo' ) ); ?>');
                                                btn.innerHTML = '<?php echo esc_js( __( "✓ ذخیره شد", "vigent-woo" ) ); ?>';
                                                setTimeout(function() { btn.innerHTML = orig; btn.disabled = false; }, 1500);
                                        })
                                        .catch(function(error) {
                                                alert(error.message || '<?php echo esc_js( __( 'ذخیره ناموفق بود.', 'vigent-woo' ) ); ?>');
                                                btn.innerHTML = orig;
                                                btn.disabled = false;
                                        });
                        }

                        // ─── Debug log viewer ───────────────────────────────────────
                        // Fetches the last N lines of wp-content/uploads/vigent-woo-logs/debug.log
                        // and shows them in a modal so the admin can see exactly what the
                        // plugin sent to Vigent and what came back. Used for diagnosing
                        // "ارسال کامل نشد" errors without needing FTP.
                        function vgViewLog(btn) {
                                var orig = btn.innerHTML;
                                btn.disabled = true;
                                btn.innerHTML = '<span class="vg-spinner"></span> <?php echo esc_js( __( "در حال بارگذاری…", "vigent-woo" ) ); ?>';
                                var body = new FormData();
                                body.append('action', 'vigent_woo_view_log');
                                body.append('nonce', window.VG.nonce);
                                body.append('lines', '300');
                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                btn.innerHTML = orig;
                                                btn.disabled = false;
                                                if (!data.success) {
                                                        alert((data.data && data.data.message) ? data.data.message : '<?php echo esc_js( __( "بارگذاری لاگ ناموفق بود.", "vigent-woo" ) ); ?>');
                                                        return;
                                                }
                                                var d = data.data || {};
                                                var log = d.log || '';
                                                var file = d.file || '';
                                                var modal = document.getElementById('vg-log-modal');
                                                var pre = document.getElementById('vg-log-content');
                                                var fileEl = document.getElementById('vg-log-file');
                                                if (!modal || !pre) {
                                                        alert(log || '<?php echo esc_js( __( "لاگ خالی است.", "vigent-woo" ) ); ?>');
                                                        return;
                                                }
                                                pre.textContent = log ? log : '<?php echo esc_js( __( "لاگ خالی است. یک ارسال را امتحان کنید و دوباره لاگ را ببینید.", "vigent-woo" ) ); ?>';
                                                if (fileEl) fileEl.textContent = file;
                                                modal.style.display = 'flex';
                                        })
                                        .catch(function(err) {
                                                btn.innerHTML = orig;
                                                btn.disabled = false;
                                                alert(err && err.message ? err.message : '<?php echo esc_js( __( "خطای شبکه.", "vigent-woo" ) ); ?>');
                                        });
                        }

                        function vgCloseLogModal() {
                                var modal = document.getElementById('vg-log-modal');
                                if (modal) modal.style.display = 'none';
                        }

                        function vgClearLog(btn) {
                                if (!confirm('<?php echo esc_js( __( "لاگ دیباگ پاک شود؟", "vigent-woo" ) ); ?>')) return;
                                var orig = btn.innerHTML;
                                btn.disabled = true;
                                btn.innerHTML = '<span class="vg-spinner"></span> <?php echo esc_js( __( "در حال پاک‌سازی…", "vigent-woo" ) ); ?>';
                                var body = new FormData();
                                body.append('action', 'vigent_woo_clear_log');
                                body.append('nonce', window.VG.nonce);
                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                btn.innerHTML = orig;
                                                btn.disabled = false;
                                                if (!data.success) {
                                                        alert((data.data && data.data.message) ? data.data.message : '<?php echo esc_js( __( "پاک‌سازی ناموفق بود.", "vigent-woo" ) ); ?>');
                                                        return;
                                                }
                                                var pre = document.getElementById('vg-log-content');
                                                if (pre) pre.textContent = '<?php echo esc_js( __( "لاگ پاک شد.", "vigent-woo" ) ); ?>';
                                        })
                                        .catch(function(err) {
                                                btn.innerHTML = orig;
                                                btn.disabled = false;
                                                alert(err && err.message ? err.message : '<?php echo esc_js( __( "خطای شبکه.", "vigent-woo" ) ); ?>');
                                        });
                        }

                        // ─── Disconnect from Vigent ────────────────────────────────
                        // Sends a final notification to the Vigent panel so it can
                        // mark the integration as disconnected, then clears the
                        // local credentials and reloads to the connect step.
                        function vgDisconnect(btn) {
                                if (!confirm('<?php echo esc_js( __( "از قطع اتصال مطمئن هستید؟ محصولات و سفارش‌های همگام‌شده در پنل ویجنت باقی می‌مانند اما به‌روزرسانی خودکار متوقف می‌شود.", "vigent-woo" ) ); ?>')) return;
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> <?php echo esc_js( __( "در حال قطع…", "vigent-woo" ) ); ?>';

                                var body = new FormData();
                                body.append('action', 'vigent_woo_disconnect');
                                body.append('nonce', window.VG.nonce);

                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (data.success) {
                                                        // Reload → page will show the connect step since
                                                        // credentials are now cleared.
                                                        location.reload();
                                                } else {
                                                        alert(data.data && data.data.message ? data.data.message : '<?php echo esc_js( __( "خطا در قطع اتصال.", "vigent-woo" ) ); ?>');
                                                        btn.disabled = false;
                                                        btn.innerHTML = orig;
                                                }
                                        })
                                        .catch(function() { alert('<?php echo esc_js( __( "خطا در ارتباط.", "vigent-woo" ) ); ?>'); btn.disabled = false; btn.innerHTML = orig; });
                        }

                        // ─── Check for plugin updates (manual button) ───────────
                        // Calls the `vigent_woo_check_update` AJAX endpoint which
                        // hits https://vigent.ir/api/wordpress-plugin/info and
                        // compares the remote version with VIGENT_WOO_VERSION.
                        //
                        // Three outcomes handled:
                        //   1. Already on the latest version → toast "شما از آخرین نسخه استفاده می‌کنید".
                        //   2. New version available → banner appears at the TOP of the
                        //      page with "نصب بروزرسانی" button. JS auto-scrolls to it
                        //      so the user immediately sees it. The button calls
                        //      vgInstallUpdate() which runs our custom AJAX installer
                        //      (no page navigation). If the AJAX installer fails (e.g.
                        //      filesystem credentials needed), the user is offered
                        //      the fallback URL to update.php.
                        //   3. Network error → toast with error message.
                        var vgUpdateChecked = false;
                        function vgCheckUpdate(btn) {
                                if (btn) { btn.disabled = true; var orig = btn.innerHTML; btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VG.i18n.checkingUpdate; }

                                var body = new FormData();
                                body.append('action', 'vigent_woo_check_update');
                                body.append('nonce', window.VG.nonce);

                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (btn) { btn.disabled = false; btn.innerHTML = orig; }
                                                vgUpdateChecked = true;

                                                if (!data.success) {
                                                        alert(data.data && data.data.message ? data.data.message : 'خطا در بررسی بروزرسانی.');
                                                        return;
                                                }
                                                var d = data.data;
                                                if (d.update_available) {
                                                        // Show the update banner at the top of the page.
                                                        var banner = document.getElementById('vg-update-banner');
                                                        if (banner) {
                                                                banner.style.display = 'flex';
                                                                var verEl = banner.querySelector('.latest-version');
                                                                if (verEl) verEl.textContent = d.latest_version;
                                                                var curEl = banner.querySelector('.current-version');
                                                                if (curEl) curEl.textContent = d.current_version;
                                                                // Save the fallback URL (WP-native update.php) for use
                                                                // if our AJAX installer fails. We don't set it on the
                                                                // button itself because the button now triggers AJAX.
                                                                if (d.fallback_install_url) {
                                                                        window.VG.fallbackInstallUrl = d.fallback_install_url;
                                                                }
                                                        }
                                                        // Mark the header button as "has update" so it glows.
                                                        var headerBtn = document.getElementById('vg-btn-update');
                                                        if (headerBtn) headerBtn.classList.add('has-update');
                                                        // Auto-scroll the banner into view so the user sees it
                                                        // even if they were scrolled down when they clicked.
                                                        setTimeout(function() {
                                                                if (banner && banner.scrollIntoView) {
                                                                        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                }
                                                        }, 100);
                                                } else {
                                                        alert(d.message || 'شما از آخرین نسخه استفاده می‌کنید.');
                                                }
                                        })
                                        .catch(function() {
                                                if (btn) { btn.disabled = false; btn.innerHTML = orig; }
                                                alert('خطا در ارتباط با سرور ویجنت.');
                                        });
                        }

                        // ─── Install the update via AJAX ─────────────────────────
                        // Calls `vigent_woo_install_update` which uses WP Core's
                        // Plugin_Upgrader to download + install the new ZIP in place.
                        // This avoids the blank-page issue with update-core.php and
                        // gives the user a smooth in-page experience:
                        //   click → spinner → success alert → page reload.
                        //
                        // If the AJAX installer fails (most commonly because the site
                        // needs FTP credentials and the user hasn't entered them), we
                        // offer the fallback URL to update.php?action=upgrade-plugin
                        // which shows WP's standard confirmation screen.
                        var vgInstalling = false;
                        function vgInstallUpdate(btn) {
                                if (vgInstalling) return;
                                if (!confirm('<?php echo esc_js( __( "آیا از نصب بروزرسانی مطمئن هستید؟ افزونه به‌طور موقت غیرفعال خواهد شد.", "vigent-woo" ) ); ?>')) return;

                                vgInstalling = true;
                                var orig = btn ? btn.innerHTML : '';
                                if (btn) {
                                        btn.disabled = true;
                                        btn.innerHTML = '<span class="vg-spinner"></span> <?php echo esc_js( __( "در حال نصب…", "vigent-woo" ) ); ?>';
                                }

                                var body = new FormData();
                                body.append('action', 'vigent_woo_install_update');
                                body.append('nonce', window.VG.nonce);

                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (data.success) {
                                                        if (btn) {
                                                                btn.innerHTML = '<span class="vg-spinner"></span> <?php echo esc_js( __( "تکمیل…", "vigent-woo" ) ); ?>';
                                                        }
                                                        alert(data.data && data.data.message ? data.data.message : '<?php echo esc_js( __( "بروزرسانی با موفقیت نصب شد.", "vigent-woo" ) ); ?>');
                                                        // Reload to show the new version.
                                                        setTimeout(function() { location.reload(); }, 800);
                                                        return;
                                                }
                                                // Failed — re-enable the button and offer the fallback.
                                                vgInstalling = false;
                                                if (btn) { btn.disabled = false; btn.innerHTML = orig; }
                                                var msg = data.data && data.data.message ? data.data.message : '<?php echo esc_js( __( "خطا در نصب بروزرسانی.", "vigent-woo" ) ); ?>';
                                                if (window.VG.fallbackInstallUrl) {
                                                        if (confirm(msg + '\n\n<?php echo esc_js( __( "آیا می‌خواهید از روش جایگزین (صفحه بروزرسانی وردپرس) استفاده کنید؟", "vigent-woo" ) ); ?>')) {
                                                                window.location.href = window.VG.fallbackInstallUrl;
                                                        }
                                                } else {
                                                        alert(msg);
                                                }
                                        })
                                        .catch(function() {
                                                vgInstalling = false;
                                                if (btn) { btn.disabled = false; btn.innerHTML = orig; }
                                                alert('<?php echo esc_js( __( "خطا در ارتباط با سرور.", "vigent-woo" ) ); ?>');
                                        });
                        }

                        // ─── Sync the wizard-step indicators with the "include orders"
                        // checkbox state. When the user toggles the checkbox, we hide/show
                        // the orders step + its connector line, and renumber the finalize
                        // dot. This keeps the visual indicator in sync with what will
                        // actually happen on submit.
                        //
                        // Customers step follows the same pattern: when its checkbox is
                        // toggled, its pill + line are shown/hidden, and the finalize
                        // dot is renumbered to reflect the visible step count.
                        function vgSyncWizardSteps() {
                                var cbOrders = document.getElementById('vg-include-orders');
                                var cbCustomers = document.getElementById('vg-include-customers');
                                var includeOrders = cbOrders ? cbOrders.checked : false;
                                var includeCustomers = cbCustomers ? cbCustomers.checked : false;

                                // Toggle orders step visibility.
                                var stepOrders = document.getElementById('vg-step-orders');
                                var stepOrdersLine = document.getElementById('vg-step-orders-line');
                                if (stepOrders) stepOrders.style.display = includeOrders ? 'inline-flex' : 'none';
                                if (stepOrdersLine) stepOrdersLine.style.display = includeOrders ? 'block' : 'none';

                                // Toggle customers step visibility.
                                var stepCustomers = document.getElementById('vg-step-customers');
                                var stepCustomersLine = document.getElementById('vg-step-customers-line');
                                if (stepCustomers) stepCustomers.style.display = includeCustomers ? 'inline-flex' : 'none';
                                if (stepCustomersLine) stepCustomersLine.style.display = includeCustomers ? 'block' : 'none';

                                // Renumber dots: products=1, then orders (if visible),
                                // then customers (if visible), then finalize.
                                var ordersDot = stepOrders ? stepOrders.querySelector('.dot') : null;
                                var customersDot = stepCustomers ? stepCustomers.querySelector('.dot') : null;
                                var finalizeDot = document.getElementById('vg-step-finalize-dot');
                                var nextNum = 2;
                                if (includeOrders) {
                                        if (ordersDot) ordersDot.textContent = String(nextNum);
                                        nextNum++;
                                }
                                if (includeCustomers) {
                                        if (customersDot) customersDot.textContent = String(nextNum);
                                        nextNum++;
                                }
                                if (finalizeDot) finalizeDot.textContent = String(nextNum);
                        }
                        document.addEventListener('DOMContentLoaded', function() {
                                var cbOrders = document.getElementById('vg-include-orders');
                                var cbCustomers = document.getElementById('vg-include-customers');
                                if (cbOrders) {
                                        cbOrders.addEventListener('change', vgSyncWizardSteps);
                                }
                                if (cbCustomers) {
                                        cbCustomers.addEventListener('change', vgSyncWizardSteps);
                                }
                                // Run once on load to make sure the initial state matches.
                                vgSyncWizardSteps();
                        });

                        // ─── Refresh header status (pill + last-check) ────────────
                        // Replaces the old live-banner. Only updates the small pill
                        // and the "last check" line inside the header — no separate
                        // banner below the header anymore.
                        function vgRefreshHeaderStatus() {
                                fetch(window.VG.ajaxUrl + '?action=vigent_woo_status&nonce=' + window.VG.nonce)
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (!data.success) return;
                                                var s = data.data;
                                                var pill = document.getElementById('vg-status-pill');
                                                var lc = document.getElementById('vg-last-check');
                                                if (!pill) return;
                                                var cls, txt;
                                                if (s.connected === true) {
                                                        cls = 'ok'; txt = '<?php echo esc_js( __( "متصل", "vigent-woo" ) ); ?>';
                                                } else if (s.connected === false) {
                                                        cls = 'err'; txt = '<?php echo esc_js( __( "قطع", "vigent-woo" ) ); ?>';
                                                } else {
                                                        cls = 'warn'; txt = '<?php echo esc_js( __( "در انتظار", "vigent-woo" ) ); ?>';
                                                }
                                                pill.className = 'pill ' + cls;
                                                pill.textContent = txt;
                                                if (lc) {
                                                        lc.textContent = s.last_check ? ('آخرین بررسی: ' + s.last_check) : '';
                                                }
                                                var queueCount = document.getElementById('vg-queue-count');
                                                if (queueCount && typeof s.queue_count !== 'undefined') queueCount.textContent = s.queue_count;
                                                var syncNote = document.getElementById('vg-sync-note');
                                                if (syncNote && s.last_success) syncNote.textContent = '<?php echo esc_js( __( 'آخرین ارسال موفق: ', 'vigent-woo' ) ); ?>' + s.last_success;
                                        })
                                        .catch(function() {});
                        }
                        setInterval(function() {
                                if (!document.hidden) vgRefreshHeaderStatus();
                        }, 60000);
                        document.addEventListener('DOMContentLoaded', vgRefreshHeaderStatus);
                </script>
                <?php
        }

        // ─── Page ────────────────────────────────────────────────────────────

        public function render_page() {
                if ( ! current_user_can( 'manage_options' ) ) {
                        wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
                }
                $core       = $this->core();
                $settings   = $core->get_settings();
                $status     = $core->get_connection_status();
                $has_wc     = $core->has_wc();
                $configured = $core->is_configured();
                $pushed     = (int) get_option( 'vigent_woo_initial_push_done', 0 ) === 1;

                // URL-driven stage override. Lets the user (and future deep-links
                // from the Vigent panel) jump to a specific step without changing
                // persisted state. The override is read-only — the persisted
                // `vigent_woo_initial_push_done` option is the source of truth.
                //   ?stage=connect  → force the connect card
                //   ?stage=push     → force the push wizard (after connect)
                //   ?stage=manage   → force the management view (after push)
                $stage_override = isset( $_GET['stage'] ) ? sanitize_key( wp_unslash( $_GET['stage'] ) ) : '';

                $show_connect = ! $configured || 'connect' === $stage_override;
                $show_push    = $configured && ! $pushed && ! $show_connect
                        || ( 'push' === $stage_override && $configured );
                // If the override says "push" but we're not configured yet, fall
                // back to the connect step — push without connect is meaningless.
                if ( 'push' === $stage_override && ! $configured ) {
                        $show_connect = true;
                        $show_push    = false;
                }
                // If the override says "manage" but we haven't pushed yet, still
                // show the push wizard — otherwise the user would see an empty
                // management view.
                if ( 'manage' === $stage_override && ! $pushed ) {
                        $show_push    = $configured && true;
                        $show_connect = false;
                } elseif ( $configured && $pushed && '' === $stage_override ) {
                        $show_push = false;
                }

                // Default render order: connect → push → manage.
                if ( $show_connect ) {
                        $view = 'connect';
                } elseif ( $show_push ) {
                        $view = 'push';
                } else {
                        $view = 'manage';
                }
                ?>
                <div class="wrap vg-wrap">
                        <div class="vg-header">
                                <div class="vg-logo">
                                        <svg viewBox="0 0 20 20"><path d="M5 6l5 8 5-8" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </div>
                                <div style="flex:1;">
                                        <h1><?php esc_html_e( 'ویجنت', 'vigent-woo' ); ?></h1>
                                        <p class="sub"><?php esc_html_e( 'اتصال سایت به ایجنت هوشمند ویجنت', 'vigent-woo' ); ?></p>
                                        <?php if ( $configured && ! empty( $status['last_check'] ) ) : ?>
                                                <p class="last-check" id="vg-last-check"><?php printf( esc_html__( 'آخرین بررسی: %s', 'vigent-woo' ), esc_html( $status['last_check'] ) ); ?></p>
                                        <?php else : ?>
                                                <p class="last-check" id="vg-last-check"></p>
                                        <?php endif; ?>
                                </div>
                                <?php
                                // Status pill — always present (JS updates it every 30s).
                                if ( ! $configured ) {
                                        echo '<span id="vg-status-pill" class="pill warn">' . esc_html__( 'پیکربندی نشده', 'vigent-woo' ) . '</span>';
                                } elseif ( true === $status['connected'] ) {
                                        echo '<span id="vg-status-pill" class="pill ok">' . esc_html__( 'متصل', 'vigent-woo' ) . '</span>';
                                } elseif ( false === $status['connected'] ) {
                                        echo '<span id="vg-status-pill" class="pill err">' . esc_html__( 'قطع', 'vigent-woo' ) . '</span>';
                                } else {
                                        echo '<span id="vg-status-pill" class="pill warn">' . esc_html__( 'در انتظار', 'vigent-woo' ) . '</span>';
                                }

                                // Disconnect button — only when configured.
                                if ( $configured ) :
                                        ?>
                                        <button class="vg-btn-update" id="vg-btn-update" onclick="vgCheckUpdate(this)" title="<?php esc_attr_e( 'بررسی بروزرسانی افزونه', 'vigent-woo' ); ?>">
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                                <?php
                                                /* translators: %s: current plugin version */
                                                printf( esc_html__( 'بروزرسانی (%s)', 'vigent-woo' ), esc_html( VIGENT_WOO_VERSION ) );
                                                ?>
                                        </button>
                                        <button class="vg-btn-disconnect" onclick="vgDisconnect(this)">
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                                <?php esc_html_e( 'قطع اتصال', 'vigent-woo' ); ?>
                                        </button>
                                        <?php
                                endif;
                                ?>
                        </div>

                        <?php
                        // Update banner — rendered at the TOP of the page (right after
                        // the header) so the user sees it immediately when an update is
                        // available, without scrolling past all the stats and settings.
                        // It's hidden by default and toggled by vgCheckUpdate() JS.
                        $this->render_update_banner();

                        if ( 'connect' === $view ) {
                                $this->render_connect_step( $has_wc );
                        } elseif ( 'push' === $view ) {
                                $this->render_push_wizard( $has_wc );
                        } else {
                                $this->render_connected_view( $core, $settings, $status, $has_wc );
                        }

                        // Debug log card — always rendered so the admin can diagnose
                        // sync failures from ANY stage (connect / push / manage), not just
                        // after the initial push is complete. The modal is also rendered
                        // here so the JS functions (vgViewLog, vgClearLog, vgCloseLogModal)
                        // always find their DOM targets.
                        $this->render_debug_log_card();
                        ?>
                </div>
                <?php
        }

        // ─── Debug log card + modal (always visible) ───────────────────────
        //
        // Rendered on EVERY stage (connect / push / manage) so the admin can
        // diagnose "ارسال کامل نشد" errors without needing FTP access. The card
        // hosts two buttons: "مشاهده لاگ" (fetches the last 300 lines via AJAX)
        // and "پاک کردن لاگ" (truncates the file). The modal is a fixed-position
        // overlay shown on top of the WP admin.

        private function render_debug_log_card() {
                ?>
                <div class="vg-card">
                        <h2><?php esc_html_e( 'لاگ دیباگ', 'vigent-woo' ); ?></h2>
                        <p><?php esc_html_e( 'تمام درخواست‌ها و پاسخ‌های ارسالی به ویجنت در این فایل ثبت می‌شوند. اگر ارسالی ناموفق بود، این لاگ دقیقاً نشان می‌دهد چه چیزی خطا داده.', 'vigent-woo' ); ?></p>
                        <div class="vg-btns">
                                <button type="button" class="vg-btn vg-btn-black" onclick="vgViewLog(this)"><?php esc_html_e( 'مشاهده لاگ', 'vigent-woo' ); ?></button>
                                <button type="button" class="vg-btn vg-btn-white" onclick="vgClearLog(this)"><?php esc_html_e( 'پاک کردن لاگ', 'vigent-woo' ); ?></button>
                        </div>
                </div>

                <div id="vg-log-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;align-items:center;justify-content:center;padding:24px;">
                        <div style="background:#fff;border-radius:12px;max-width:960px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">
                                <div style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                                        <div>
                                                <strong><?php esc_html_e( 'لاگ دیباگ افزونه', 'vigent-woo' ); ?></strong>
                                                <div id="vg-log-file" style="font-size:11px;color:#6b7280;margin-top:2px;word-break:break-all;"></div>
                                        </div>
                                        <button type="button" class="vg-btn vg-btn-white" onclick="vgCloseLogModal()"><?php esc_html_e( 'بستن', 'vigent-woo' ); ?></button>
                                </div>
                                <pre id="vg-log-content" style="margin:0;padding:16px 20px;overflow:auto;font-family:Menlo,Consolas,monospace;font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word;background:#fafafa;"></pre>
                        </div>
                </div>
                <?php
        }

        /**
         * Update banner — shown when a new version is available.
         *
         * Hidden by default (display:none). vgCheckUpdate() flips it to
         * display:flex when the server reports a newer version.
         *
         * The install button is an <a> so the user gets a real navigation
         * to update-core.php (where WordPress shows its own confirmation
         * screen + progress UI). We don't try to install the plugin from
         * inside our own admin page — that's WP Core's job.
         */
        private function render_update_banner() {
                ?>
                <div class="vg-update-banner" id="vg-update-banner" style="display:none;">
                        <div class="icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div class="text">
                                <strong><?php esc_html_e( 'بروزرسانی جدید افزونه ویجنت موجود است', 'vigent-woo' ); ?></strong>
                                <?php esc_html_e( 'نسخه فعلی:', 'vigent-woo' ); ?> <span class="current-version"><?php echo esc_html( VIGENT_WOO_VERSION ); ?></span>
                                · <?php esc_html_e( 'نسخه جدید:', 'vigent-woo' ); ?> <span class="latest-version">—</span>
                        </div>
                        <button type="button" class="vg-btn-install" id="vg-btn-install" onclick="vgInstallUpdate(this)">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <?php esc_html_e( 'نصب بروزرسانی', 'vigent-woo' ); ?>
                        </button>
                </div>
                <?php
        }

        // ─── Step 1: Connect (big centered button) ──────────────────────────

        private function render_connect_step( $has_wc ) {
                ?>
                <div class="vg-card vg-center-card">
                        <div class="vg-center-icon">
                                <svg viewBox="0 0 24 24" width="48" height="48"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <h2 class="vg-center-title"><?php esc_html_e( 'اتصال به ویجنت', 'vigent-woo' ); ?></h2>
                        <p class="vg-center-sub"><?php esc_html_e( 'برای اتصال، ابتدا در پنل ویجنت یک اتصال سایت بسازید، سپس دکمه زیر را بزنید. همه چیز خودکار است.', 'vigent-woo' ); ?></p>

                        <div class="vg-center-btn-wrap">
                                <button class="vg-btn-center" onclick="vgConnect(this)">
                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        <?php esc_html_e( 'اتصال', 'vigent-woo' ); ?>
                                </button>
                        </div>

                        <ol class="vg-steps vg-center-steps">
                                <li>
                                        <span class="num">1</span>
                                        <span class="txt">
                                                <strong><?php esc_html_e( 'در پنل ویجنت', 'vigent-woo' ); ?></strong>
                                                <?php esc_html_e( 'یک اتصال سایت با آدرس همین سایت بسازید.', 'vigent-woo' ); ?>
                                        </span>
                                </li>
                                <li>
                                        <span class="num">2</span>
                                        <span class="txt">
                                                <strong><?php esc_html_e( 'دکمه «اتصال» را بزنید', 'vigent-woo' ); ?></strong>
                                                <?php esc_html_e( 'اتصال خودکار برقرار می‌شود.', 'vigent-woo' ); ?>
                                        </span>
                                </li>
                        </ol>
                </div>

                <?php if ( ! $has_wc ) : ?>
                        <div class="vg-card">
                                <h2><?php esc_html_e( 'ووکامرس', 'vigent-woo' ); ?></h2>
                                <p><?php esc_html_e( 'ووکامرس روی این سایت فعال نیست. می‌توانید اتصال را برقرار کنید؛ پس از نصب ووکامرس، هم‌گام‌سازی خودکار فعال می‌شود.', 'vigent-woo' ); ?></p>
                        </div>
                <?php endif; ?>
                <?php
        }

        // ─── Step 2: Push wizard (centered, step-by-step) ───────────────────

        private function render_push_wizard( $has_wc ) {
                ?>
                <div class="vg-card vg-center-card">
                        <div class="vg-center-icon">
                                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <h2 class="vg-center-title"><?php esc_html_e( 'ارسال محصولات به ویجنت', 'vigent-woo' ); ?></h2>
                        <p class="vg-center-sub"><?php esc_html_e( 'اتصال برقرار شد. محصولات را یک‌بار بفرستید؛ پس از آن فقط تغییرات جدید به‌صورت تجمیعی ارسال می‌شوند.', 'vigent-woo' ); ?></p>

                        <?php if ( $has_wc ) : ?>
                                <!-- Optional: include orders in this initial push.
                                     We pre-compute the order stats here so the shop owner
                                     sees EXACTLY how many orders will be synced before they
                                     click the button. -->
                                <?php
                                        $wizard_order_stats = Vigent_Woo_Sync::instance()->get_order_stats();
                                        $wizard_syncable     = $wizard_order_stats['syncable'];
                                        $wizard_total_orders = $wizard_order_stats['total'];
                                        $wizard_cap_orders   = $wizard_order_stats['cap'];
                                        $wizard_cancelled    = $wizard_order_stats['cancelled'];
                                ?>
                                <label class="vg-toggle" style="max-width:420px;margin:0 auto 12px;">
                                        <input type="checkbox" id="vg-include-orders" checked />
                                        <div>
                                                <div class="label">
                                                        <?php
                                                        printf(
                                                                /* translators: %s: number of orders that will be sent */
                                                                esc_html__( 'همچنین سفارش‌ها را هم ارسال کن (%s)', 'vigent-woo' ),
                                                                '<strong>' . esc_html( number_format_i18n( $wizard_syncable ) ) . '</strong>'
                                                        );
                                                        ?>
                                                </div>
                                                <div class="sub">
                                                        <?php
                                                        if ( $wizard_total_orders > $wizard_syncable ) {
                                                                printf(
                                                                        /* translators: 1: total orders, 2: syncable count, 3: cap */
                                                                        esc_html__( 'از مجموع %1$s سفارش قابل پیگیری، فقط %2$s سفارش آخر ارسال می‌شود (حداکثر %3$s). سفارش‌های لغو شده ارسال نمی‌شوند.', 'vigent-woo' ),
                                                                        esc_html( number_format_i18n( $wizard_total_orders ) ),
                                                                        esc_html( number_format_i18n( $wizard_syncable ) ),
                                                                        esc_html( number_format_i18n( $wizard_cap_orders ) )
                                                                );
                                                        } else {
                                                                printf(
                                                                        /* translators: 1: syncable count */
                                                                        esc_html__( 'همهٔ %1$s سفارش قابل پیگیری ارسال می‌شوند. سفارش‌های لغو شده ارسال نمی‌شوند.', 'vigent-woo' ),
                                                                        esc_html( number_format_i18n( $wizard_syncable ) )
                                                                );
                                                        }
                                                        ?>
                                                </div>
                                        </div>
                                </label>

                                <!-- Optional: include customers in this initial push.
                                     We pre-compute the count of paying customers here so the
                                     shop owner sees EXACTLY how many customers will be synced
                                     before they click the button — not after. -->
                                <?php
                                        $wizard_paying_customers = $this->count_customers_with_successful_orders();
                                ?>
                                <label class="vg-toggle" style="max-width:420px;margin:0 auto 24px;">
                                        <input type="checkbox" id="vg-include-customers" checked />
                                        <div>
                                                <div class="label">
                                                        <?php
                                                        printf(
                                                                /* translators: %s: number of paying customers */
                                                                esc_html__( 'همچنین مشتریان با خرید موفق را هم ارسال کن (%s)', 'vigent-woo' ),
                                                                '<strong>' . esc_html( number_format_i18n( $wizard_paying_customers ) ) . '</strong>'
                                                        );
                                                        ?>
                                                </div>
                                                <div class="sub"><?php esc_html_e( 'فقط مشتریانی که حداقل یک سفارش موفق (تکمیل‌شده یا در حال پردازش) دارند ارسال می‌شوند؛ بدون محدودیت تعداد. سایر کاربران ثبت‌نام‌کرده نادیده گرفته می‌شوند.', 'vigent-woo' ); ?></div>
                                        </div>
                                </label>

                                <!-- Step indicators — horizontal pill row:
                                     "(1) محصولات ── (2) سفارش‌ها ── (3) مشتری‌ها ── (4) نهایی‌سازی"
                                     The orders / customers steps are hidden until the user
                                     toggles the corresponding "include" checkbox. The dot
                                     (number) sits on the LEFT of the label inside each pill,
                                     separated by a thin line between pills. -->
                                <div class="vg-wizard-steps">
                                        <div class="vg-wizard-step active" id="vg-step-products">
                                                <span class="dot">1</span>
                                                <span id="vg-step-products-label"><?php esc_html_e( 'محصولات', 'vigent-woo' ); ?></span>
                                        </div>
                                        <div class="vg-wizard-line"></div>
                                        <div class="vg-wizard-step" id="vg-step-orders" style="display:none;">
                                                <span class="dot">2</span>
                                                <span id="vg-step-orders-label"><?php esc_html_e( 'سفارش‌ها', 'vigent-woo' ); ?></span>
                                        </div>
                                        <div class="vg-wizard-line" id="vg-step-orders-line" style="display:none;"></div>
                                        <div class="vg-wizard-step" id="vg-step-customers" style="display:none;">
                                                <span class="dot">3</span>
                                                <span id="vg-step-customers-label"><?php esc_html_e( 'مشتری‌ها', 'vigent-woo' ); ?></span>
                                        </div>
                                        <div class="vg-wizard-line" id="vg-step-customers-line" style="display:none;"></div>
                                        <div class="vg-wizard-step" id="vg-step-finalize">
                                                <span class="dot" id="vg-step-finalize-dot"><?php echo $has_wc ? '4' : '2'; ?></span>
                                                <span id="vg-step-finalize-label"><?php esc_html_e( 'نهایی‌سازی', 'vigent-woo' ); ?></span>
                                        </div>
                                </div>

                                <div class="vg-center-btn-wrap">
                                        <button class="vg-btn-center" onclick="vgStartPush(this)">
                                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                                <?php esc_html_e( 'ارسال محصولات', 'vigent-woo' ); ?>
                                        </button>
                                </div>

                                <!-- Progress (hidden until the user clicks the button) -->
                                <div id="vg-push-progress" class="vg-progress" style="display:none;max-width:460px;margin:0 auto;">
                                        <div class="vg-progress-bar-wrap">
                                                <div id="vg-pbar" class="vg-progress-bar"></div>
                                                <div id="vg-ptext" class="vg-progress-text">0%</div>
                                        </div>
                                        <div id="vg-pinfo" class="vg-progress-info"><span></span><span></span></div>
                                </div>
                        <?php else : ?>
                                <div class="vg-card" style="max-width:420px;margin:0 auto;">
                                        <h2><?php esc_html_e( 'ووکامرس فعال نیست', 'vigent-woo' ); ?></h2>
                                        <p><?php esc_html_e( 'برای ارسال محصولات، ابتدا ووکامرس را نصب و فعال کنید. اتصال شما حفظ می‌شود و پس از نصب ووکامرس می‌توانید این مراحل را ادامه دهید.', 'vigent-woo' ); ?></p>
                                </div>
                        <?php endif; ?>
                </div>
                <?php
        }

        // ─── Connected view — success card + compact management section ─────

        private function render_connected_view( $core, $settings, $status, $has_wc ) {
                $delta         = Vigent_Woo_Sync::instance()->get_delta_status();
                $last_success  = ! empty( $delta['last_success'] ) ? $delta['last_success'] : '';
                $dropped_total = isset( $delta['dropped_total'] ) ? (int) $delta['dropped_total'] : 0;
                ?>
                <div class="vg-card vg-connected-summary">
                        <div class="vg-connected-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#10b981"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <div class="vg-connected-copy">
                                <h2><?php esc_html_e( 'اتصال فعال است', 'vigent-woo' ); ?></h2>
                                <p><?php esc_html_e( 'فقط محصولات و سفارش‌های تغییرکرده تجمیع می‌شوند و حداکثر هر ۵ دقیقه ارسال خواهند شد.', 'vigent-woo' ); ?></p>
                                <p class="vg-sync-note" id="vg-sync-note">
                                        <?php
                                        if ( $last_success ) {
                                                printf( esc_html__( 'آخرین ارسال موفق: %s', 'vigent-woo' ), esc_html( $last_success ) );
                                        } else {
                                                esc_html_e( 'در انتظار نخستین تغییر.', 'vigent-woo' );
                                        }
                                        ?>
                                </p>
                        </div>
                        <div class="vg-btns vg-connected-actions">
                                <button type="button" class="vg-btn vg-btn-black" onclick="vgFlushDelta(this)" <?php disabled( ! $has_wc ); ?>><?php esc_html_e( 'ارسال تغییرات', 'vigent-woo' ); ?></button>
                                <button type="button" class="vg-btn vg-btn-white" onclick="vgSync('products', this)" <?php disabled( ! $has_wc ); ?>><?php esc_html_e( 'ارسال کامل محصولات', 'vigent-woo' ); ?></button>
                        </div>
                </div>

                <?php if ( $dropped_total > 0 ) : ?>
                        <?php // A change the server kept rejecting was dropped so the rest of the queue could move. ?>
                        <div class="vg-card vg-warn">
                                <p>
                                        <?php
                                        printf(
                                                /* translators: %s: number of dropped changes */
                                                esc_html__( '%s تغییر پس از تلاش‌های مکرر ارسال نشد و از صف حذف شد تا بقیه تغییرات ارسال شوند. یک‌بار «ارسال کامل محصولات» را بزنید تا کاتالوگ دوباره هم‌تراز شود.', 'vigent-woo' ),
                                                esc_html( number_format_i18n( $dropped_total ) )
                                        );
                                        ?>
                                </p>
                                <?php if ( ! empty( $delta['last_dropped_error'] ) ) : ?>
                                        <p class="vg-sync-note"><?php echo esc_html( $delta['last_dropped_error'] ); ?></p>
                                <?php endif; ?>
                        </div>
                <?php endif; ?>

                <div id="vg-progress" class="vg-progress vg-card" style="display:none;">
                        <div class="vg-progress-bar-wrap">
                                <div id="vg-pbar" class="vg-progress-bar"></div>
                                <div id="vg-ptext" class="vg-progress-text">0%</div>
                        </div>
                        <div id="vg-pinfo" class="vg-progress-info"><span></span><span></span></div>
                </div>

                <div class="vg-stats">
                        <div class="vg-stat">
                                <div class="num"><?php echo $has_wc ? esc_html( $this->count_products() ) : '—'; ?></div>
                                <div class="lbl"><?php esc_html_e( 'محصولات', 'vigent-woo' ); ?></div>
                        </div>
                        <?php
                                $order_stats = $has_wc
                                        ? Vigent_Woo_Sync::instance()->get_order_stats()
                                        : array( 'total' => 0, 'syncable' => 0, 'cap' => 1000, 'cancelled' => 0 );
                                $total_orders    = $order_stats['total'];
                                $syncable_orders = $order_stats['syncable'];
                                $cap_orders      = $order_stats['cap'];
                                $cancelled_orders = $order_stats['cancelled'];
                        ?>
                        <div class="vg-stat">
                                <div class="num"><?php echo $has_wc ? esc_html( number_format_i18n( $total_orders ) ) : '—'; ?></div>
                                <div class="lbl"><?php esc_html_e( 'سفارش‌های قابل پیگیری', 'vigent-woo' ); ?></div>
                                <?php if ( $has_wc ) : ?>
                                        <div class="sub" style="margin-top:4px;font-size:11px;color:#6b7280;">
                                                <?php
                                                if ( $total_orders > $syncable_orders ) {
                                                        // More orders than the cap — only the most recent N will be sent.
                                                        printf(
                                                                /* translators: 1: syncable count (will be sent), 2: cap (1000) */
                                                                esc_html__( 'فقط %1$s سفارش آخر ارسال می‌شود (حداکثر %2$s)', 'vigent-woo' ),
                                                                '<strong>' . esc_html( number_format_i18n( $syncable_orders ) ) . '</strong>',
                                                                esc_html( number_format_i18n( $cap_orders ) )
                                                        );
                                                } else {
                                                        // All orders fit under the cap — every one will be sent.
                                                        printf(
                                                                /* translators: %s: syncable count */
                                                                esc_html__( 'همه ارسال می‌شوند (%s سفارش در حال پیگیری)', 'vigent-woo' ),
                                                                '<strong>' . esc_html( number_format_i18n( $syncable_orders ) ) . '</strong>'
                                                        );
                                                }
                                                ?>
                                        </div>
                                        <?php if ( $cancelled_orders > 0 ) : ?>
                                                <div class="sub" style="margin-top:2px;font-size:10px;color:#9ca3af;">
                                                        <?php
                                                        printf(
                                                                /* translators: %s: cancelled orders count */
                                                                esc_html__( '%s سفارش لغو شده نادیده گرفته شد', 'vigent-woo' ),
                                                                esc_html( number_format_i18n( $cancelled_orders ) )
                                                        );
                                                        ?>
                                                </div>
                                        <?php endif; ?>
                                <?php endif; ?>
                        </div>
                        <div class="vg-stat">
                                <div class="num"><?php echo $has_wc ? esc_html( $this->count_customers_safe() ) : '—'; ?></div>
                                <div class="lbl"><?php esc_html_e( 'مشتری‌ها', 'vigent-woo' ); ?></div>
                        </div>
                        <?php
                                $payer_stats = $has_wc
                                        ? Vigent_Woo_Sync::instance()->get_paying_customer_stats()
                                        : array( 'total' => 0, 'synced' => 0, 'new' => 0 );
                                $paying_customers = $payer_stats['total'];
                                $synced_customers = $payer_stats['synced'];
                                $new_customers    = $payer_stats['new'];
                        ?>
                        <div class="vg-stat vg-stat-payers">
                                <div class="num" id="vg-payers-count"><?php echo $has_wc ? esc_html( number_format_i18n( $paying_customers ) ) : '—'; ?></div>
                                <div class="lbl"><?php esc_html_e( 'مشتریان با خرید موفق', 'vigent-woo' ); ?></div>
                        </div>
                </div>

                <?php if ( $has_wc ) : ?>
                <div class="vg-card vg-payers-card">
                        <div class="vg-payers-row">
                                <div class="vg-payers-copy">
                                        <h2><?php esc_html_e( 'افزودن مشتریان با خرید موفق', 'vigent-woo' ); ?></h2>
                                        <?php if ( $paying_customers > 0 ) : ?>
                                                <p>
                                                        <?php
                                                        printf(
                                                                /* translators: 1: total paying customers, 2: already synced, 3: new */
                                                                esc_html__( 'در مجموع %1$s مشتری حداقل یک سفارش موفق (تکمیل‌شده یا در حال پردازش) دارند. از این تعداد %2$s تا قبلاً به ویجنت ارسال شده‌اند و %3$s تا جدید هستند که با کلیک روی «افزودن همه» به‌عنوان «مشتری» اضافه می‌شوند.', 'vigent-woo' ),
                                                                '<strong>' . esc_html( number_format_i18n( $paying_customers ) ) . '</strong>',
                                                                '<strong>' . esc_html( number_format_i18n( $synced_customers ) ) . '</strong>',
                                                                '<strong>' . esc_html( number_format_i18n( $new_customers ) ) . '</strong>'
                                                        );
                                                        ?>
                                                </p>
                                        <?php else : ?>
                                                <p><?php esc_html_e( 'هنوز مشتری‌ای با حداقل یک سفارش موفق در فروشگاه شما وجود ندارد. به‌محض ثبت اولین سفارش موفق، خودکار در این لیست قرار می‌گیرد.', 'vigent-woo' ); ?></p>
                                        <?php endif; ?>
                                        <p class="vg-payers-sub"><?php esc_html_e( 'بدون محدودیت تعداد — همهٔ مشتریان با خرید موفق ارسال می‌شوند. موارد قبلی فقط به‌روزرسانی می‌شوند و تکراری ساخته نمی‌شوند (تطبیق با تلفن/ایمیل/شناسه ووکامرس).', 'vigent-woo' ); ?></p>
                                </div>
                                <div class="vg-btns vg-payers-actions">
                                        <button type="button" class="vg-btn vg-btn-black" onclick="vgSync('customers', this)" <?php disabled( ! $has_wc || $paying_customers < 1 ); ?>>
                                                <?php
                                                printf(
                                                        /* translators: %s: total paying customers */
                                                        esc_html__( 'افزودن همه (%s)', 'vigent-woo' ),
                                                        esc_html( number_format_i18n( $paying_customers ) )
                                                );
                                                ?>
                                        </button>
                                </div>
                        </div>
                </div>
                <?php endif; ?>

                <div class="vg-card">
                        <h2><?php esc_html_e( 'تنظیمات هم‌گام‌سازی', 'vigent-woo' ); ?></h2>
                        <p><?php esc_html_e( 'داده‌ها برای معرفی محصول و پیگیری سفارش در اختیار ویجنت قرار می‌گیرند. ثبت یا فروش سفارش توسط ایجنت از این افزونه فعال نمی‌شود.', 'vigent-woo' ); ?></p>

                        <label class="vg-toggle <?php echo $has_wc ? '' : 'off'; ?>">
                                <input type="checkbox" id="sync_products" <?php checked( $settings['sync_products'], '1' ); ?> <?php disabled( ! $has_wc ); ?> />
                                <div>
                                        <div class="label"><?php esc_html_e( 'ارسال تغییرات محصولات', 'vigent-woo' ); ?></div>
                                        <div class="sub"><?php esc_html_e( 'ساخت، ویرایش و حذف محصول همراه دسته‌بندی در صف تجمیعی قرار می‌گیرد.', 'vigent-woo' ); ?></div>
                                </div>
                        </label>

                        <label class="vg-toggle <?php echo $has_wc ? '' : 'off'; ?>">
                                <input type="checkbox" id="sync_orders" <?php checked( $settings['sync_orders'], '1' ); ?> <?php disabled( ! $has_wc ); ?> />
                                <div>
                                        <div class="label"><?php esc_html_e( 'ارسال سفارش‌ها برای پیگیری', 'vigent-woo' ); ?></div>
                                        <div class="sub"><?php esc_html_e( 'ایجاد و تغییر وضعیت سفارش برای پشتیبانی ارسال می‌شود؛ امکان ثبت سفارش ایجاد نمی‌کند.', 'vigent-woo' ); ?></div>
                                </div>
                        </label>

                        <label class="vg-toggle <?php echo $has_wc ? '' : 'off'; ?>">
                                <input type="checkbox" id="sync_customers" <?php checked( $settings['sync_customers'], '1' ); ?> <?php disabled( ! $has_wc ); ?> />
                                <div>
                                        <div class="label"><?php esc_html_e( 'ارسال مشتری‌ها برای پشتیبانی', 'vigent-woo' ); ?></div>
                                        <div class="sub"><?php esc_html_e( 'اطلاعات تماس مشتریان (نام، تلفن، ایمیل، شهر) به‌صورت خودکار ارسال می‌شود تا ایجنت بتواند مشتریان را بشناسد و سوالاتشان را پاسخ دهد.', 'vigent-woo' ); ?></div>
                                </div>
                        </label>

                        <div class="vg-btns">
                                <button class="vg-btn vg-btn-black" onclick="vgSaveToggles(this)"><?php esc_html_e( 'ذخیره', 'vigent-woo' ); ?></button>
                        </div>
                </div>
                <?php
        }

        private function count_products() {
                if ( ! $this->core()->has_wc() ) {
                        return 0;
                }
                $counts = wp_count_posts( 'product' );
                return isset( $counts->publish ) ? (int) $counts->publish : 0;
        }

        private function count_orders_safe() {
                if ( ! $this->core()->has_wc() ) {
                        return 0;
                }
                // Only count real orders, not refunds. Without type=shop_order the
                // count includes shop_order_refund posts, inflating the number.
                $result = wc_get_orders( array(
                        'limit'    => 1,
                        'page'     => 1,
                        'paginate' => true,
                        'return'   => 'ids',
                        'type'     => 'shop_order',
                ) );
                return is_object( $result ) && isset( $result->total ) ? (int) $result->total : 0;
        }

        /**
         * Count WooCommerce customers (WP users with role=customer).
         *
         * Uses WP_User_Query because it's available on every WordPress install
         * and gives us a fast indexed count.
         *
         * @return int
         */
        private function count_customers_safe() {
                if ( ! $this->core()->has_wc() ) {
                        return 0;
                }
                $q = new \WP_User_Query( array(
                        'role'       => 'customer',
                        'number'     => 1,
                        'fields'     => 'ID',
                        'count_total' => true,
                ) );
                return (int) $q->get_total();
        }

        /**
         * Count customers who have at least one PAID order
         * (status = completed or processing).
         *
         * This is the count that drives the «افزودن همه» (Add All) button on
         * the dashboard — the user explicitly asked to only sync customers
         * who have actually bought something, not every registered user.
         *
         * Delegates to Vigent_Woo_Sync::get_customer_ids_with_successful_orders()
         * which caches the result in a transient for 10 minutes, so this is
         * cheap to call on every page render.
         *
         * @return int
         */
        private function count_customers_with_successful_orders() {
                if ( ! $this->core()->has_wc() ) {
                        return 0;
                }
                $ids = Vigent_Woo_Sync::instance()->get_customer_ids_with_successful_orders();
                return count( $ids );
        }

        /**
         * Number of orders that will actually be sent during a full sync.
         *
         * The plugin caps full-sync to MAX_ORDERS_TO_SYNC (1000) most-recent
         * orders — older orders are skipped because they are rarely useful for
         * Vigent's order-tracking use case. We display this cap explicitly so
         * the shop owner understands why only 1000 of their 3000 orders will be
         * sent.
         *
         * @return int
         */
        private function count_syncable_orders() {
                $total = $this->count_orders_safe();
                $cap   = defined( 'Vigent_Woo_Sync::MAX_ORDERS_TO_SYNC' )
                        ? (int) Vigent_Woo_Sync::MAX_ORDERS_TO_SYNC
                        : 1000;
                return min( $total, $cap );
        }
}
