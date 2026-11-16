<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
$ch = curl_init('https://numerologia-300-ai.tankraft431.workers.dev/health');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 7,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_USERAGENT => 'NumiMomentConnectivityCheck/1.0',
]);
$body = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_errno($ch) ? curl_error($ch) : '';
curl_close($ch);
$parsed = is_string($body) ? json_decode($body, true) : null;
echo json_encode([
    'http_status' => $status,
    'ai_bound' => is_array($parsed) && ($parsed['ai_bound'] ?? false) === true,
    'service_ok' => is_array($parsed) && ($parsed['service'] ?? '') === 'numi-moment-300-owner-preview',
    'network_error' => $error ? 'CONNECTION_FAILED' : null
], JSON_UNESCAPED_SLASHES);
