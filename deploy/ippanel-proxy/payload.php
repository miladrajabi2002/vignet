<?php
declare(strict_types=1);

/**
 * Validate the IPPanel Edge send contract without modifying the body forwarded
 * upstream. Vigent uses only pattern sends, whose `recipients` are top-level.
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

    $recipients = $payload['recipients'] ?? null;

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
