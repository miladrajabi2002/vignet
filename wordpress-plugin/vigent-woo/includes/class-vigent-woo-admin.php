<?php
/**
 * Admin class — single tab, auto-connect button, minimal black/white UI.
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

			/* Header — black, minimal, matches the site's spatial-surface cards */
			.vg-header { display: flex; align-items: center; gap: 14px; padding: 20px 24px; background: #000; border-radius: 16px; color: #fff; margin-bottom: 20px; }
			.vg-logo { width: 40px; height: 40px; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
			.vg-logo svg { width: 24px; height: 24px; }
			.vg-header h1 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
			.vg-header .sub { margin: 3px 0 0; font-size: 12px; opacity: .6; }
			.vg-header .pill { padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600; }
			.vg-header .pill.ok { background: rgba(16, 185, 129, .2); color: #6ee7b7; }
			.vg-header .pill.warn { background: rgba(245, 158, 11, .2); color: #fcd34d; }
			.vg-header .pill.err { background: rgba(239, 68, 68, .2); color: #fca5a5; }

			/* Card — white, soft border, matches spatial-surface */
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

			/* Buttons — black/white, min-h like the site */
			.vg-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
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

			/* Stats */
			.vg-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
			.vg-stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; text-align: center; }
			.vg-stat .num { font-size: 26px; font-weight: 800; color: #000; line-height: 1; }
			.vg-stat .lbl { font-size: 11px; color: #9ca3af; margin-top: 5px; }

			/* Filter */
			.vg-filter { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-bottom: 16px; padding: 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f3f4f6; }
			.vg-filter .vg-field { margin-bottom: 0; flex: 1; min-width: 180px; }

			/* Logs */
			.vg-logs { max-height: 240px; overflow-y: auto; border: 1px solid #f3f4f6; border-radius: 10px; }
			.vg-log-row { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid #f9fafb; font-size: 12px; }
			.vg-log-row:last-child { border-bottom: none; }
			.vg-log-row .ico { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
			.vg-log-row .ico.ok { background: #10b981; }
			.vg-log-row .ico.err { background: #ef4444; }
			.vg-log-row .entity { color: #374151; font-weight: 500; }
			.vg-log-row .count { color: #9ca3af; }
			.vg-log-row .date { margin-left: auto; color: #9ca3af; font-size: 11px; }

			/* Steps — flexbox, no overlap */
			.vg-steps { list-style: none; padding: 0; margin: 12px 0 0; }
			.vg-steps li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; font-size: 13px; color: #374151; line-height: 1.6; }
			.vg-steps li .num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: #000; color: #fff; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; margin-top: 1px; }
			.vg-steps li .txt { flex: 1; }
			.vg-steps li .txt strong { color: #111; display: block; margin-bottom: 2px; font-size: 13px; }

			/* Spinner */
			.vg-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: vg-spin .6s linear infinite; }
			@keyframes vg-spin { to { transform: rotate(360deg); } }

			/* Info banner */
			.vg-info { display: flex; gap: 10px; padding: 12px 14px; border-radius: 10px; background: #f0f9ff; border: 1px solid #bae6fd; color: #075985; font-size: 12px; line-height: 1.6; margin-bottom: 16px; }
			.vg-info .ico { flex-shrink: 0; font-size: 16px; line-height: 1.4; }
		</style>
		<?php
	}

	private function output_inline_scripts() {
		$ajax_url = admin_url( 'admin-ajax.php' );
		$nonce    = wp_create_nonce( VIGENT_WOO_NONCE );
		?>
		<script>
			window.VG = {
				ajaxUrl: '<?php echo esc_js( $ajax_url ); ?>',
				nonce: '<?php echo esc_js( $nonce ); ?>',
				configured: <?php echo $this->core()->is_configured() ? 'true' : 'false'; ?>,
				i18n: {
					connecting: '<?php echo esc_js( __( 'در حال اتصال…', 'vigent-woo' ) ); ?>',
					syncing: '<?php echo esc_js( __( 'در حال هم‌گام‌سازی…', 'vigent-woo' ) ); ?>',
					done: '<?php echo esc_js( __( 'تکمیل شد', 'vigent-woo' ) ); ?>',
				},
			};

			// Connect to Vigent — auto-fetches webhook URL + secret from the panel.
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
							alert(data.data.message);
							location.reload(); // reload to show the sync UI
						} else {
							alert(data.data && data.data.message ? data.data.message : '<?php echo esc_js( __( 'خطا در اتصال.', 'vigent-woo' ) ); ?>');
							btn.disabled = false;
							btn.innerHTML = orig;
						}
					})
					.catch(function() { alert('<?php echo esc_js( __( 'خطا در ارتباط.', 'vigent-woo' ) ); ?>'); btn.disabled = false; btn.innerHTML = orig; });
			}

			// Sync with progress bar.
			var vgRunning = false;
			function vgSync(kind, btn) {
				if (vgRunning) return;
				vgRunning = true;
				btn.disabled = true;
				var orig = btn.innerHTML;
				btn.innerHTML = '<span class="vg-spinner"></span> ' + window.VG.i18n.syncing;

				var pBar = document.getElementById('vg-pbar');
				var pText = document.getElementById('vg-ptext');
				var pInfo = document.getElementById('vg-pinfo');

				if (pBar) { pBar.style.width = '0%'; pText.textContent = '0%'; }
				document.getElementById('vg-progress').style.display = 'block';

				var filter = {};
				var catSel = document.getElementById('filter-category');
				var statSel = document.getElementById('filter-status');
				if (catSel && catSel.value) filter.category = catSel.value;
				if (statSel && statSel.value) filter.status = statSel.value;

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
							if (d.done) { finish(); } else { offset += 25; setTimeout(batch, 200); }
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
					setTimeout(function() { location.reload(); }, 1500);
				}

				batch();
			}

			// Save toggles.
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
		</script>
		<?php
	}

	// ─── Page ────────────────────────────────────────────────────────────

	public function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'دسترسی غیرمجاز.', 'vigent-woo' ) );
		}
		$core     = $this->core();
		$settings = $core->get_settings();
		$status   = $core->get_connection_status();
		$has_wc   = $core->has_wc();
		$configured = $core->is_configured();
		?>
		<div class="wrap vg-wrap">
			<div class="vg-header">
				<div class="vg-logo">
					<svg viewBox="0 0 20 20"><path d="M5 6l5 8 5-8" stroke="#000" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</div>
				<div style="flex:1;">
					<h1><?php esc_html_e( 'ویجنت', 'vigent-woo' ); ?></h1>
					<p class="sub"><?php esc_html_e( 'اتصال سایت به ایجنت هوشمند ویجنت', 'vigent-woo' ); ?></p>
				</div>
				<?php
				if ( ! $configured ) {
					echo '<span class="pill warn">' . esc_html__( 'پیکربندی نشده', 'vigent-woo' ) . '</span>';
				} elseif ( true === $status['connected'] ) {
					echo '<span class="pill ok">' . esc_html__( 'متصل', 'vigent-woo' ) . '</span>';
				} elseif ( false === $status['connected'] ) {
					echo '<span class="pill err">' . esc_html__( 'قطع', 'vigent-woo' ) . '</span>';
				} else {
					echo '<span class="pill warn">' . esc_html__( 'در انتظار', 'vigent-woo' ) . '</span>';
				}
				?>
			</div>

			<?php if ( ! $configured ) : ?>
				<?php $this->render_connect_step( $has_wc ); ?>
			<?php else : ?>
				<?php $this->render_connected_view( $core, $settings, $status, $has_wc ); ?>
			<?php endif; ?>
		</div>
		<?php
	}

	// ─── Step 1: Connect ─────────────────────────────────────────────────

	private function render_connect_step( $has_wc ) {
		?>
		<div class="vg-card">
			<h2><?php esc_html_e( 'اتصال به ویجنت', 'vigent-woo' ); ?></h2>
			<p><?php esc_html_e( 'برای شروع، ابتدا در پنل ویجنت یک اتصال سایت (وردپرس/ووکامرس) بسازید و آدرس سایت خود را وارد کنید. سپس دکمه «اتصال» را اینجا بزنید — ویجنت خودکار لینک و کلید را در اینجا ثبت می‌کند.', 'vigent-woo' ); ?></p>

			<div class="vg-info">
				<span class="ico">ℹ️</span>
				<span><?php esc_html_e( 'نیازی به کپی‌پیست لینک و کلید نیست. فقط در پنل ویجنت اتصال را بسازید و اینجا دکمه «اتصال» را بزنید.', 'vigent-woo' ); ?></span>
			</div>

			<ol class="vg-steps">
				<li><span class="num">1</span><span class="txt"><strong><?php esc_html_e( 'در پنل ویجنت', 'vigent-woo' ); ?></strong><?php esc_html_e( 'به بخش محصولات یا اتصالات بروید و یک اتصال سایت بسازید. آدرس سایت خود را وارد کنید.', 'vigent-woo' ); ?></span></li>
				<li><span class="num">2</span><span class="txt"><strong><?php esc_html_e( 'دکمه «اتصال» را بزنید', 'vigent-woo' ); ?></strong><?php esc_html_e( 'ویجنت خودکار لینک و کلید امنیتی را در اینجا ثبت می‌کند.', 'vigent-woo' ); ?></span></li>
				<li><span class="num">3</span><span class="txt"><strong><?php esc_html_e( 'هم‌گام‌سازی', 'vigent-woo' ); ?></strong><?php esc_html_e( 'پس از اتصال، دکمه «هم‌گام‌سازی» ظاهر می‌شود. آن را بزنید تا محصولات و سفارش‌ها ارسال شوند.', 'vigent-woo' ); ?></span></li>
			</ol>

			<div class="vg-btns">
				<button class="vg-btn vg-btn-black" onclick="vgConnect(this)">
					<span>⚡</span> <?php esc_html_e( 'اتصال', 'vigent-woo' ); ?>
				</button>
			</div>
		</div>

		<?php if ( ! $has_wc ) : ?>
			<div class="vg-card">
				<h2><?php esc_html_e( 'ووکامرس', 'vigent-woo' ); ?></h2>
				<p><?php esc_html_e( 'ووکامرس روی این سایت فعال نیست. می‌توانید فقط اتصال را برقرار کنید؛ پس از نصب ووکامرس، هم‌گام‌سازی محصولات و سفارش‌ها خودکار فعال می‌شود.', 'vigent-woo' ); ?></p>
			</div>
		<?php endif; ?>
		<?php
	}

	// ─── Connected view ──────────────────────────────────────────────────

	private function render_connected_view( $core, $settings, $status, $has_wc ) {
		?>
		<?php $this->render_live_banner( $status ); ?>

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
				<div class="lbl"><?php esc_html_e( 'در صف retry', 'vigent-woo' ); ?></div>
			</div>
		</div>

		<?php if ( $has_wc ) : ?>
			<div class="vg-card">
				<h2><?php esc_html_e( 'هم‌گام‌سازی', 'vigent-woo' ); ?></h2>
				<p><?php esc_html_e( 'محصولات و سفارش‌ها را به‌صورت دستی ارسال کنید. هم‌گام‌سازی خودکار هر ۳۰ دقیقه نیز فعال است.', 'vigent-woo' ); ?></p>

				<!-- Filter -->
				<div class="vg-filter">
					<div class="vg-field">
						<label><?php esc_html_e( 'دسته‌بندی محصولات', 'vigent-woo' ); ?></label>
						<select id="filter-category">
							<option value=""><?php esc_html_e( 'همه دسته‌ها', 'vigent-woo' ); ?></option>
							<?php
							$categories = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false ) );
							if ( is_array( $categories ) ) :
								foreach ( $categories as $cat ) :
							?>
								<option value="<?php echo esc_attr( $cat->term_id ); ?>"><?php echo esc_html( $cat->name ); ?></option>
							<?php endforeach; endif; ?>
						</select>
					</div>
				</div>

				<div class="vg-btns">
					<button class="vg-btn vg-btn-black" onclick="vgSync('products', this)">
						<span>📦</span> <?php esc_html_e( 'ارسال محصولات', 'vigent-woo' ); ?>
					</button>
					<button class="vg-btn vg-btn-white" onclick="vgSync('orders', this)">
						<span>🛒</span> <?php esc_html_e( 'ارسال سفارش‌ها', 'vigent-woo' ); ?>
					</button>
				</div>

				<div id="vg-progress" class="vg-progress" style="display:none;">
					<div class="vg-progress-bar-wrap">
						<div id="vg-pbar" class="vg-progress-bar"></div>
						<div id="vg-ptext" class="vg-progress-text">0%</div>
					</div>
					<div id="vg-pinfo" class="vg-progress-info"><span></span><span></span></div>
				</div>
			</div>
		<?php endif; ?>

		<div class="vg-card">
			<h2><?php esc_html_e( 'تنظیمات هم‌گام‌سازی', 'vigent-woo' ); ?></h2>
			<p><?php esc_html_e( 'هم‌گام‌سازی خودکار هر ۳۰ دقیقه انجام می‌شود. می‌توانید انتخاب کنید چه داده‌هایی ارسال شوند.', 'vigent-woo' ); ?></p>

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
					<div class="sub"><?php esc_html_e( 'سفارش‌ها برای پیگیری و پشتیبانی به ویجنت ارسال می‌شوند. توصیه می‌شود روشن باشد.', 'vigent-woo' ); ?></div>
				</div>
			</label>

			<div class="vg-btns">
				<button class="vg-btn vg-btn-black" onclick="vgSaveToggles(this)"><?php esc_html_e( 'ذخیره', 'vigent-woo' ); ?></button>
			</div>
		</div>

		<?php $this->render_recent_logs( $core ); ?>

		<div class="vg-card">
			<h2><?php esc_html_e( 'راهنما', 'vigent-woo' ); ?></h2>
			<p><?php esc_html_e( 'این افزونه خودکار کار می‌کند:', 'vigent-woo' ); ?></p>
			<ul style="list-style: disc; padding-right: 20px; font-size: 13px; color: #6b7280; line-height: 1.8;">
				<li><?php esc_html_e( 'هر تغییر محصول یا سفارش فوراً به ویجنت ارسال می‌شود (webhook).', 'vigent-woo' ); ?></li>
				<li><?php esc_html_e( 'هر ۳۰ دقیقه یک‌بار، محصولات و سفارش‌ها به‌صورت خودکار همگام می‌شوند.', 'vigent-woo' ); ?></li>
				<li><?php esc_html_e( 'اگر ارسالی ناموفق باشد، به‌صورت خودکار ۵ بار دوباره تلاش می‌شود.', 'vigent-woo' ); ?></li>
				<li><?php esc_html_e( 'سفارش‌ها به‌صورت پیش‌فرض برای پیگیری روشن هستند.', 'vigent-woo' ); ?></li>
			</ul>
			<p style="margin-top: 12px;"><a href="https://vigent.ir/docs/woocommerce" target="_blank" style="color: #000; font-weight: 600;"><?php esc_html_e( 'راهنمای کامل →', 'vigent-woo' ); ?></a></p>
		</div>
		<?php
	}

	private function render_live_banner( $status ) {
		echo '<div id="vg-live" class="vg-live pending"><span class="icon">○</span><div class="text"><strong>' . esc_html__( 'در حال بارگذاری…', 'vigent-woo' ) . '</strong><small></small></div></div>';
		?>
		<script>
			// Live status — refresh every 30s.
			function vgRefreshStatus() {
				fetch(window.VG.ajaxUrl + '?action=vigent_woo_status&nonce=' + window.VG.nonce)
					.then(function(r) { return r.json(); })
					.then(function(data) {
						if (!data.success) return;
						var s = data.data;
						var banner = document.getElementById('vg-live');
						if (!banner) return;
						var cls, icon, msg, sub;
						if (s.connected === true) {
							cls = 'connected'; icon = '✓';
							msg = '<?php echo esc_js( __( 'متصل', 'vigent-woo' ) ); ?>';
							sub = s.last_check ? ('آخرین بررسی: ' + s.last_check) : '';
						} else if (s.connected === false) {
							cls = 'disconnected'; icon = '✗';
							msg = '<?php echo esc_js( __( 'اتصال قطع است', 'vigent-woo' ) ); ?>';
							sub = s.error ? s.error.substring(0, 120) : '';
						} else {
							cls = 'pending'; icon = '○';
							msg = '<?php echo esc_js( __( 'در انتظار', 'vigent-woo' ) ); ?>';
							sub = '';
						}
						banner.className = 'vg-live ' + cls;
						banner.innerHTML = '<span class="icon">' + icon + '</span><div class="text"><strong>' + msg + '</strong><small>' + sub + '</small></div>';
					})
					.catch(function() {});
			}
			setInterval(vgRefreshStatus, 30000);
			document.addEventListener('DOMContentLoaded', vgRefreshStatus);
		</script>
		<?php
	}

	private function render_recent_logs( $core ) {
		$queue = $core->get_retry_queue();
		echo '<div class="vg-card">';
		echo '<h2>' . esc_html__( 'رویدادهای اخیر', 'vigent-woo' ) . '</h2>';
		if ( empty( $queue ) ) {
			echo '<p>' . esc_html__( 'همه رویدادها با موفقیت ارسال شده‌اند — هیچ موردی در صف retry نیست.', 'vigent-woo' ) . '</p>';
		} else {
			echo '<p>' . esc_html__( 'رویدادهای ناموفف که به‌صورت خودکار دوباره ارسال می‌شوند:', 'vigent-woo' ) . '</p>';
			echo '<div class="vg-logs">';
			foreach ( array_slice( $queue, 0, 20 ) as $item ) {
				$entity_label = $this->entity_label( $item['topic'] );
				echo '<div class="vg-log-row">';
				echo '<span class="ico err"></span>';
				echo '<span class="entity">' . esc_html( $entity_label ) . '</span>';
				echo '<span class="count">' . sprintf( esc_html__( 'تلاش %d/5', 'vigent-woo' ), (int) $item['attempts'] ) . '</span>';
				echo '<span class="date">' . esc_html( $item['created_at'] ) . '</span>';
				echo '</div>';
			}
			echo '</div>';
		}
		echo '</div>';
	}

	private function entity_label( $topic ) {
		$map = array(
			'product.created' => __( 'محصول جدید', 'vigent-woo' ),
			'product.updated' => __( 'به‌روزرسانی محصول', 'vigent-woo' ),
			'product.deleted' => __( 'حذف محصول', 'vigent-woo' ),
			'order.updated'   => __( 'به‌روزرسانی سفارش', 'vigent-woo' ),
			'order.created'   => __( 'سفارش جدید', 'vigent-woo' ),
			'test.connection' => __( 'تست اتصال', 'vigent-woo' ),
		);
		return isset( $map[ $topic ] ) ? $map[ $topic ] : $topic;
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
