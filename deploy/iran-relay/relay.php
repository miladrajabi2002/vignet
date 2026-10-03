<?php
declare(strict_types=1);

/**
 * Vigent Iran relay — HTTP forwarder for Iranian shop sites.
 *
 * The Vigent server is hosted abroad. Some Iranian shops (and, during
 * national-internet cutoffs, every Iranian site) refuse or drop connections
 * from foreign IPs. This script runs on Iranian cPanel hosting, receives a
 * signed request from the Vigent server, performs it from inside Iran and
 * returns the response. It is used by WooCommerce sync, order lookups and
 * product photo downloads (lib/security/iran-relay.ts).
 *
 * Deploy:
 *   1. Upload relay.php to its own folder, e.g. public_html/script/vigent-relay/
 *      (the folder is created writable for the replay-protection cache).
 *   2. Set RELAY_SECRET below to a long random string (64+ hex chars) and put
 *      the same value in IRAN_RELAY_SECRET on the Vigent server, with
 *      IRAN_RELAY_URL=https://<your-domain>/script/vigent-relay/relay.php
 *   3. Check the card «رله ایران» in /admin/system.
 *
 * Protocol (POST, JSON):
 *   headers  X-Relay-Timestamp: <unix seconds>
 *            X-Relay-Signature: hex(hmac_sha256(RELAY_SECRET, "<timestamp>.<raw body>"))
 *   body     {"nonce","method":"GET|POST|PING","url","headers":{},"body":<base64|null>,
 *             "timeoutMs","maxBytes"}
 *   reply    {"ok":true,"status","headers":{},"body":<base64>,"url"} or {"ok":false,"error"}
 *
 * Safety: requests must be signed and fresh (5 min) and each nonce is used
 * once; only public http(s) targets on ports 80/443 are reachable (private and
 * reserved addresses are refused and the DNS answer is pinned); redirects are
 * NOT followed here — the Vigent server validates and re-issues every hop.
 */

// ─── Config — fill this in before uploading ────────────────────────────
const RELAY_SECRET = 'PUT_A_LONG_RANDOM_SECRET_HERE';
// Optional: limit targets to these host suffixes, e.g. ['.ir', 'myshop.com'].
// Empty = any public host (requests are still signed by the Vigent server).
const ALLOWED_HOST_SUFFIXES = [];
// ────────────────────────────────────────────────────────────────────────

const MAX_CLOCK_SKEW = 300;
const MAX_BYTES_CAP = 10 * 1024 * 1024;
const MAX_TIMEOUT_MS = 25000;
const NONCE_DIR = __DIR__ . '/.relay-nonces';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body)
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}
if (RELAY_SECRET === '' || RELAY_SECRET === 'PUT_A_LONG_RANDOM_SECRET_HERE') {
    respond(503, ['ok' => false, 'error' => 'relay_not_configured']);
}

$raw = (string) file_get_contents('php://input');
$timestamp = $_SERVER['HTTP_X_RELAY_TIMESTAMP'] ?? '';
$signature = $_SERVER['HTTP_X_RELAY_SIGNATURE'] ?? '';
if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > MAX_CLOCK_SKEW) {
    respond(401, ['ok' => false, 'error' => 'stale_request']);
}
$expected = hash_hmac('sha256', $timestamp . '.' . $raw, RELAY_SECRET);
if (!is_string($signature) || !hash_equals($expected, strtolower($signature))) {
    respond(401, ['ok' => false, 'error' => 'bad_signature']);
}

$req = json_decode($raw, true);
if (!is_array($req)) {
    respond(400, ['ok' => false, 'error' => 'invalid_json']);
}

// ── Replay protection: each signed nonce is accepted once ──
$nonce = $req['nonce'] ?? '';
if (!is_string($nonce) || !preg_match('/^[A-Za-z0-9-]{16,64}$/', $nonce)) {
    respond(400, ['ok' => false, 'error' => 'invalid_nonce']);
}
if (!is_dir(NONCE_DIR)) {
    @mkdir(NONCE_DIR, 0700, true);
    @file_put_contents(NONCE_DIR . '/.htaccess', "Require all denied\nDeny from all\n");
}
$nonceFile = NONCE_DIR . '/' . $nonce;
if (file_exists($nonceFile)) {
    respond(409, ['ok' => false, 'error' => 'replayed_request']);
}
@touch($nonceFile);
if (mt_rand(1, 50) === 1) {
    foreach (glob(NONCE_DIR . '/*') ?: [] as $file) {
        if (is_file($file) && filemtime($file) < time() - 2 * MAX_CLOCK_SKEW) {
            @unlink($file);
        }
    }
}

