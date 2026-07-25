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
                        .vg-header .vg-btn-disconnect { margin-inline-start: auto; display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,.2); background: rgba(239,68,68,.15); color: #fca5a5; transition: all .12s; min-height: 34px; }
                        .vg-header .vg-btn-disconnect:hover { background: rgba(239,68,68,.3); color: #fff; border-color: rgba(239,68,68,.5); }
                        .vg-header .vg-btn-disconnect:disabled { opacity: .4; cursor: not-allowed; }
                        /* Update button in header — subtle blue tint, sits next to the disconnect button */
                        .vg-header .vg-btn-update { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,.2); background: rgba(59,130,246,.15); color: #93c5fd; transition: all .12s; min-height: 34px; }
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
                        /* Update-status card — small informational strip below the header.
                           Always visible (unlike .vg-update-banner which only appears when an
                           update exists). Shows "آخرین بررسی: ... · بررسی بعدی: ..." so the user
                           knows the auto-check is running. */
                        .vg-update-status { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px; color: #6b7280; }
                        .vg-update-status-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
                        .vg-update-status-label { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: #374151; }
                        .vg-update-status-label svg { color: #6b7280; }
                        .vg-update-status-info { font-variant-numeric: tabular-nums; color: #6b7280; }
                        .vg-update-status-info .num { color: #111; font-weight: 600; }
                        .vg-update-status-info .sep { margin: 0 8px; opacity: .4; }
                        .vg-header .pill.ok { background: rgba(16, 185, 129, .2); color: #6ee7b7; }
                        .vg-header .pill.warn { background: rgba(245, 158, 11, .2); color: #fcd34d; }
                        .vg-header .pill.err { background: rgba(239, 68, 68, .2); color: #fca5a5; }

                        /* Card — white, soft border */
                        .vg-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 16px; }
                        .vg-card h2 { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #111; }
                        .vg-card p { margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.6; }
                        .vg-card p:last-child { margin-bottom: 0; }

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
                        .vg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
                        .vg-stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; text-align: center; }
                        .vg-stat .num { font-size: 26px; font-weight: 800; color: #000; line-height: 1; }
                        .vg-stat .lbl { font-size: 11px; color: #9ca3af; margin-top: 5px; }

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

                        /* ─── Next-sync countdown card ─── */
                        /* Compact card that sits between the success banner and the stats.
                           Shows a live countdown ("هم‌گام‌سازی بعدی تا ۱۲:۳۴") + a thin
                           progress bar that fills up as the next sync approaches. When the
                           countdown hits zero, the text flips to "در حال همگام‌سازی…" and
                           the page reloads a few seconds later to refresh the stats. */
                        .vg-next-sync { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 18px 22px; margin-bottom: 16px; }
                        .vg-next-sync-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
                        .vg-next-sync-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; font-weight: 600; }
                        .vg-next-sync-label svg { color: #10b981; }
                        .vg-next-sync-time { font-size: 13px; color: #6b7280; font-variant-numeric: tabular-nums; font-weight: 600; }
                        .vg-next-sync-time .num { color: #111; font-weight: 800; }
                        .vg-next-sync-bar-wrap { margin-top: 12px; background: #f3f4f6; border-radius: 999px; height: 6px; overflow: hidden; }
                        .vg-next-sync-bar { height: 100%; background: linear-gradient(90deg, #10b981, #000); border-radius: 999px; transition: width 1s linear; width: 0%; }
                        .vg-next-sync-hint { margin-top: 8px; font-size: 11px; color: #9ca3af; text-align: center; }
                </style>
                <?php
        }

        private function output_inline_scripts() {
                $ajax_url = admin_url( 'admin-ajax.php' );
                $nonce    = wp_create_nonce( VIGENT_WOO_NONCE );
                $has_wc   = $this->core()->has_wc();
                $pushed   = (int) get_option( 'vigent_woo_initial_push_done', 0 ) === 1;

                // Compute the next scheduled auto-sync timestamp. WP-Cron stores
                // the next run as a Unix timestamp (UTC, seconds). We pass it to
                // JS so the countdown can be computed client-side without an
                // extra AJAX poll every second.
                //
                // If the cron isn't scheduled (e.g. user just connected and
                // admin_init hasn't run yet), we fall back to "30 min from now"
                // so the countdown still shows something sensible.
                $next_sync_ts = wp_next_scheduled( 'vigent_woo_auto_sync' );
                if ( ! $next_sync_ts ) {
                        $next_sync_ts = time() + 30 * MINUTE_IN_SECONDS;
                }
                $sync_interval_sec = 30 * MINUTE_IN_SECONDS; // matches the cron schedule
                ?>
                <script>
                        window.VG = {
                                ajaxUrl: '<?php echo esc_js( $ajax_url ); ?>',
                                nonce: '<?php echo esc_js( $nonce ); ?>',
                                hasWc: <?php echo $has_wc ? 'true' : 'false'; ?>,
                                pushed: <?php echo $pushed ? 'true' : 'false'; ?>,
                                nextSync: <?php echo (int) $next_sync_ts; ?>,
                                syncIntervalSec: <?php echo (int) $sync_interval_sec; ?>,
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
                        // Sends products (and optionally orders) in small batches so a large
                        // catalog never hits the server in one shot. Each batch waits 300ms
                        // before the next to avoid rate-limit / thundering-herd problems.
                        var vgRunning = false;
                        function vgStartPush(btn) {
                                if (vgRunning) return;
                                vgRunning = true;
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VG.i18n.sendingProducts;

                                var includeOrders = document.getElementById('vg-include-orders');
                                includeOrders = includeOrders ? includeOrders.checked : false;

                                // Show progress section.
                                var progress = document.getElementById('vg-push-progress');
                                if (progress) progress.style.display = 'block';

                                // Reset step indicators.
                                vgSetStep('products', 'active');
                                if (includeOrders) {
                                        var stepOrders = document.getElementById('vg-step-orders');
                                        if (stepOrders) stepOrders.style.display = 'inline-flex';
                                        var stepOrdersLine = document.getElementById('vg-step-orders-line');
                                        if (stepOrdersLine) stepOrdersLine.style.display = 'block';
                                        var finalizeDot = document.getElementById('vg-step-finalize-dot');
                                        if (finalizeDot) finalizeDot.textContent = '3';
                                } else {
                                        var stepOrdersLine = document.getElementById('vg-step-orders-line');
                                        if (stepOrdersLine) stepOrdersLine.style.display = 'none';
                                        var finalizeDot = document.getElementById('vg-step-finalize-dot');
                                        if (finalizeDot) finalizeDot.textContent = '2';
                                }

                                // Chain: products → orders → finalize.
                                vgPushKind('products', 0, 0, 0, function(totalProducts, productErrors) {
                                        vgSetStep('products', 'done');
                                        vgSetStepLabel('products', window.VG.i18n.productSent + ' (' + totalProducts + ')');
                                        if (includeOrders) {
                                                vgSetStep('orders', 'active');
                                                vgPushKind('orders', 0, 0, 0, function(totalOrders, orderErrors) {
                                                        vgSetStep('orders', 'done');
                                                        vgSetStepLabel('orders', window.VG.i18n.ordersSent + ' (' + totalOrders + ')');
                                                        vgFinalize(btn, orig, totalProducts, productErrors, totalOrders, orderErrors);
                                                }, btn, orig);
                                        } else {
                                                vgFinalize(btn, orig, totalProducts, productErrors, 0, []);
                                        }
                                }, btn, orig);
                        }

                        // Push one kind (products|orders) in batches of 25, with 300ms gap
                        // between batches to avoid hammering the server.
                        function vgPushKind(kind, offset, totalSent, totalErrors, cb, btn, orig) {
                                var pBar = document.getElementById('vg-pbar');
                                var pText = document.getElementById('vg-ptext');
                                var pInfo = document.getElementById('vg-pinfo');

                                var body = new FormData();
                                body.append('action', 'vigent_woo_sync_batch');
                                body.append('nonce', window.VG.nonce);
                                body.append('kind', kind);
                                body.append('offset', offset);

                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function(data) {
                                                if (!data.success) {
                                                        cb(totalSent, totalErrors);
                                                        return;
                                                }
                                                var d = data.data;
                                                totalSent += d.sent;
                                                if (d.errors && d.errors.length) totalErrors += d.errors.length;
                                                var pct = d.total > 0 ? Math.min(100, Math.round(((offset + 25) / d.total) * 100)) : 0;
                                                if (pBar) pBar.style.width = pct + '%';
                                                if (pText) pText.textContent = pct + '%';
                                                if (pInfo) pInfo.innerHTML = '<span>' + totalSent + ' / ' + d.total + '</span><span>خطا: ' + totalErrors + '</span>';
                                                if (d.done) {
                                                        cb(totalSent, totalErrors);
                                                } else {
                                                        // 300ms gap between batches → no rate-limit storms even on
                                                        // stores with thousands of products.
                                                        setTimeout(function() {
                                                                vgPushKind(kind, offset + 25, totalSent, totalErrors, cb, btn, orig);
                                                        }, 300);
                                                }
                                        })
                                        .catch(function() { cb(totalSent, totalErrors); });
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
                                        .finally(function() {
                                                // Reload to show the success card + management section.
                                                setTimeout(function() { location.reload(); }, 600);
                                        });
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

                                        fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                                .then(function(r) { return r.json(); })
                                                .then(function(data) {
                                                        if (!data.success) { finish(); return; }
                                                        var d = data.data;
                                                        totalSent += d.sent;
                                                        if (d.errors && d.errors.length) allErrors = allErrors.concat(d.errors);
                                                        var pct = d.total > 0 ? Math.min(100, Math.round(((offset + 25) / d.total) * 100)) : 0;
                                                        if (pBar) pBar.style.width = pct + '%';
                                                        if (pText) pText.textContent = pct + '%';
                                                        if (pInfo) pInfo.innerHTML = '<span>' + totalSent + ' / ' + d.total + '</span><span>خطا: ' + allErrors.length + '</span>';
                                                        if (d.done) { finish(); } else { offset += 25; setTimeout(batch, 300); }
                                                })
                                                .catch(function() { finish(); });
                                }

                                function finish() {
                                        vgRunning = false;
                                        btn.disabled = false;
                                        btn.innerHTML = orig;
                                        if (pBar) pBar.style.width = '100%';
                                        if (pText) pText.textContent = '100%';
                                        if (pInfo) pInfo.innerHTML = '<span>' + window.VG.i18n.done + ' — ' + totalSent + ' مورد</span><span>خطا: ' + allErrors.length + '</span>';
                                        setTimeout(function() { location.reload(); }, 1200);
                                }

                                batch();
                        }

                        // ─── Save toggles ───────────────────────────────────────────
                        function vgSaveToggles(btn) {
                                btn.disabled = true;
                                var orig = btn.innerHTML;
                                btn.innerHTML = '<span class="vg-spinner"></span> <?php echo esc_js( __( "ذخیره…", "vigent-woo" ) ); ?>';

                                var syncProducts = document.getElementById('sync_products') ? document.getElementById('sync_products').checked : false;
                                var syncOrders = document.getElementById('sync_orders') ? document.getElementById('sync_orders').checked : false;

                                var body = new FormData();
                                body.append('action', 'vigent_woo_save_toggles');
                                body.append('nonce', window.VG.nonce);
                                body.append('sync_products', syncProducts ? '1' : '0');
                                body.append('sync_orders', syncOrders ? '1' : '0');

                                fetch(window.VG.ajaxUrl, { method: 'POST', body: body })
                                        .then(function(r) { return r.json(); })
                                        .then(function() { btn.innerHTML = '<?php echo esc_js( __( "✓ ذخیره شد", "vigent-woo" ) ); ?>'; setTimeout(function() { btn.innerHTML = orig; btn.disabled = false; }, 1500); })
                                        .catch(function() { btn.innerHTML = orig; btn.disabled = false; });
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
                        //   2. New version available → banner appears with
                        //      "نصب بروزرسانی" button → user clicks → redirected
                        //      to WP's update-core.php which runs the actual
                        //      installer (uses WP Core's upgrader).
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
                                                        // Show the update banner with install button.
                                                        var banner = document.getElementById('vg-update-banner');
                                                        if (banner) {
                                                                banner.style.display = 'flex';
                                                                var verEl = banner.querySelector('.latest-version');
                                                                if (verEl) verEl.textContent = d.latest_version;
                                                                var curEl = banner.querySelector('.current-version');
                                                                if (curEl) curEl.textContent = d.current_version;
                                                                var installBtn = banner.querySelector('.vg-btn-install');
                                                                if (installBtn && d.install_url) installBtn.href = d.install_url;
                                                        }
                                                        // Mark the header button as "has update" so it glows.
                                                        var headerBtn = document.getElementById('vg-btn-update');
                                                        if (headerBtn) headerBtn.classList.add('has-update');
                                                } else {
                                                        alert(d.message || 'شما از آخرین نسخه استفاده می‌کنید.');
                                                }
                                        })
                                        .catch(function() {
                                                if (btn) { btn.disabled = false; btn.innerHTML = orig; }
                                                alert('خطا در ارتباط با سرور ویجنت.');
                                        });
                        }

                        // ─── Sync the wizard-step indicators with the "include orders"
                        // checkbox state. When the user toggles the checkbox, we hide/show
                        // the orders step + its connector line, and renumber the finalize
                        // dot (3 when orders is on, 2 when off). This keeps the visual
                        // indicator in sync with what will actually happen on submit.
                        function vgSyncWizardSteps() {
                                var cb = document.getElementById('vg-include-orders');
                                if (!cb) return;
                                var includeOrders = cb.checked;
                                var stepOrders = document.getElementById('vg-step-orders');
                                var stepOrdersLine = document.getElementById('vg-step-orders-line');
                                var finalizeDot = document.getElementById('vg-step-finalize-dot');
                                if (stepOrders) stepOrders.style.display = includeOrders ? 'inline-flex' : 'none';
                                if (stepOrdersLine) stepOrdersLine.style.display = includeOrders ? 'block' : 'none';
                                if (finalizeDot) finalizeDot.textContent = includeOrders ? '3' : '2';
                        }
                        document.addEventListener('DOMContentLoaded', function() {
                                var cb = document.getElementById('vg-include-orders');
                                if (cb) {
                                        cb.addEventListener('change', vgSyncWizardSteps);
                                        // Run once on load to make sure the initial state matches.
                                        vgSyncWizardSteps();
                                }
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
                                        })
                                        .catch(function() {});
                        }
                        setInterval(vgRefreshHeaderStatus, 30000);
                        document.addEventListener('DOMContentLoaded', vgRefreshHeaderStatus);

                        // ─── Next-sync countdown ──────────────────────────────────
                        // Live countdown to the next scheduled auto-sync. window.VG.nextSync
                        // is the Unix timestamp (seconds) of the next cron run, set by PHP
                        // via wp_next_scheduled(). The bar fills from 0→100% over the
                        // 30-minute window. When the countdown hits zero we flip the text
                        // to "در حال همگام‌سازی…" and reload the page after 10s so the
                        // refreshed stats show the new sync.
                        function vgFormatCountdown(secs) {
                                if (secs < 0) secs = 0;
                                var m = Math.floor(secs / 60);
                                var s = secs % 60;
                                // Persian digits — looks more native on the dashboard.
                                var faDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
                                var pad = function(n) { return (n < 10 ? '۰' : '') + String(n).replace(/\d/g, function(d) { return faDigits[+d]; }); };
                                return pad(m) + ':' + pad(s);
                        }

                        function vgUpdateCountdown() {
                                var wrap = document.getElementById('vg-next-sync');
                                if (!wrap || !window.VG.nextSync) return;
                                var bar = document.getElementById('vg-next-sync-bar');
                                var timeEl = document.getElementById('vg-next-sync-time');
                                var labelEl = document.getElementById('vg-next-sync-label-text');
                                var hintEl = document.getElementById('vg-next-sync-hint');
                                if (!timeEl || !bar) return;

                                var nowSec = Math.floor(Date.now() / 1000);
                                var remain = window.VG.nextSync - nowSec;
                                var total = window.VG.syncIntervalSec || 1800; // 30 min default

                                if (remain <= 0) {
                                        // Countdown finished — sync should be running now.
                                        if (labelEl) labelEl.textContent = '<?php echo esc_js( __( "در حال همگام‌سازی…", "vigent-woo" ) ); ?>';
                                        if (timeEl) timeEl.innerHTML = '<span class="num">…</span>';
                                        if (bar) bar.style.width = '100%';
                                        if (hintEl) hintEl.textContent = '<?php echo esc_js( __( "لطفاً صبر کنید.", "vigent-woo" ) ); ?>';
                                        // Reload once after 10s to refresh stats. We guard with a
                                        // flag so the timer doesn't keep reloading in a loop.
                                        if (!window.vgReloadScheduled) {
                                                window.vgReloadScheduled = true;
                                                setTimeout(function() { location.reload(); }, 10000);
                                        }
                                        return;
                                }

                                // Progress = (total - remain) / total → 0% at start, 100% at end.
                                var pct = Math.max(0, Math.min(100, Math.round(((total - remain) / total) * 100)));
                                if (bar) bar.style.width = pct + '%';
                                if (timeEl) timeEl.innerHTML = '<span class="num">' + vgFormatCountdown(remain) + '</span>';
                        }
                        document.addEventListener('DOMContentLoaded', function() {
                                vgUpdateCountdown();
                                setInterval(vgUpdateCountdown, 1000);
                        });
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
                        if ( 'connect' === $view ) {
                                $this->render_connect_step( $has_wc );
                        } elseif ( 'push' === $view ) {
                                $this->render_push_wizard( $has_wc );
                        } else {
                                $this->render_connected_view( $core, $settings, $status, $has_wc );
                        }

                        // Update banner — always rendered in the DOM but hidden by
                        // default. JavaScript toggles its display when vgCheckUpdate()
                        // finds a new version. This way, the check is lazy (only
                        // happens when the user clicks) but the banner is instantly
                        // available without re-rendering the page.
                        $this->render_update_banner();
                        ?>
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
                // اطلاعات آخرین چک خودکار (روی صفحه نشون می‌دیم تا کاربر بدونه
                // سیستم هر ۲۴ ساعت خودش چک می‌کنه).
                $last_check = class_exists( 'Vigent_Woo_Updater' )
                        ? Vigent_Woo_Updater::instance()->get_last_check()
                        : false;
                $next_ts = wp_next_scheduled( 'vigent_woo_daily_update_check' );
                ?>
                <!-- Update-status card — always visible, shows last-auto-check + next scheduled check.
                     This is informational, not an alert. The actual "new version" banner is the
                     vg-update-banner element below. -->
                <div class="vg-update-status">
                        <div class="vg-update-status-row">
                                <span class="vg-update-status-label">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                                        <?php esc_html_e( 'بررسی خودکار بروزرسانی', 'vigent-woo' ); ?>
                                </span>
                                <span class="vg-update-status-info">
                                        <?php
                                        if ( $last_check && ! empty( $last_check['checked_at'] ) ) {
                                                printf(
                                                        /* translators: %s: datetime */
                                                        esc_html__( 'آخرین بررسی: %s', 'vigent-woo' ),
                                                        '<span class="num">' . esc_html( $last_check['checked_at'] ) . '</span>'
                                                );
                                        } else {
                                                echo '<span class="num">' . esc_html__( 'هنوز بررسی نشده', 'vigent-woo' ) . '</span>';
                                        }
                                        ?>
                                        <span class="sep">·</span>
                                        <?php
                                        if ( $next_ts ) {
                                                printf(
                                                        /* translators: %s: datetime */
                                                        esc_html__( 'بررسی بعدی: %s', 'vigent-woo' ),
                                                        '<span class="num" data-next-check="' . (int) $next_ts . '">' . esc_html( date_i18n( 'Y/m/d H:i', (int) $next_ts ) ) . '</span>'
                                                );
                                        } else {
                                                echo '<span class="num">' . esc_html__( 'زمان‌بندی نشده', 'vigent-woo' ) . '</span>';
                                        }
                                        ?>
                                </span>
                        </div>
                </div>

                <div class="vg-update-banner" id="vg-update-banner" style="display:none;">
                        <div class="icon">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div class="text">
                                <strong><?php esc_html_e( 'بروزرسانی جدید افزونه ویجنت موجود است', 'vigent-woo' ); ?></strong>
                                <?php
                                /* translators: 1: current version, 2: latest version */
                                printf( esc_html__( 'نسخه فعلی شما %1$s است و نسخه جدید %2$s منتشر شده است.', 'vigent-woo' ), '<span class="current-version">' . esc_html( VIGENT_WOO_VERSION ) . '</span>', '<span class="latest-version">—</span>' );
                                ?>
                        </div>
                        <a href="#" class="vg-btn-install" onclick="return confirm('<?php echo esc_js( __( 'آیا از نصب بروزرسانی مطمئن هستید؟ افزونه به‌طور موقت غیرفعال خواهد شد.', 'vigent-woo' ) ); ?>');">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <?php esc_html_e( 'نصب بروزرسانی', 'vigent-woo' ); ?>
                        </a>
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
                        <p class="vg-center-sub"><?php esc_html_e( 'اتصال برقرار شد! حالا محصولات خود را به ویجنت بفرستید تا ایجنت آن‌ها را بشناسد. پس از ارسال، هم‌گام‌سازی خودکار هر ۳۰ دقیقه انجام می‌شود.', 'vigent-woo' ); ?></p>

                        <?php if ( $has_wc ) : ?>
                                <!-- Optional: include orders in this initial push -->
                                <label class="vg-toggle" style="max-width:420px;margin:0 auto 24px;">
                                        <input type="checkbox" id="vg-include-orders" checked />
                                        <div>
                                                <div class="label"><?php esc_html_e( 'همچنین سفارش‌ها را هم ارسال کن', 'vigent-woo' ); ?></div>
                                                <div class="sub"><?php esc_html_e( 'سفارش‌های اخیر برای پیگیری و پشتیبانی ارسال می‌شوند.', 'vigent-woo' ); ?></div>
                                        </div>
                                </label>

                                <!-- Step indicators — horizontal pill row:
                                     "(1) محصولات ── (2) سفارش‌ها ── (3) نهایی‌سازی"
                                     The orders step is hidden until the user toggles the
                                     "include orders" checkbox. The dot (number) sits on
                                     the LEFT of the label inside each pill, separated by
                                     a thin line between pills. -->
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
                                        <div class="vg-wizard-step" id="vg-step-finalize">
                                                <span class="dot" id="vg-step-finalize-dot"><?php echo $has_wc ? '3' : '2'; ?></span>
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
                ?>
                <!-- Success card — centered -->
                <div class="vg-card vg-center-card">
                        <div class="vg-center-icon">
                                <svg viewBox="0 0 24 24" width="56" height="56"><circle cx="12" cy="12" r="10" fill="#10b981"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        </div>
                        <h2 class="vg-center-title"><?php esc_html_e( 'با موفقیت وصل شد!', 'vigent-woo' ); ?></h2>
                        <p class="vg-center-sub"><?php esc_html_e( 'سایت و محصولات شما با موفقیت به ویجنت وصل شد. هم‌گام‌سازی خودکار هر ۳۰ دقیقه فعال است و تغییرات (مثل قیمت یا موجودی) بلافاصله اعمال می‌شوند.', 'vigent-woo' ); ?></p>
                </div>

                <!-- Next-sync countdown — only shown when WooCommerce is active
                     (otherwise there's nothing to sync). The bar + time are
                     updated live by vgUpdateCountdown() in output_inline_scripts. -->
                <?php if ( $has_wc ) : ?>
                        <div class="vg-next-sync" id="vg-next-sync">
                                <div class="vg-next-sync-row">
                                        <span class="vg-next-sync-label">
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                <span id="vg-next-sync-label-text"><?php esc_html_e( 'هم‌گام‌سازی بعدی تا', 'vigent-woo' ); ?></span>
                                        </span>
                                        <span class="vg-next-sync-time" id="vg-next-sync-time"><span class="num">—</span></span>
                                </div>
                                <div class="vg-next-sync-bar-wrap">
                                        <div class="vg-next-sync-bar" id="vg-next-sync-bar"></div>
                                </div>
                                <p class="vg-next-sync-hint" id="vg-next-sync-hint"><?php esc_html_e( 'محصولات و سفارش‌ها به‌صورت خودکار همگام می‌شوند.', 'vigent-woo' ); ?></p>
                        </div>
                <?php endif; ?>

                <!-- Stats — compact -->
                <div class="vg-stats">
                        <div class="vg-stat">
                                <div class="num"><?php echo $has_wc ? esc_html( $this->count_products() ) : '—'; ?></div>
                                <div class="lbl"><?php esc_html_e( 'محصولات', 'vigent-woo' ); ?></div>
                        </div>
                        <div class="vg-stat">
                                <div class="num"><?php echo $has_wc ? esc_html( $this->count_orders_safe() ) : '—'; ?></div>
                                <div class="lbl"><?php esc_html_e( 'سفارش‌ها', 'vigent-woo' ); ?></div>
                        </div>
                        <div class="vg-stat">
                                <div class="num"><?php echo esc_html( count( $core->get_retry_queue() ) ); ?></div>
                                <div class="lbl"><?php esc_html_e( 'در صف تلاش مجدد', 'vigent-woo' ); ?></div>
                        </div>
                </div>

                <!-- Settings -->
                <div class="vg-card">
                        <h2><?php esc_html_e( 'تنظیمات هم‌گام‌سازی', 'vigent-woo' ); ?></h2>
                        <p><?php esc_html_e( 'هم‌گام‌سازی خودکار هر ۳۰ دقیقه انجام می‌شود و تغییرات لحظه‌ای (قیمت، موجودی، حذف) بلافاصله اعمال می‌شوند.', 'vigent-woo' ); ?></p>

                        <label class="vg-toggle <?php echo $has_wc ? '' : 'off'; ?>">
                                <input type="checkbox" id="sync_products" <?php checked( $settings['sync_products'], '1' ); ?> <?php disabled( ! $has_wc ); ?> />
                                <div>
                                        <div class="label"><?php esc_html_e( 'هم‌گام‌سازی محصولات', 'vigent-woo' ); ?></div>
                                        <div class="sub"><?php esc_html_e( 'محصولات هر ۳۰ دقیقه و هنگام تغییر به‌صورت لحظه‌ای ارسال می‌شوند.', 'vigent-woo' ); ?></div>
                                </div>
                        </label>

                        <label class="vg-toggle <?php echo $has_wc ? '' : 'off'; ?>">
                                <input type="checkbox" id="sync_orders" <?php checked( $settings['sync_orders'], '1' ); ?> <?php disabled( ! $has_wc ); ?> />
                                <div>
                                        <div class="label"><?php esc_html_e( 'هم‌گام‌سازی سفارش‌ها (برای پیگیری)', 'vigent-woo' ); ?></div>
                                        <div class="sub"><?php esc_html_e( 'سفارش‌ها برای پیگیری و پشتیبانی به ویجنت ارسال می‌شوند.', 'vigent-woo' ); ?></div>
                                </div>
                        </label>

                        <div class="vg-btns">
                                <button class="vg-btn vg-btn-black" onclick="vgSaveToggles(this)"><?php esc_html_e( 'ذخیره', 'vigent-woo' ); ?></button>
                        </div>
                </div>
                <?php
        }

        private function count_products() {
                if ( ! $this->core()->has_wc() ) return 0;
                $ids = wc_get_products( array( 'limit' => -1, 'return' => 'ids', 'status' => 'publish' ) );
                return is_array( $ids ) ? count( $ids ) : 0;
        }

        private function count_orders_safe() {
                if ( ! $this->core()->has_wc() ) return 0;
                $ids = wc_get_orders( array( 'limit' => -1, 'return' => 'ids' ) );
                return is_array( $ids ) ? count( $ids ) : 0;
        }
}
