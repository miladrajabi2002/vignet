<?php
declare(strict_types=1);

/**
 * Validate the two distinct IPPanel Edge send contracts without modifying the
 * body that is forwarded upstream. Pattern sends keep `recipients` at the top
 * level; webservice sends put it inside `params`.
 */
function is_valid_ippanel_payload($payload, array $allowedSendingTypes): bool
{
    if (!is_array($payload)) {
        return false;
    }

    $type = $payload['sending_type'] ?? null;
    if (!is_string($type) || !in_array($type, $allowedSendingTypes, true)) {
        return false;
    }

    if ($type === 'webservice') {
        $params = $payload['params'] ?? null;
        $recipients = is_array($params) ? ($params['recipients'] ?? null) : null;
    } else {
        $recipients = $payload['recipients'] ?? null;
    }

    if (!is_array($recipients) || count($recipients) === 0) {
        return false;
    }

    foreach ($recipients as $recipient) {
        if (!is_string($recipient) || trim($recipient) === '') {
            return false;
        }
    }

    return true;
}
