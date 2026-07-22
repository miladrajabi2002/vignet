<?php
declare(strict_types=1);

require_once __DIR__ . '/../deploy/ippanel-proxy/payload.php';

$allowed = ['pattern', 'webservice'];
$cases = [
    'nested webservice recipients are accepted' => [
        ['sending_type' => 'webservice', 'params' => ['recipients' => ['+989128352271']]],
        true,
    ],
    'top-level-only webservice recipients are rejected' => [
        ['sending_type' => 'webservice', 'recipients' => ['+989128352271']],
        false,
    ],
    'top-level pattern recipients are accepted' => [
        ['sending_type' => 'pattern', 'recipients' => ['+989128352271'], 'params' => ['code' => '123456']],
        true,
    ],
    'nested-only pattern recipients are rejected' => [
        ['sending_type' => 'pattern', 'params' => ['recipients' => ['+989128352271']]],
        false,
    ],
    'empty recipients are rejected' => [
        ['sending_type' => 'webservice', 'params' => ['recipients' => []]],
        false,
    ],
    'malformed recipients are rejected' => [
        ['sending_type' => 'pattern', 'recipients' => [null]],
        false,
    ],
];

foreach ($cases as $name => [$payload, $expected]) {
    $actual = is_valid_ippanel_payload($payload, $allowed);
    if ($actual !== $expected) {
        fwrite(STDERR, "FAILED: {$name}\n");
        exit(1);
    }
}

fwrite(STDOUT, sprintf("%d proxy contract cases passed\n", count($cases)));