$method = strtoupper((string) ($req['method'] ?? 'GET'));
if ($method === 'PING') {
    respond(200, [
        'ok' => true,
        'pong' => true,
        'time' => time(),
        'php' => PHP_VERSION,
        'curl' => function_exists('curl_init'),
    ]);
}
if ($method !== 'GET' && $method !== 'POST') {
    respond(400, ['ok' => false, 'error' => 'method_not_supported']);
}

// ── Target validation ──
$url = (string) ($req['url'] ?? '');
$parts = parse_url($url);
$scheme = strtolower((string) ($parts['scheme'] ?? ''));
$host = strtolower((string) ($parts['host'] ?? ''));
if (!in_array($scheme, ['http', 'https'], true) || $host === '' || isset($parts['user']) || isset($parts['pass'])) {
    respond(400, ['ok' => false, 'error' => 'invalid_url']);
}
$port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
if ($port !== 80 && $port !== 443) {
    respond(400, ['ok' => false, 'error' => 'port_not_allowed']);
}
if (ALLOWED_HOST_SUFFIXES) {
    $allowed = false;
    foreach (ALLOWED_HOST_SUFFIXES as $suffix) {
        $suffix = strtolower(ltrim($suffix, '.'));
        if ($host === $suffix || substr($host, -strlen('.' . $suffix)) === '.' . $suffix) {
            $allowed = true;
            break;
        }
    }
    if (!$allowed) {
        respond(403, ['ok' => false, 'error' => 'host_not_allowed']);
    }
}

$hostForDns = trim($host, '[]');
$addresses = filter_var($hostForDns, FILTER_VALIDATE_IP) ? [$hostForDns] : (gethostbynamel($hostForDns) ?: []);
if (!$addresses) {
    respond(502, ['ok' => false, 'error' => 'dns_failed']);
}
foreach ($addresses as $ip) {
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        respond(403, ['ok' => false, 'error' => 'unsafe_target']);
    }
}
$pinnedIp = $addresses[0];

// ── Forward ──
$timeoutMs = min(MAX_TIMEOUT_MS, max(1000, (int) ($req['timeoutMs'] ?? 15000)));
$maxBytes = min(MAX_BYTES_CAP, max(1024, (int) ($req['maxBytes'] ?? 2097152)));

$headers = [];
foreach ((array) ($req['headers'] ?? []) as $name => $value) {
    $name = (string) $name;
    if (!preg_match('/^[A-Za-z0-9-]{1,64}$/', $name)) {
        continue;
    }
    $lower = strtolower($name);
    if (in_array($lower, ['host', 'content-length', 'connection', 'transfer-encoding'], true)) {
        continue;
    }
    $headers[] = $name . ': ' . str_replace(["\r", "\n"], '', (string) $value);
}

$responseHeaders = [];
$buffer = '';
$tooLarge = false;
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_TIMEOUT_MS => $timeoutMs,
    CURLOPT_CONNECTTIMEOUT_MS => min($timeoutMs, 10000),
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_RESOLVE => [$hostForDns . ':' . $port . ':' . $pinnedIp],
    CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    CURLOPT_ENCODING => '',
    CURLOPT_HEADERFUNCTION => function ($curl, $line) use (&$responseHeaders) {
        $pos = strpos($line, ':');
        if ($pos !== false) {
            $name = strtolower(trim(substr($line, 0, $pos)));
            $value = trim(substr($line, $pos + 1));
            if ($name !== '' && !in_array($name, ['content-length', 'transfer-encoding', 'content-encoding', 'connection'], true)) {
                $responseHeaders[$name] = $value;
            }
        }
        return strlen($line);
    },
    CURLOPT_WRITEFUNCTION => function ($curl, $chunk) use (&$buffer, &$tooLarge, $maxBytes) {
        if (strlen($buffer) + strlen($chunk) > $maxBytes) {
            $tooLarge = true;
            return 0;
        }
        $buffer .= $chunk;
        return strlen($chunk);
    },
]);
if ($method === 'POST') {
    $body = $req['body'] ?? null;
    curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body) ? (string) base64_decode($body, true) : '');
}

$ok = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($tooLarge) {
    respond(502, ['ok' => false, 'error' => 'response_too_large']);
}
if ($ok === false || $status === 0) {
    respond(502, ['ok' => false, 'error' => 'upstream_unreachable', 'detail' => $error]);
}

respond(200, [
    'ok' => true,
    'status' => $status,
    'headers' => $responseHeaders,
    'body' => base64_encode($buffer),
    'url' => $url,
]);
