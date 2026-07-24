<?php
/**
 * Admin class for Vigent Woo plugin.
 *
 * Builds the admin menu, settings pages, sync page (with progress bar),
 * stats page, tools page, and enqueues assets.
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
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( VIGENT_WOO_OPTION ), array( $this, 'add_action_links' ) );
		// Fix: correct plugin basename.
		add_filter( 'plugin_action_links_' . plugin_basename( dirname( __DIR__ ) . '/vigent-woo.php' ), array( $this, 'add_action_links' ) );
	}

	private function core() {
		return Vigent_Woo_Core::instance();
	}

	// ─── Menu ────────────────────────────────────────────────────────────

	public function add_admin_menu() {
		// منوی اصلی همیشه نمایش داده می‌شود.
		add_menu_page(
			__( 'ویجنت', 'vigent-woo' ),
			__( 'ویجنت', 'vigent-woo' ),
			'manage_options',
			'vigent-woo',
			array( $this, 'render_dashboard_page' ),
			'dashicons-superhero-alt',
			56
		);

		// زیرمنو: داشبورد (همان صفحه اصلی).
		add_submenu_page(
			'vigent-woo',
			__( 'داشبورد ویجنت', 'vigent-woo' ),
			__( 'داشبورد', 'vigent-woo' ),
			'manage_options',
			'vigent-woo',
			array( $this, 'render_dashboard_page' )
		);

		// زیرمنو: تنظیمات اتصال.
		add_submenu_page(
			'vigent-woo',
			__( 'تنظیمات اتصال', 'vigent-woo' ),
			__( 'تنظیمات اتصال', 'vigent-woo' ),
			'manage_options',
			'vigent-woo-settings',
			array( $this, 'render_settings_page' )
		);

		// زیرمنو: هم‌گام‌سازی.
		add_submenu_page(
			'vigent-woo',
			__( 'هم‌گام‌سازی', 'vigent-woo' ),
			__( 'هم‌گام‌سازی', 'vigent-woo' ),
			'manage_options',
			'vigent-woo-sync',
			array( $this, 'render_sync_page' )
		);

		// زیرمنو: آمار سایت.
		add_submenu_page(
			'vigent-woo',
			__( 'آمار سایت', 'vigent-woo' ),
			__( 'آمار سایت', 'vigent-woo' ),
			'manage_options',
			'vigent-woo-stats',
			array( $this, 'render_stats_page' )
		);

		// زیرمنو: ابزارها.
		add_submenu_page(
			'vigent-woo',
			__( 'ابزارها', 'vigent-woo' ),
			__( 'ابزارها', 'vigent-woo' ),
			'manage_options',
			'vigent-woo-tools',
			array( $this, 'render_tools_page' )
		);

		// زیرمنو: راهنما.
		add_submenu_page(
			'vigent-woo',
			__( 'راهنما', 'vigent-woo' ),
			__( 'راهنما', 'vigent-woo' ),
			'manage_options',
			'vigent-woo-help',
			array( $this, 'render_help_page' )
		);
	}

	public function add_action_links( $links ) {
		$settings_link = sprintf(
			'<a href="%s">%s</a>',
			esc_url( admin_url( 'admin.php?page=vigent-woo-settings' ) ),
			__( 'تنظیمات', 'vigent-woo' )
		);
		array_unshift( $links, $settings_link );
		return $links;
	}

	// ─── Assets ──────────────────────────────────────────────────────────

	public function enqueue_assets( $hook ) {
		if ( false === strpos( $hook, 'vigent-woo' ) ) {
			return;
		}
		// Inline CSS/JS for performance — no extra HTTP requests.
		$this->output_inline_styles();
		$this->output_inline_scripts();
	}

	private function output_inline_styles() {
		?>
		<style>
			/* ─── Layout ─── */
			.vg-wrap { max-width: 1200px; margin: 0 auto; padding: 20px 0 40px; font-family: -apple-system, "IRANSansWeb", "Vazirmatn", Tahoma, sans-serif; }
			.vg-header { display: flex; align-items: center; gap: 16px; padding: 20px 24px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; color: #fff; margin-bottom: 24px; box-shadow: 0 4px 14px rgba(0,0,0,.12); }
			.vg-logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; flex-shrink: 0; }
			.vg-header h1 { margin: 0; font-size: 20px; font-weight: 800; }
			.vg-header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }

			/* ─── Tabs ─── */
			.vg-tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px; }
			.vg-tab { padding: 10px 16px; font-size: 13px; font-weight: 600; color: #6b7280; text-decoration: none; border-bottom: 2px solid transparent; transition: all .15s; }
			.vg-tab.active { color: #6366f1; border-bottom-color: #6366f1; }
			.vg-tab:hover { color: #111827; }

			/* ─── Cards ─── */
			.vg-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
			@media (min-width: 900px) { .vg-grid.has-aside { grid-template-columns: 1fr 320px; } .vg-grid.cols-2 { grid-template-columns: 1fr 1fr; } .vg-grid.cols-3 { grid-template-columns: repeat(3, 1fr); } .vg-grid.cols-4 { grid-template-columns: repeat(4, 1fr); } }
			.vg-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px 24px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
			.vg-card h2 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #111827; display: flex; align-items: center; gap: 8px; }
			.vg-card h2 .dashicons { color: #6366f1; }
			.vg-card p.desc { margin: 0 0 16px; color: #6b7280; font-size: 13px; line-height: 1.7; }
			.vg-card + .vg-card { margin-top: 0; }

			/* ─── Status badge ─── */
			.vg-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
			.vg-status.ok { background: #ecfdf5; color: #047857; }
			.vg-status.warn { background: #fffbeb; color: #b45309; }
			.vg-status.err { background: #fef2f2; color: #b91c1c; }
			.vg-status.unknown { background: #f3f4f6; color: #6b7280; }
			.vg-status .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
			.vg-status.ok .dot { animation: vg-pulse 2s infinite; }
			@keyframes vg-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

			/* ─── Live status banner ─── */
			.vg-live-status { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid; }
			.vg-live-status.connected { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-color: #a7f3d0; color: #047857; }
			.vg-live-status.disconnected { background: linear-gradient(135deg, #fef2f2, #fee2e2); border-color: #fecaca; color: #b91c1c; }
			.vg-live-status.unknown { background: linear-gradient(135deg, #f9fafb, #f3f4f6); border-color: #e5e7eb; color: #6b7280; }
			.vg-live-status .icon { font-size: 24px; width: 24px; height: 24px; flex-shrink: 0; }
			.vg-live-status .text { flex: 1; }
			.vg-live-status .text strong { font-size: 14px; display: block; margin-bottom: 2px; }
			.vg-live-status .text small { font-size: 11px; opacity: .8; }

			/* ─── Form ─── */
			.vg-form-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
			.vg-form-row label { font-size: 13px; font-weight: 600; color: #374151; }
			.vg-form-row input[type="url"], .vg-form-row input[type="text"], .vg-form-row input[type="password"], .vg-form-row input[type="number"], .vg-form-row select, .vg-form-row textarea { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: "SF Mono", "Vazirmatn", monospace; direction: ltr; text-align: left; transition: border-color .15s; width: 100%; box-sizing: border-box; }
			.vg-form-row input:focus, .vg-form-row select:focus, .vg-form-row textarea:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
			.vg-form-row .hint { font-size: 12px; color: #9ca3af; line-height: 1.6; }
			.vg-form-row select { font-family: inherit; }

			/* ─── Checkbox ─── */
			.vg-checkbox-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 10px; cursor: pointer; transition: background-color .15s; }
			.vg-checkbox-row:hover { background: #f9fafb; }
			.vg-checkbox-row input[type="checkbox"] { margin-top: 2px; width: 18px; height: 18px; accent-color: #6366f1; }
			.vg-checkbox-row .label { font-size: 13px; font-weight: 600; color: #111827; }
			.vg-checkbox-row .sub { font-size: 12px; color: #6b7280; margin-top: 2px; line-height: 1.6; }
			.vg-checkbox-row.disabled { opacity: .55; cursor: not-allowed; background: #f9fafb; }

			/* ─── Buttons ─── */
			.vg-buttons { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
			.vg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; text-decoration: none; transition: all .15s; }
			.vg-btn-primary { background: #6366f1; color: #fff; }
			.vg-btn-primary:hover { background: #4f46e5; color: #fff; }
			.vg-btn-secondary { background: #fff; border-color: #d1d5db; color: #374151; }
			.vg-btn-secondary:hover { background: #f9fafb; color: #111827; }
			.vg-btn-success { background: #10b981; color: #fff; }
			.vg-btn-success:hover { background: #059669; color: #fff; }
			.vg-btn-danger { background: #ef4444; color: #fff; }
			.vg-btn-danger:hover { background: #dc2626; color: #fff; }
			.vg-btn .dashicons { width: 16px; height: 16px; font-size: 16px; }
			.vg-btn:disabled { opacity: .5; cursor: not-allowed; }

			/* ─── Notices ─── */
			.vg-notice { padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; line-height: 1.7; display: flex; gap: 10px; align-items: flex-start; }
			.vg-notice.info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
			.vg-notice.success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
			.vg-notice.warning { background: #fffbeb; color: #b45309; border: 1px solid #fcd34d; }
			.vg-notice.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
			.vg-notice .dashicons { margin-top: 2px; }

			/* ─── Meta grid ─── */
			.vg-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 16px; }
			.vg-meta-item { background: #f9fafb; padding: 12px 14px; border-radius: 10px; border: 1px solid #f3f4f6; }
			.vg-meta-item .k { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
			.vg-meta-item .v { font-size: 14px; font-weight: 700; color: #111827; }
			.vg-meta-item .v.big { font-size: 20px; color: #6366f1; }

			/* ─── Progress bar ─── */
			.vg-progress { margin: 20px 0; }
			.vg-progress-bar-wrap { background: #f3f4f6; border-radius: 999px; height: 24px; overflow: hidden; position: relative; }
			.vg-progress-bar { background: linear-gradient(90deg, #6366f1, #8b5cf6); height: 100%; border-radius: 999px; transition: width .4s ease; width: 0%; }
			.vg-progress-text { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.3); }
			.vg-progress-info { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #6b7280; }
			.vg-progress-errors { margin-top: 12px; max-height: 200px; overflow-y: auto; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; font-size: 11px; color: #b91c1c; }

			/* ─── Steps ─── */
			.vg-steps { counter-reset: vgstep; padding: 0; margin: 0; list-style: none; }
			.vg-steps li { padding: 10px 0 10px 44px; position: relative; font-size: 13px; color: #374151; line-height: 1.7; }
			.vg-steps li::before { counter-increment: vgstep; content: counter(vgstep); position: absolute; right: 0; top: 8px; width: 28px; height: 28px; border-radius: 50%; background: #6366f1; color: #fff; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; }
			.vg-steps li strong { color: #111827; }

			/* ─── Copy field ─── */
			.vg-copy-row { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; }
			.vg-copy-row code { flex: 1; font-family: "SF Mono", "Vazirmatn", monospace; font-size: 12px; color: #111827; direction: ltr; text-align: left; word-break: break-all; }
			.vg-copy-row button { padding: 4px 10px; background: #6366f1; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; }
			.vg-copy-row button:hover { background: #4f46e5; }

			/* ─── Help list ─── */
			.vg-help-list { padding-right: 0; list-style: none; }
			.vg-help-list li { padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; line-height: 1.8; color: #374151; }
			.vg-help-list li:last-child { border-bottom: none; }
			.vg-help-list li strong { color: #111827; display: block; margin-bottom: 4px; font-size: 13px; }
			.vg-help-list code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px; direction: ltr; display: inline-block; }

			/* ─── Stats cards ─── */
			.vg-stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; }
			.vg-stat-card .num { font-size: 28px; font-weight: 800; color: #6366f1; line-height: 1; }
			.vg-stat-card .lbl { font-size: 12px; color: #6b7280; margin-top: 4px; }
			.vg-stat-card .icon { width: 36px; height: 36px; border-radius: 10px; background: #f3f4f6; display: inline-flex; align-items: center; justify-content: center; color: #6366f1; margin-bottom: 12px; }

			/* ─── Mini bar chart ─── */
			.vg-mini-chart { display: flex; align-items: flex-end; gap: 4px; height: 80px; padding: 12px 0; }
			.vg-mini-chart .bar { flex: 1; background: linear-gradient(180deg, #6366f1, #8b5cf6); border-radius: 4px 4px 0 0; min-height: 2px; transition: height .3s; }
			.vg-mini-chart .bar:hover { opacity: .8; }
			.vg-mini-chart-labels { display: flex; gap: 4px; font-size: 10px; color: #9ca3af; }
			.vg-mini-chart-labels span { flex: 1; text-align: center; }

			/* ─── Spinner ─── */
			.vg-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: vg-spin .6s linear infinite; }
			@keyframes vg-spin { to { transform: rotate(360deg); } }

			/* ─── Retry queue ─── */
			.vg-retry-list { max-height: 240px; overflow-y: auto; }
			.vg-retry-list table { width: 100%; border-collapse: collapse; font-size: 12px; }
			.vg-retry-list th, .vg-retry-list td { padding: 8px 10px; text-align: right; border-bottom: 1px solid #f3f4f6; }
			.vg-retry-list th { background: #f9fafb; font-weight: 600; color: #6b7280; }
			.vg-retry-list td { color: #374151; }
		</style>
		<?php
	}

	private function output_inline_scripts() {
		$ajax_url  = admin_url( 'admin-ajax.php' );
		$nonce     = wp_create_nonce( VIGENT_WOO_NONCE );
		?>
		<script>
			window.VIGENT_WOO = {
				ajaxUrl: '<?php echo esc_js( $ajax_url ); ?>',
				nonce: '<?php echo esc_js( $nonce ); ?>',
				i18n: {
					syncing: '<?php echo esc_js( __( 'در حال هم‌گام‌سازی…', 'vigent-woo' ) ); ?>',
					sent: '<?php echo esc_js( __( 'ارسال شد', 'vigent-woo' ) ); ?>',
					errors: '<?php echo esc_js( __( 'خطاها', 'vigent-woo' ) ); ?>',
					done: '<?php echo esc_js( __( 'تکمیل شد!', 'vigent-woo' ) ); ?>',
					startSync: '<?php echo esc_js( __( 'شروع هم‌گام‌سازی', 'vigent-woo' ) ); ?>',
					stop: '<?php echo esc_js( __( 'توقف', 'vigent-woo' ) ); ?>',
					testing: '<?php echo esc_js( __( 'در حال تست…', 'vigent-woo' ) ); ?>',
					copyOk: '<?php echo esc_js( __( 'کپی شد!', 'vigent-woo' ) ); ?>',
				},
			};

			// ─── Copy to clipboard ───
			function vgCopy(btn) {
				var code = btn.parentElement.querySelector('code');
				if (!code) return;
				var text = code.textContent;
				var ta = document.createElement('textarea');
				ta.value = text;
				document.body.appendChild(ta);
				ta.select();
				try { document.execCommand('copy'); } catch (e) {}
				document.body.removeChild(ta);
				var orig = btn.textContent;
				btn.textContent = window.VIGENT_WOO.i18n.copyOk;
				setTimeout(function() { btn.textContent = orig; }, 1500);
			}

			// ─── Live status auto-refresh ───
			function vgRefreshStatus() {
				if (!window.VIGENT_WOO) return;
				fetch(window.VIGENT_WOO.ajaxUrl + '?action=vigent_woo_status&nonce=' + window.VIGENT_WOO.nonce)
					.then(function(r) { return r.json(); })
					.then(function(data) {
						if (!data.success) return;
						var banner = document.getElementById('vg-live-status');
						if (!banner) return;
						var s = data.data;
						var cls = s.connected === true ? 'connected' : (s.connected === false ? 'disconnected' : 'unknown');
						var icon = s.connected === true ? 'dashicons dashicons-yes-alt' : (s.connected === false ? 'dashicons dashicons-warning' : 'dashicons dashicons-info');
						var msg = s.connected === true ? 'اتصال برقرار است' : (s.connected === false ? 'اتصال قطع است' : 'وضعیت نامشخص');
						var sub = s.last_check ? ('آخرین بررسی: ' + s.last_check) : 'هنوز بررسی نشده';
						if (s.connected === false && s.error) {
							sub += ' — ' + s.error.substring(0, 100);
						}
						banner.className = 'vg-live-status ' + cls;
						banner.innerHTML = '<span class="icon ' + icon + '"></span><div class="text"><strong>' + msg + '</strong><small>' + sub + '</small></div>';
					})
					.catch(function() {});
			}
			setInterval(vgRefreshStatus, 30000);
			document.addEventListener('DOMContentLoaded', vgRefreshStatus);

			// ─── Test connection ───
			function vgTestConnection(btn) {
				btn.disabled = true;
				var orig = btn.innerHTML;
				btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VIGENT_WOO.i18n.testing;
				fetch(window.VIGENT_WOO.ajaxUrl + '?action=vigent_woo_test&nonce=' + window.VIGENT_WOO.nonce)
					.then(function(r) { return r.json(); })
					.then(function(data) {
						if (data.success) {
							alert(data.data.message);
						} else {
							alert(data.data && data.data.message ? data.data.message : 'خطا در تست.');
						}
						vgRefreshStatus();
					})
					.catch(function() { alert('خطا در ارتباط.'); })
					.finally(function() {
						btn.disabled = false;
						btn.innerHTML = orig;
					});
			}

			// ─── Sync with progress bar ───
			var vgSyncRunning = false;
			function vgSync(kind, btn) {
				if (vgSyncRunning) return;
				vgSyncRunning = true;
				btn.disabled = true;
				var orig = btn.innerHTML;
				btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VIGENT_WOO.i18n.syncing;

				var progressWrap = document.getElementById('vg-progress');
				var progressBar = document.getElementById('vg-progress-bar');
				var progressText = document.getElementById('vg-progress-text');
				var progressInfo = document.getElementById('vg-progress-info');
				var progressErrors = document.getElementById('vg-progress-errors');
				var stopBtn = document.getElementById('vg-stop-btn');

				if (progressWrap) progressWrap.style.display = 'block';
				if (progressErrors) progressErrors.innerHTML = '';
				if (stopBtn) stopBtn.style.display = 'inline-flex';

				var offset = 0;
				var totalSent = 0;
				var allErrors = [];
				var shouldStop = false;
				if (stopBtn) stopBtn.onclick = function() { shouldStop = true; };

				function batch() {
					if (shouldStop) {
						finish();
						return;
					}
					var body = new FormData();
					body.append('action', 'vigent_woo_sync_batch');
					body.append('nonce', window.VIGENT_WOO.nonce);
					body.append('kind', kind);
					body.append('offset', offset);

					fetch(window.VIGENT_WOO.ajaxUrl, { method: 'POST', body: body })
						.then(function(r) { return r.json(); })
						.then(function(data) {
							if (!data.success) {
								if (progressErrors) progressErrors.innerHTML += '<div>' + (data.data && data.data.message ? data.data.message : 'خطا') + '</div>';
								finish();
								return;
							}
							var d = data.data;
							totalSent += d.sent;
							if (d.errors && d.errors.length) {
								allErrors = allErrors.concat(d.errors);
								if (progressErrors) progressErrors.innerHTML = allErrors.slice(0, 20).map(function(e) { return '<div>' + e + '</div>'; }).join('');
							}
							var pct = d.total > 0 ? Math.min(100, Math.round(((offset + 25) / d.total) * 100)) : 0;
							if (progressBar) progressBar.style.width = pct + '%';
							if (progressText) progressText.textContent = pct + '%';
							if (progressInfo) progressInfo.innerHTML = '<span>' + window.VIGENT_WOO.i18n.sent + ': ' + totalSent + ' / ' + d.total + '</span><span>' + window.VIGENT_WOO.i18n.errors + ': ' + allErrors.length + '</span>';

							if (d.done || shouldStop) {
								finish();
							} else {
								offset += 25;
								setTimeout(batch, 300);
							}
						})
						.catch(function() {
							finish();
						});
				}

				function finish() {
					vgSyncRunning = false;
					btn.disabled = false;
					btn.innerHTML = orig;
					if (stopBtn) stopBtn.style.display = 'none';
					if (progressBar) progressBar.style.width = '100%';
					if (progressText) progressText.textContent = '100%';
					if (progressInfo) progressInfo.innerHTML = '<span>' + window.VIGENT_WOO.i18n.done + ' — ' + window.VIGENT_WOO.i18n.sent + ': ' + totalSent + '</span><span>' + window.VIGENT_WOO.i18n.errors + ': ' + allErrors.length + '</span>';
				}

				batch();
			}

			// ─── Clear retry queue ───
			function vgClearRetry(btn) {
				if (!confirm('<?php echo esc_js( __( 'صف retry پاک شود؟', 'vigent-woo' ) ); ?>')) return;
				var body = new FormData();
				body.append('action', 'vigent_woo_clear_retry');
				body.append('nonce', window.VIGENT_WOO.nonce);
				fetch(window.VIGENT_WOO.ajaxUrl, { method: 'POST', body: body })
					.then(function(r) { return r.json(); })
					.then(function() { location.reload(); });
			}
		</script>
		<?php
	}

	// ─── Pages ───────────────────────────────────────────────────────────

	/**
	 * Page: Dashboard (main).
	 */
	public function render_dashboard_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
		}
		$core = $this->core();
		$settings = $core->get_settings();
		$status   = $core->get_connection_status();
		$has_wc   = $core->has_wc();
		?>
		<div class="wrap vg-wrap">
			<div class="vg-header">
				<div class="vg-logo">V</div>
				<div style="flex:1;">
					<h1><?php esc_html_e( 'ویجنت — داشبورد', 'vigent-woo' ); ?></h1>
					<p><?php esc_html_e( 'نمای کلی از وضعیت اتصال و همگام‌سازی سایت شما با ویجنت.', 'vigent-woo' ); ?></p>
				</div>
				<?php $this->render_status_badge( $status ); ?>
			</div>

			<?php $this->render_tabs( 'vigent-woo' ); ?>

			<?php $this->render_live_status( $status ); ?>

			<div class="vg-grid cols-4" style="margin-bottom: 20px;">
				<?php
				$this->render_stat_card( __( 'محصولات', 'vigent-woo' ), $has_wc ? $this->count_products() : '—', 'products' );
				$this->render_stat_card( __( 'سفارش‌ها', 'vigent-woo' ), $has_wc ? $this->count_orders() : '—', 'cart' );
				$this->render_stat_card( __( 'نوشته‌ها', 'vigent-woo' ), wp_count_posts( 'post' )->publish, 'media-document' );
				$this->render_stat_card( __( 'برگه‌ها', 'vigent-woo' ), wp_count_posts( 'page' )->publish, 'admin-page' );
				?>
			</div>

			<div class="vg-grid has-aside">
				<div>
					<div class="vg-card">
						<h2><span class="dashicons dashicons-admin-plugins"></span> <?php esc_html_e( 'وضعیت همگام‌سازی', 'vigent-woo' ); ?></h2>
						<p class="desc"><?php esc_html_e( 'اطلاعات لحظه‌ای از آخرین هم‌گام‌سازی‌ها و رویدادهای ارسالی به ویجنت.', 'vigent-woo' ); ?></p>

						<div class="vg-meta">
							<div class="vg-meta-item">
								<div class="k"><?php esc_html_e( 'محصولات همگام‌شده', 'vigent-woo' ); ?></div>
								<div class="v"><?php echo esc_html( $this->count_synced_products() ); ?></div>
							</div>
							<div class="vg-meta-item">
								<div class="k"><?php esc_html_e( 'سفارش‌های همگام‌شده', 'vigent-woo' ); ?></div>
								<div class="v"><?php echo esc_html( $has_wc ? $this->count_orders() : '—' ); ?></div>
							</div>
							<div class="vg-meta-item">
								<div class="k"><?php esc_html_e( 'در صف retry', 'vigent-woo' ); ?></div>
								<div class="v"><?php echo esc_html( count( $core->get_retry_queue() ) ); ?></div>
							</div>
							<div class="vg-meta-item">
								<div class="k"><?php esc_html_e( 'آخرین بررسی اتصال', 'vigent-woo' ); ?></div>
								<div class="v" style="font-size:11px;"><?php echo esc_html( $status['last_check'] ?: '—' ); ?></div>
							</div>
						</div>

						<div class="vg-buttons" style="margin-top: 20px;">
							<?php if ( $core->is_configured() ) : ?>
								<button class="vg-btn vg-btn-primary" onclick="vgTestConnection(this)">
									<span class="dashicons dashicons-admin-network"></span>
									<?php esc_html_e( 'تست اتصال', 'vigent-woo' ); ?>
								</button>
								<a class="vg-btn vg-btn-success" href="<?php echo esc_url( admin_url( 'admin.php?page=vigent-woo-sync' ) ); ?>">
									<span class="dashicons dashicons-update"></span>
									<?php esc_html_e( 'رفتن به هم‌گام‌سازی', 'vigent-woo' ); ?>
								</a>
							<?php else : ?>
								<a class="vg-btn vg-btn-primary" href="<?php echo esc_url( admin_url( 'admin.php?page=vigent-woo-settings' ) ); ?>">
									<span class="dashicons dashicons-admin-generic"></span>
									<?php esc_html_e( 'پیکربندی اتصال', 'vigent-woo' ); ?>
								</a>
							<?php endif; ?>
						</div>
					</div>
				</div>

				<aside>
					<div class="vg-card">
						<h2><span class="dashicons dashicons-info-outline"></span> <?php esc_html_e( 'اطلاعات سیستم', 'vigent-woo' ); ?></h2>
						<div class="vg-meta">
							<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'نسخه افزونه', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( VIGENT_WOO_VERSION ); ?></div></div>
							<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'ووکامرس', 'vigent-woo' ); ?></div><div class="v"><?php echo $has_wc ? esc_html__( 'فعال', 'vigent-woo' ) : esc_html__( 'غیرفعال', 'vigent-woo' ); ?></div></div>
							<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'PHP', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( PHP_VERSION ); ?></div></div>
							<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'وردپرس', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( get_bloginfo( 'version' ) ); ?></div></div>
						</div>
					</div>
				</aside>
			</div>
		</div>
		<?php
	}

	/**
	 * Page: Settings.
	 */
	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
		}
		$core     = $this->core();
		$settings = $core->get_settings();
		$has_wc   = $core->has_wc();
		$status   = $core->get_connection_status();
		?>
		<div class="wrap vg-wrap">
			<div class="vg-header">
				<div class="vg-logo">V</div>
				<div style="flex:1;">
					<h1><?php esc_html_e( 'تنظیمات اتصال', 'vigent-woo' ); ?></h1>
					<p><?php esc_html_e( 'پیکربندی ارتباط بین سایت وردپرسی و ایجنت ویجنت.', 'vigent-woo' ); ?></p>
				</div>
				<?php $this->render_status_badge( $status ); ?>
			</div>

			<?php $this->render_tabs( 'vigent-woo-settings' ); ?>
			<?php $this->render_live_status( $status ); ?>

			<div class="vg-grid has-aside">
				<div>
					<div class="vg-card">
						<h2><span class="dashicons dashicons-admin-plugins"></span> <?php esc_html_e( 'اطلاعات اتصال', 'vigent-woo' ); ?></h2>
						<p class="desc"><?php esc_html_e( 'این مقادیر را از پنل ویجنت (بخش محصولات یا یکپارچه‌سازی‌ها) کپی کنید.', 'vigent-woo' ); ?></p>

						<form method="post" action="options.php">
							<?php settings_fields( 'vigent_woo_settings_group' ); ?>
							<?php do_settings_sections( 'vigent-woo' ); ?>

							<div class="vg-form-row">
								<label for="vigent_woo_webhook_url"><?php esc_html_e( 'آدرس webhook ویجنت', 'vigent-woo' ); ?></label>
								<input type="url" id="vigent_woo_webhook_url" name="vigent_woo_settings[webhook_url]"
									value="<?php echo esc_attr( $settings['webhook_url'] ); ?>"
									placeholder="https://vigent.ir/api/sync/woocommerce?token=..." />
								<p class="hint"><?php esc_html_e( 'این آدرس را از پنل ویجنت کپی کنید. شامل token در انتهای URL است.', 'vigent-woo' ); ?></p>
							</div>

							<div class="vg-form-row">
								<label for="vigent_woo_webhook_secret"><?php esc_html_e( 'کلید امنیتی (webhook secret)', 'vigent-woo' ); ?></label>
								<input type="password" id="vigent_woo_webhook_secret" name="vigent_woo_settings[webhook_secret]"
									value="<?php echo esc_attr( $settings['webhook_secret'] ); ?>" autocomplete="off" />
								<p class="hint"><?php esc_html_e( 'همان کلیدی که در پنل ویجنت برای اتصال نمایش داده شده است.', 'vigent-woo' ); ?></p>
							</div>

							<div class="vg-buttons">
								<?php submit_button( __( 'ذخیره تنظیمات', 'vigent-woo' ), 'vg-btn vg-btn-primary', 'submit', false ); ?>
								<?php if ( $core->is_configured() ) : ?>
									<button type="button" class="vg-btn vg-btn-secondary" onclick="vgTestConnection(this)">
										<span class="dashicons dashicons-admin-network"></span>
										<?php esc_html_e( 'تست اتصال', 'vigent-woo' ); ?>
									</button>
								<?php endif; ?>
							</div>
						</form>
					</div>

					<div class="vg-card" style="margin-top: 20px;">
						<h2><span class="dashicons dashicons-admin-generic"></span> <?php esc_html_e( 'انتخاب داده‌های همگام‌شونده', 'vigent-woo' ); ?></h2>
						<p class="desc"><?php esc_html_e( 'تعیین کنید چه داده‌هایی از سایت شما به‌صورت خودکار به ویجنت ارسال شوند.', 'vigent-woo' ); ?></p>

						<form method="post" action="options.php">
							<?php settings_fields( 'vigent_woo_settings_group' ); ?>

							<label class="vg-checkbox-row">
								<input type="checkbox" name="vigent_woo_settings[sync_content]" value="1" <?php checked( $settings['sync_content'], '1' ); ?> />
								<div>
									<div class="label"><?php esc_html_e( 'هم‌گام‌سازی محتوا (نوشته‌ها و برگه‌ها)', 'vigent-woo' ); ?></div>
									<div class="sub"><?php esc_html_e( 'هنگام انتشار یا ویرایش نوشته و برگه، متن آن وارد پایگاه دانش ایجنت می‌شود.', 'vigent-woo' ); ?></div>
								</div>
							</label>

							<label class="vg-checkbox-row <?php echo $has_wc ? '' : 'disabled'; ?>">
								<input type="checkbox" name="vigent_woo_settings[sync_products]" value="1" <?php checked( $settings['sync_products'], '1' ); ?> <?php disabled( ! $has_wc ); ?> />
								<div>
									<div class="label"><?php esc_html_e( 'هم‌گام‌سازی محصولات', 'vigent-woo' ); ?> <?php echo $has_wc ? '' : '<span class="vg-status warn">' . esc_html__( 'نیاز به ووکامرس', 'vigent-woo' ) . '</span>'; ?></div>
									<div class="sub"><?php esc_html_e( 'هنگام ساخت، ویرایش یا حذف محصول، آن را به ویجنت بفرست.', 'vigent-woo' ); ?></div>
								</div>
							</label>

							<label class="vg-checkbox-row <?php echo $has_wc ? '' : 'disabled'; ?>">
								<input type="checkbox" name="vigent_woo_settings[sync_orders]" value="1" <?php checked( $settings['sync_orders'], '1' ); ?> <?php disabled( ! $has_wc ); ?> />
								<div>
									<div class="label"><?php esc_html_e( 'هم‌گام‌سازی سفارش‌ها', 'vigent-woo' ); ?> <?php echo $has_wc ? '' : '<span class="vg-status warn">' . esc_html__( 'نیاز به ووکامرس', 'vigent-woo' ) . '</span>'; ?></div>
									<div class="sub"><?php esc_html_e( 'هنگام تغییر وضعیت سفارش، آن را به ویجنت بفرست.', 'vigent-woo' ); ?></div>
								</div>
							</label>

							<?php if ( $has_wc ) : ?>
								<div class="vg-form-row" style="margin-top: 20px;">
									<label><?php esc_html_e( 'فیلتر محصولات برای هم‌گام‌سازی', 'vigent-woo' ); ?></label>
									<select name="vigent_woo_settings[product_filter]">
										<option value="all" <?php selected( $settings['product_filter'], 'all' ); ?>><?php esc_html_e( 'همه محصولات', 'vigent-woo' ); ?></option>
										<option value="published" <?php selected( $settings['product_filter'], 'published' ); ?>><?php esc_html_e( 'فقط محصولات منتشرشده', 'vigent-woo' ); ?></option>
										<option value="priced" <?php selected( $settings['product_filter'], 'priced' ); ?>><?php esc_html_e( 'فقط محصولات دارای قیمت', 'vigent-woo' ); ?></option>
										<option value="category" <?php selected( $settings['product_filter'], 'category' ); ?>><?php esc_html_e( 'فقط دسته‌بندی‌های انتخابی', 'vigent-woo' ); ?></option>
									</select>
									<p class="hint"><?php esc_html_e( 'با این فیلتر می‌توانید فقط محصولات خاصی را همگام کنید.', 'vigent-woo' ); ?></p>
								</div>

								<?php if ( 'category' === $settings['product_filter'] ) : ?>
									<?php
									$cats = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false ) );
									$selected_cats = ! empty( $settings['product_categories'] ) ? array_map( 'intval', (array) $settings['product_categories'] ) : array();
									if ( is_array( $cats ) && ! empty( $cats ) ) :
									?>
									<div class="vg-form-row">
										<label><?php esc_html_e( 'دسته‌بندی‌های انتخابی', 'vigent-woo' ); ?></label>
										<div style="max-height:200px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px; padding:8px;">
											<?php foreach ( $cats as $cat ) : ?>
												<label class="vg-checkbox-row" style="border:none; margin:0;">
													<input type="checkbox" name="vigent_woo_settings[product_categories][]" value="<?php echo esc_attr( $cat->term_id ); ?>" <?php checked( in_array( (int) $cat->term_id, $selected_cats, true ) ); ?> />
													<div class="label" style="font-size:12px;"><?php echo esc_html( $cat->name ); ?></div>
												</label>
											<?php endforeach; ?>
										</div>
									</div>
									<?php endif; ?>
								<?php endif; ?>
							<?php endif; ?>

							<label class="vg-checkbox-row">
								<input type="checkbox" name="vigent_woo_settings[enable_dashboard_widget]" value="1" <?php checked( $settings['enable_dashboard_widget'], '1' ); ?> />
								<div>
									<div class="label"><?php esc_html_e( 'نمایش ویجت در داشبورد اصلی وردپرس', 'vigent-woo' ); ?></div>
									<div class="sub"><?php esc_html_e( 'یک ویجت کوچک در داشبورد وردپرس اضافه می‌شود که وضعیت اتصال را نشان می‌دهد.', 'vigent-woo' ); ?></div>
								</div>
							</label>

							<label class="vg-checkbox-row">
								<input type="checkbox" name="vigent_woo_settings[enable_retry]" value="1" <?php checked( $settings['enable_retry'], '1' ); ?> />
								<div>
									<div class="label"><?php esc_html_e( 'سیستم Retry برای رویدادهای ناموفق', 'vigent-woo' ); ?></div>
									<div class="sub"><?php esc_html_e( 'اگر وب‌هوک ناموفق باشد، به‌صورت خودکار ۵ بار با فاصله‌های افزایشی دوباره تلاش می‌شود.', 'vigent-woo' ); ?></div>
								</div>
							</label>

							<?php submit_button( __( 'ذخیره', 'vigent-woo' ), 'vg-btn vg-btn-primary', 'submit', false ); ?>
						</form>
					</div>
				</div>

				<aside>
					<div class="vg-card">
						<h2><span class="dashicons dashicons-clipboard"></span> <?php esc_html_e( 'راه‌اندازی سریع', 'vigent-woo' ); ?></h2>
						<ol class="vg-steps">
							<li><strong><?php esc_html_e( 'در پنل ویجنت:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'یک اتصال ووکامرس بسازید.', 'vigent-woo' ); ?></li>
							<li><strong><?php esc_html_e( 'کپی مقادیر:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'آدرس webhook و کلید را کپی کنید.', 'vigent-woo' ); ?></li>
							<li><strong><?php esc_html_e( 'در این صفحه:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'مقادیر را جای‌گذاری و ذخیره کنید.', 'vigent-woo' ); ?></li>
							<li><strong><?php esc_html_e( 'تست اتصال:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'دکمهٔ تست اتصال را بزنید.', 'vigent-woo' ); ?></li>
							<li><strong><?php esc_html_e( 'هم‌گام‌سازی:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'به تب هم‌گام‌سازی بروید.', 'vigent-woo' ); ?></li>
						</ol>
					</div>
				</aside>
			</div>
		</div>
		<?php
	}

	/**
	 * Page: Sync (with progress bar).
	 */
	public function render_sync_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
		}
		$core = $this->core();
		$has_wc = $core->has_wc();
		$configured = $core->is_configured();
		$status   = $core->get_connection_status();
		?>
		<div class="wrap vg-wrap">
			<div class="vg-header">
				<div class="vg-logo">V</div>
				<div style="flex:1;">
					<h1><?php esc_html_e( 'هم‌گام‌سازی', 'vigent-woo' ); ?></h1>
					<p><?php esc_html_e( 'ارسال داده‌های سایت به ویجنت با نوار پیشرفت زنده.', 'vigent-woo' ); ?></p>
				</div>
				<?php $this->render_status_badge( $status ); ?>
			</div>

			<?php $this->render_tabs( 'vigent-woo-sync' ); ?>
			<?php $this->render_live_status( $status ); ?>

			<?php if ( ! $configured ) : ?>
				<div class="vg-notice warning">
					<span class="dashicons dashicons-warning"></span>
					<span><?php echo wp_kses_post( sprintf( __( 'ابتدا به <a href="%s">تنظیمات اتصال</a> بروید.', 'vigent-woo' ), esc_url( admin_url( 'admin.php?page=vigent-woo-settings' ) ) ) ); ?></span>
				</div>
			<?php else : ?>

				<div class="vg-card">
					<h2><span class="dashicons dashicons-update"></span> <?php esc_html_e( 'هم‌گام‌سازی کامل', 'vigent-woo' ); ?></h2>
					<p class="desc"><?php esc_html_e( 'برای ارسال یک‌بارهٔ همهٔ داده‌های فعلی سایت به ویجنت، از دکمه‌های زیر استفاده کنید. نوار پیشرفت به‌صورت زنده به‌روز می‌شود.', 'vigent-woo' ); ?></p>

					<div class="vg-buttons">
						<button class="vg-btn vg-btn-primary" onclick="vgSync('content', this)">
							<span class="dashicons dashicons-media-document"></span>
							<?php esc_html_e( 'ارسال همهٔ نوشته‌ها و برگه‌ها', 'vigent-woo' ); ?>
						</button>
						<?php if ( $has_wc ) : ?>
						<button class="vg-btn vg-btn-success" onclick="vgSync('products', this)">
							<span class="dashicons dashicons-products"></span>
							<?php esc_html_e( 'ارسال همهٔ محصولات', 'vigent-woo' ); ?>
						</button>
						<button class="vg-btn vg-btn-secondary" onclick="vgSync('orders', this)">
							<span class="dashicons dashicons-cart"></span>
							<?php esc_html_e( 'ارسال همهٔ سفارش‌ها', 'vigent-woo' ); ?>
						</button>
						<?php endif; ?>
						<button id="vg-stop-btn" class="vg-btn vg-btn-danger" style="display:none;">
							<span class="dashicons dashicons-no-alt"></span>
							<?php esc_html_e( 'توقف', 'vigent-woo' ); ?>
						</button>
					</div>

					<div id="vg-progress" class="vg-progress" style="display:none;">
						<div class="vg-progress-bar-wrap">
							<div id="vg-progress-bar" class="vg-progress-bar"></div>
							<div id="vg-progress-text" class="vg-progress-text">0%</div>
						</div>
						<div id="vg-progress-info" class="vg-progress-info">
							<span><?php esc_html_e( 'در حال آماده‌سازی…', 'vigent-woo' ); ?></span>
							<span></span>
						</div>
						<div id="vg-progress-errors" class="vg-progress-errors" style="display:none;"></div>
					</div>
				</div>

				<?php $this->render_retry_queue_card(); ?>

				<div class="vg-card" style="margin-top: 20px;">
					<h2><span class="dashicons dashicons-list-view"></span> <?php esc_html_e( 'چک‌لیست هم‌گام‌سازی', 'vigent-woo' ); ?></h2>
					<ul class="vg-help-list">
						<li><strong><?php esc_html_e( 'محصولات:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'نام، SKU، توضیحات، قیمت، موجودی، تصاویر، ویژگی‌ها و برچسب‌ها.', 'vigent-woo' ); ?></li>
						<li><strong><?php esc_html_e( 'سفارش‌ها:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'شماره، وضعیت، مبلغ، روش پرداخت، اطلاعات صورت‌حساب و آیتم‌های سفارش.', 'vigent-woo' ); ?></li>
						<li><strong><?php esc_html_e( 'محتوا:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'نوشته‌ها و برگه‌های منتشرشده به‌همراه عنوان، خلاصه، متن کامل و آدرس URL.', 'vigent-woo' ); ?></li>
						<li><strong><?php esc_html_e( 'پس از هم‌گام‌سازی:', 'vigent-woo' ); ?></strong> <?php esc_html_e( 'به پنل ویجنت (بخش محصولات) بروید و لیست به‌روزرسانی‌شده را ببینید.', 'vigent-woo' ); ?></li>
					</ul>
				</div>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Page: Stats.
	 */
	public function render_stats_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
		}
		$core    = $this->core();
		$has_wc  = $core->has_wc();
		$status  = $core->get_connection_status();
		?>
		<div class="wrap vg-wrap">
			<div class="vg-header">
				<div class="vg-logo">V</div>
				<div style="flex:1;">
					<h1><?php esc_html_e( 'آمار سایت', 'vigent-woo' ); ?></h1>
					<p><?php esc_html_e( 'نمای کلی از داده‌های سایت شما و وضعیت همگام‌سازی با ویجنت.', 'vigent-woo' ); ?></p>
				</div>
				<?php $this->render_status_badge( $status ); ?>
			</div>

			<?php $this->render_tabs( 'vigent-woo-stats' ); ?>
			<?php $this->render_live_status( $status ); ?>

			<?php
			// آمار ۷ روز اخیر.
			$daily_products = $this->get_daily_product_counts( 7 );
			$daily_orders   = $has_wc ? $this->get_daily_order_counts( 7 ) : array();
			?>

			<div class="vg-grid cols-4" style="margin-bottom: 20px;">
				<?php
				$this->render_stat_card( __( 'کل محصولات', 'vigent-woo' ), $has_wc ? $this->count_products() : '—', 'products' );
				$this->render_stat_card( __( 'محصولات منتشرشده', 'vigent-woo' ), $has_wc ? $this->count_products( 'publish' ) : '—', 'visibility' );
				$this->render_stat_card( __( 'محصولات با قیمت', 'vigent-woo' ), $has_wc ? $this->count_priced_products() : '—', 'tag' );
				$this->render_stat_card( __( 'موجودی کل', 'vigent-woo' ), $has_wc ? $this->count_total_stock() : '—', 'inventory' );
				?>
			</div>

			<div class="vg-grid cols-2">
				<div class="vg-card">
					<h2><span class="dashicons dashicons-chart-bar"></span> <?php esc_html_e( 'محصولات ۷ روز اخیر', 'vigent-woo' ); ?></h2>
					<p class="desc"><?php esc_html_e( 'تعداد محصولاتی که در ۷ روز گذشته ساخته شده‌اند.', 'vigent-woo' ); ?></p>
					<?php $this->render_mini_chart( $daily_products ); ?>
				</div>

				<?php if ( $has_wc ) : ?>
				<div class="vg-card">
					<h2><span class="dashicons dashicons-chart-bar"></span> <?php esc_html_e( 'سفارش‌های ۷ روز اخیر', 'vigent-woo' ); ?></h2>
					<p class="desc"><?php esc_html_e( 'تعداد سفارش‌های ثبت‌شده در ۷ روز گذشته.', 'vigent-woo' ); ?></p>
					<?php $this->render_mini_chart( $daily_orders ); ?>
				</div>
				<?php endif; ?>
			</div>

			<?php if ( $has_wc ) : ?>
				<div class="vg-card" style="margin-top: 20px;">
					<h2><span class="dashicons dashicons-chart-pie"></span> <?php esc_html_e( 'وضعیت سفارش‌ها', 'vigent-woo' ); ?></h2>
					<p class="desc"><?php esc_html_e( 'تفکیک سفارش‌ها بر اساس وضعیت.', 'vigent-woo' ); ?></p>
					<?php $this->render_order_status_breakdown(); ?>
				</div>
			<?php endif; ?>

			<div class="vg-card" style="margin-top: 20px;">
				<h2><span class="dashicons dashicons-list-view"></span> <?php esc_html_e( 'آمار محتوا', 'vigent-woo' ); ?></h2>
				<div class="vg-meta">
					<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'نوشته‌های منتشرشده', 'vigent-woo' ); ?></div><div class="v big"><?php echo esc_html( wp_count_posts( 'post' )->publish ); ?></div></div>
					<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'برگه‌های منتشرشده', 'vigent-woo' ); ?></div><div class="v big"><?php echo esc_html( wp_count_posts( 'page' )->publish ); ?></div></div>
					<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'نظرات تأییدشده', 'vigent-woo' ); ?></div><div class="v big"><?php echo esc_html( wp_count_comments()->approved ); ?></div></div>
					<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'کاربران', 'vigent-woo' ); ?></div><div class="v big"><?php echo esc_html( count_users()['total_users'] ); ?></div></div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Page: Tools.
	 */
	public function render_tools_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
		}
		$core = $this->core();
		$status = $core->get_connection_status();
		?>
		<div class="wrap vg-wrap">
			<div class="vg-header">
				<div class="vg-logo">V</div>
				<div style="flex:1;">
					<h1><?php esc_html_e( 'ابزارها', 'vigent-woo' ); ?></h1>
					<p><?php esc_html_e( 'ابزارهای تست، عیب‌یابی و مدیریت.', 'vigent-woo' ); ?></p>
				</div>
				<?php $this->render_status_badge( $status ); ?>
			</div>

			<?php $this->render_tabs( 'vigent-woo-tools' ); ?>

			<div class="vg-grid cols-2">
				<div class="vg-card">
					<h2><span class="dashicons dashicons-admin-network"></span> <?php esc_html_e( 'تست اتصال', 'vigent-woo' ); ?></h2>
					<p class="desc"><?php esc_html_e( 'بررسی برقراری ارتباط بین سایت و ویجنت.', 'vigent-woo' ); ?></p>
					<button class="vg-btn vg-btn-primary" onclick="vgTestConnection(this)">
						<span class="dashicons dashicons-admin-network"></span>
						<?php esc_html_e( 'تست اتصال', 'vigent-woo' ); ?>
					</button>
				</div>

				<div class="vg-card">
					<h2><span class="dashicons dashicons-database"></span> <?php esc_html_e( 'پاک‌سازی داده‌ها', 'vigent-woo' ); ?></h2>
					<p class="desc"><?php esc_html_e( 'پاک‌سازی transient های کش و صف retry.', 'vigent-woo' ); ?></p>
					<div class="vg-buttons">
						<a class="vg-btn vg-btn-secondary" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin.php?page=vigent-woo-tools&clear=cache' ), 'vigent_woo_clear' ) ); ?>">
							<span class="dashicons dashicons-trash"></span>
							<?php esc_html_e( 'پاک‌سازی کش', 'vigent-woo' ); ?>
						</a>
						<button class="vg-btn vg-btn-secondary" onclick="vgClearRetry(this)">
							<span class="dashicons dashicons-trash"></span>
							<?php esc_html_e( 'پاک‌سازی صف Retry', 'vigent-woo' ); ?>
						</button>
					</div>
				</div>

				<div class="vg-card">
					<h2><span class="dashicons dashicons-info-outline"></span> <?php esc_html_e( 'اطلاعات سیستم', 'vigent-woo' ); ?></h2>
					<div class="vg-meta">
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'نسخه افزونه', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( VIGENT_WOO_VERSION ); ?></div></div>
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'وردپرس', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( get_bloginfo( 'version' ) ); ?></div></div>
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'PHP', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( PHP_VERSION ); ?></div></div>
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'ووکامرس', 'vigent-woo' ); ?></div><div class="v"><?php echo $core->has_wc() ? esc_html( WC()->version ) : '—'; ?></div></div>
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'HPOS', 'vigent-woo' ); ?></div><div class="v"><?php echo $this->is_hpos_enabled() ? esc_html__( 'فعال', 'vigent-woo' ) : esc_html__( 'غیرفعال', 'vigent-woo' ); ?></div></div>
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'Memory Limit', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( ini_get( 'memory_limit' ) ); ?></div></div>
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'Max Execution Time', 'vigent-woo' ); ?></div><div class="v"><?php echo esc_html( ini_get( 'max_execution_time' ) ); ?>s</div></div>
						<div class="vg-meta-item"><div class="k"><?php esc_html_e( 'WP-Cron', 'vigent-woo' ); ?></div><div class="v"><?php echo defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON ? esc_html__( 'خاموش', 'vigent-woo' ) : esc_html__( 'روشن', 'vigent-woo' ); ?></div></div>
					</div>
				</div>

				<div class="vg-card">
					<h2><span class="dashicons dashicons-terminal"></span> <?php esc_html_e( 'WP-CLI', 'vigent-woo' ); ?></h2>
					<p class="desc"><?php esc_html_e( 'اگر به سرور دسترسی دارید، می‌توانید از WP-CLI استفاده کنید:', 'vigent-woo' ); ?></p>
					<div class="vg-copy-row"><code>wp vigent status</code><button type="button" onclick="vgCopy(this)">کپی</button></div>
					<div class="vg-copy-row"><code>wp vigent test-connection</code><button type="button" onclick="vgCopy(this)">کپی</button></div>
					<div class="vg-copy-row"><code>wp vigent sync products</code><button type="button" onclick="vgCopy(this)">کپی</button></div>
					<div class="vg-copy-row"><code>wp vigent sync orders</code><button type="button" onclick="vgCopy(this)">کپی</button></div>
					<div class="vg-copy-row"><code>wp vigent sync content</code><button type="button" onclick="vgCopy(this)">کپی</button></div>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Page: Help.
	 */
	public function render_help_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
		}
		?>
		<div class="wrap vg-wrap">
			<div class="vg-header">
				<div class="vg-logo">V</div>
				<div style="flex:1;">
					<h1><?php esc_html_e( 'راهنما', 'vigent-woo' ); ?></h1>
					<p><?php esc_html_e( 'راهنمای کامل نصب و راه‌اندازی.', 'vigent-woo' ); ?></p>
				</div>
			</div>

			<?php $this->render_tabs( 'vigent-woo-help' ); ?>

			<div class="vg-card">
				<h2><span class="dashicons dashicons-sos"></span> <?php esc_html_e( 'مراحل نصب و راه‌اندازی', 'vigent-woo' ); ?></h2>
				<ol class="vg-steps">
					<li><strong><?php esc_html_e( 'ساخت اتصال در پنل ویجنت:', 'vigent-woo' ); ?></strong><br><?php esc_html_e( 'به پنل ویجنت بروید و یک اتصال ووکامرس بسازید. ویجنت به‌صورت خودکار لینک و کلید تولید می‌کند.', 'vigent-woo' ); ?></li>
					<li><strong><?php esc_html_e( 'جای‌گذاری در افزونه:', 'vigent-woo' ); ?></strong><br><?php esc_html_e( 'به «ویجنت ← تنظیمات اتصال» بروید، آدرس و کلید را جای‌گذاری و ذخیره کنید.', 'vigent-woo' ); ?></li>
					<li><strong><?php esc_html_e( 'تست اتصال:', 'vigent-woo' ); ?></strong><br><?php esc_html_e( 'دکمهٔ «تست اتصال» را بزنید. وضعیت اتصال به‌صورت زنده نمایش داده می‌شود.', 'vigent-woo' ); ?></li>
					<li><strong><?php esc_html_e( 'هم‌گام‌سازی اولیه:', 'vigent-woo' ); ?></strong><br><?php esc_html_e( 'به تب «هم‌گام‌سازی» بروید و دکمه‌های مورد نظر را بزنید. نوار پیشرفت به‌صورت زنده به‌روز می‌شود.', 'vigent-woo' ); ?></li>
				</ol>
			</div>

			<div class="vg-card" style="margin-top: 20px;">
				<h2><span class="dashicons dashicons-lightbulb"></span> <?php esc_html_e( 'سوالات متداول', 'vigent-woo' ); ?></h2>
				<ul class="vg-help-list">
					<li>
						<strong><?php esc_html_e( 'آیا بدون ووکامرس هم کار می‌کند؟', 'vigent-woo' ); ?></strong>
						<?php esc_html_e( 'بله. هم‌گام‌سازی محتوا روی هر سایت وردپرسی کار می‌کند.', 'vigent-woo' ); ?>
					</li>
					<li>
						<strong><?php esc_html_e( 'خطای Fatal: get_billing()؟', 'vigent-woo' ); ?></strong>
						<?php esc_html_e( 'این خطا در نسخه‌های ۲.۰.۰ و بالاتر رفع شده است. افزونه را به‌روز کنید.', 'vigent-woo' ); ?>
					</li>
					<li>
						<strong><?php esc_html_e( 'خطای ۴۰۱ در پنل ویجنت؟', 'vigent-woo' ); ?></strong>
						<?php esc_html_e( 'به‌دلیل اشتباه بودن Consumer Key/Secret است. کلیدها را در ووکامرس دوباره بسازید یا حالت webhook-only استفاده کنید.', 'vigent-woo' ); ?>
					</li>
					<li>
						<strong><?php esc_html_e( 'هیچ لاگی در پنل نیست؟', 'vigent-woo' ); ?></strong>
						<?php esc_html_e( 'پس از «تست اتصال»، یک ردیف لاگ باید فوراً ظاهر شود. اگر نشد، آدرس webhook اشتباه است یا هاست outgoing را بسته است.', 'vigent-woo' ); ?>
					</li>
				</ul>
			</div>
		</div>
		<?php
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	private function render_tabs( $active ) {
		$tabs = array(
			'vigent-woo'         => __( 'داشبورد', 'vigent-woo' ),
			'vigent-woo-settings' => __( 'تنظیمات اتصال', 'vigent-woo' ),
			'vigent-woo-sync'    => __( 'هم‌گام‌سازی', 'vigent-woo' ),
			'vigent-woo-stats'   => __( 'آمار سایت', 'vigent-woo' ),
			'vigent-woo-tools'   => __( 'ابزارها', 'vigent-woo' ),
			'vigent-woo-help'    => __( 'راهنما', 'vigent-woo' ),
		);
		echo '<div class="vg-tabs">';
		foreach ( $tabs as $slug => $label ) {
			$cls = $slug === $active ? 'vg-tab active' : 'vg-tab';
			printf( '<a class="%s" href="%s">%s</a>', esc_attr( $cls ), esc_url( admin_url( 'admin.php?page=' . $slug ) ), esc_html( $label ) );
		}
		echo '</div>';
	}

	private function render_status_badge( $status ) {
		$connected = $status['connected'];
		if ( true === $connected ) {
			echo '<span class="vg-status ok"><span class="dot"></span> ' . esc_html__( 'متصل', 'vigent-woo' ) . '</span>';
		} elseif ( false === $connected ) {
			echo '<span class="vg-status err"><span class="dot"></span> ' . esc_html__( 'قطع', 'vigent-woo' ) . '</span>';
		} else {
			echo '<span class="vg-status unknown"><span class="dot"></span> ' . esc_html__( 'نامشخص', 'vigent-woo' ) . '</span>';
		}
	}

	private function render_live_status( $status ) {
		$connected = $status['connected'];
		$cls = true === $connected ? 'connected' : ( false === $connected ? 'disconnected' : 'unknown' );
		$icon = true === $connected ? 'dashicons dashicons-yes-alt' : ( false === $connected ? 'dashicons dashicons-warning' : 'dashicons dashicons-info' );
		$msg = true === $connected ? __( 'اتصال برقرار است', 'vigent-woo' ) : ( false === $connected ? __( 'اتصال قطع است', 'vigent-woo' ) : __( 'وضعیت نامشخص', 'vigent-woo' ) );
		$sub = $status['last_check'] ? sprintf( __( 'آخرین بررسی: %s', 'vigent-woo' ), $status['last_check'] ) : __( 'هنوز بررسی نشده', 'vigent-woo' );
		if ( false === $connected && $status['error'] ) {
			$sub .= ' — ' . substr( $status['error'], 0, 100 );
		}
		printf(
			'<div id="vg-live-status" class="vg-live-status %s"><span class="icon %s"></span><div class="text"><strong>%s</strong><small>%s</small></div></div>',
			esc_attr( $cls ),
			esc_attr( $icon ),
			esc_html( $msg ),
			esc_html( $sub )
		);
	}

	private function render_stat_card( $label, $value, $icon ) {
		printf(
			'<div class="vg-stat-card"><div class="icon"><span class="dashicons dashicons-%s"></span></div><div class="num">%s</div><div class="lbl">%s</div></div>',
			esc_attr( $icon ),
			esc_html( $value ),
			esc_html( $label )
		);
	}

	private function render_mini_chart( $data ) {
		if ( empty( $data ) ) {
			echo '<p style="font-size:12px; color:#9ca3af; text-align:center; padding:20px 0;">' . esc_html__( 'داده‌ای موجود نیست', 'vigent-woo' ) . '</p>';
			return;
		}
		$max = max( $data ) ?: 1;
		echo '<div class="vg-mini-chart">';
		foreach ( $data as $v ) {
			$h = $v > 0 ? max( 4, ( $v / $max ) * 80 ) : 2;
			printf( '<div class="bar" style="height:%dpx;" title="%d"></div>', (int) $h, (int) $v );
		}
		echo '</div>';
	}

	private function render_order_status_breakdown() {
		if ( ! $this->core()->has_wc() ) {
			return;
		}
		$statuses = wc_get_order_statuses();
		echo '<div class="vg-meta">';
		foreach ( $statuses as $key => $label ) {
			$count = wc_orders_count( str_replace( 'wc-', '', $key ) );
			if ( $count > 0 ) {
				printf(
					'<div class="vg-meta-item"><div class="k">%s</div><div class="v">%d</div></div>',
					esc_html( $label ),
					(int) $count
				);
			}
		}
		echo '</div>';
	}

	private function render_retry_queue_card() {
		$queue = $this->core()->get_retry_queue();
		if ( empty( $queue ) ) {
			return;
		}
		echo '<div class="vg-card" style="margin-top:20px;">';
		echo '<h2><span class="dashicons dashicons-backup"></span> ' . esc_html__( 'صف Retry', 'vigent-woo' ) . '</h2>';
		echo '<p class="desc">' . esc_html__( 'رویدادهای ناموفق که به‌صورت خودکار دوباره ارسال می‌شوند.', 'vigent-woo' ) . '</p>';
		echo '<div class="vg-retry-list"><table>';
		echo '<thead><tr><th>' . esc_html__( 'موضوع', 'vigent-woo' ) . '</th><th>' . esc_html__( 'تلاش', 'vigent-woo' ) . '</th><th>' . esc_html__( 'خطا', 'vigent-woo' ) . '</th><th>' . esc_html__( 'تاریخ', 'vigent-woo' ) . '</th></tr></thead>';
		echo '<tbody>';
		foreach ( array_slice( $queue, 0, 50 ) as $item ) {
			printf(
				'<tr><td>%s</td><td>%d / 5</td><td style="max-width:300px; overflow:hidden; text-overflow:ellipsis;">%s</td><td>%s</td></tr>',
				esc_html( $item['topic'] ),
				(int) $item['attempts'],
				esc_html( substr( $item['error'], 0, 100 ) ),
				esc_html( $item['created_at'] )
			);
		}
		echo '</tbody></table></div>';
		echo '<div class="vg-buttons" style="margin-top:12px;"><button class="vg-btn vg-btn-danger" onclick="vgClearRetry(this)"><span class="dashicons dashicons-trash"></span> ' . esc_html__( 'پاک‌سازی صف', 'vigent-woo' ) . '</button></div>';
		echo '</div>';
	}

	private function count_products( $status = null ) {
		if ( ! $this->core()->has_wc() ) return 0;
		$args = array( 'limit' => -1, 'return' => 'ids' );
		if ( $status ) $args['status'] = $status;
		$ids = wc_get_products( $args );
		return is_array( $ids ) ? count( $ids ) : 0;
	}

	private function count_priced_products() {
		if ( ! $this->core()->has_wc() ) return 0;
		$ids = wc_get_products( array( 'limit' => -1, 'return' => 'ids', 'status' => 'publish' ) );
		$count = 0;
		foreach ( $ids as $pid ) {
			$p = wc_get_product( $pid );
			if ( $p && $p->get_price() !== '' && (float) $p->get_price() > 0 ) {
				$count++;
			}
		}
		return $count;
	}

	private function count_total_stock() {
		if ( ! $this->core()->has_wc() ) return 0;
		$ids = wc_get_products( array( 'limit' => -1, 'return' => 'ids', 'status' => 'publish' ) );
		$total = 0;
		foreach ( $ids as $pid ) {
			$p = wc_get_product( $pid );
			if ( $p && $p->get_manage_stock() && is_numeric( $p->get_stock_quantity() ) ) {
				$total += (int) $p->get_stock_quantity();
			}
		}
		return $total;
	}

	private function count_orders() {
		if ( ! $this->core()->has_wc() ) return 0;
		return wc_orders_count( 'shop_order' );
	}

	private function count_synced_products() {
		// We don't track this in WP — approximate by total products.
		return $this->count_products();
	}

	private function get_daily_product_counts( $days ) {
		global $wpdb;
		$out = array();
		for ( $i = $days - 1; $i >= 0; $i-- ) {
			$date = gmdate( 'Y-m-d', strtotime( "-$i days" ) );
			$count = (int) $wpdb->get_var( $wpdb->prepare(
				"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish' AND post_date LIKE %s",
				$date . '%'
			) );
			$out[] = $count;
		}
		return $out;
	}

	private function get_daily_order_counts( $days ) {
		if ( ! $this->core()->has_wc() ) return array_fill( 0, $days, 0 );
		$out = array();
		for ( $i = $days - 1; $i >= 0; $i-- ) {
			$date = gmdate( 'Y-m-d', strtotime( "-$i days" ) );
			// Use wc_get_orders for HPOS compat.
			$orders = wc_get_orders( array(
				'date_created' => $date . '...' . $date . ' 23:59:59',
				'limit'        => -1,
				'return'       => 'ids',
			) );
			$out[] = is_array( $orders ) ? count( $orders ) : 0;
		}
		return $out;
	}

	private function is_hpos_enabled() {
		if ( ! $this->core()->has_wc() ) return false;
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		}
		return false;
	}

	// ─── Settings registration ──────────────────────────────────────────

	public function register_settings() {
		register_setting(
			'vigent_woo_settings_group',
			VIGENT_WOO_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize_settings' ),
				'default'           => array(),
			)
		);
	}

	public function sanitize_settings( $input ) {
		$out = array(
			'webhook_url'             => '',
			'webhook_secret'          => '',
			'sync_products'           => '',
			'sync_orders'             => '',
			'sync_content'            => '',
			'product_filter'          => 'all',
			'product_categories'      => array(),
			'exclude_product_ids'     => array(),
			'enable_dashboard_widget' => '',
			'enable_retry'            => '',
		);
		if ( isset( $input['webhook_url'] ) ) {
			$out['webhook_url'] = esc_url_raw( $input['webhook_url'] );
		}
		if ( isset( $input['webhook_secret'] ) ) {
			$out['webhook_secret'] = sanitize_text_field( $input['webhook_secret'] );
		}
		if ( isset( $input['sync_products'] ) ) $out['sync_products'] = $input['sync_products'] ? '1' : '';
		if ( isset( $input['sync_orders'] ) ) $out['sync_orders'] = $input['sync_orders'] ? '1' : '';
		if ( isset( $input['sync_content'] ) ) $out['sync_content'] = $input['sync_content'] ? '1' : '';
		if ( isset( $input['product_filter'] ) ) $out['product_filter'] = sanitize_text_field( $input['product_filter'] );
		if ( isset( $input['product_categories'] ) ) $out['product_categories'] = array_map( 'intval', (array) $input['product_categories'] );
		if ( isset( $input['enable_dashboard_widget'] ) ) $out['enable_dashboard_widget'] = $input['enable_dashboard_widget'] ? '1' : '';
		if ( isset( $input['enable_retry'] ) ) $out['enable_retry'] = $input['enable_retry'] ? '1' : '';
		return $out;
	}
}
