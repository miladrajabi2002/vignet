<?php
declare(strict_types=1);

/**
 * IPPanel send-SMS proxy.
 *
 * IPPanel's API only accepts requests from an Iranian IP, but the Vigent
 * app server is hosted abroad. This script runs on Iranian shared hosting
 * and simply relays the send request to IPPanel, holding the real API key
 * so it never has to leave Iran.
 *
 * Deploy: upload this file as-is to the target path (e.g. so it serves at
 * https://yourdomain.ir/script/vigent-otp/index.php), then fill in the two
 * constants below.
 */

// ─── Config — fill these in before uploading ───────────────────────────
const IPPANEL_API_KEY = 'PUT_YOUR_IPPANEL_API_KEY_HERE';
// Must match IPPANEL_PROXY_SECRET in the app's .env on the Node server.
const PROXY_SECRET = 'PUT_A_LONG_RANDOM_SECRET_HERE';
// ────────────────────────────────────────────────────────────────────────

const IPPANEL_SEND_URL = 'https://edge.ippanel.com/v1/api/send';
// Vigent intentionally sends only pre-approved patterns (OTP and notifications).
const ALLOWED_SENDING_TYPES = ['pattern'];

require_once __DIR__ . '/payload.php';

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $body)
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'method_not_allowed']);
}

$secret = $_SERVER['HTTP_X_PROXY_SECRET'] ?? '';
if (PROXY_SECRET === '' || PROXY_SECRET === 'PUT_A_LONG_RANDOM_SECRET_HERE' || !hash_equals(PROXY_SECRET, $secret)) {
    respond(401, ['error' => 'unauthorized']);
}

$raw = file_get_contents('php://input');
$payload = json_decode((string) $raw, true);

if (!is_valid_ippanel_payload($payload, ALLOWED_SENDING_TYPES)) {
    respond(400, ['error' => 'invalid_payload']);
}

$ch = curl_init(IPPANEL_SEND_URL);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'Authorization: ' . IPPANEL_API_KEY,
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);

$response = curl_exec($ch);
$httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false) {
    respond(502, ['error' => 'upstream_unreachable', 'detail' => $curlError]);
}

http_response_code($httpStatus ?: 502);
echo $response;
