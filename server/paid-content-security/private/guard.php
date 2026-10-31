<?php
declare(strict_types=1);

/**
 * Must only be called AFTER a trusted server session and a provider-verified,
 * active entitlement for the exact product and subject.
 * A client-side flag or user-provided filename must never grant paid access.
 */
function paidVaultRead(string $root, string $internalPath, bool $authorized): string
{
    if (!$authorized) {
        throw new RuntimeException('ACCESS_DENIED', 403);
    }
    $realRoot = realpath($root);
    if ($realRoot === false || !is_dir($realRoot)) {
        throw new RuntimeException('VAULT_UNAVAILABLE', 503);
    }
    if ($internalPath === '' || strlen($internalPath) > 400
        || str_starts_with($internalPath, '/') || str_contains($internalPath, '\\')
        || str_contains($internalPath, "\0")
        || preg_match('~(^|/)\\.{1,2}(/|$)~', $internalPath)) {
        throw new RuntimeException('INVALID_PATH', 400);
    }
    if (!preg_match('~^[a-zA-Z0-9_./-]+\\.(?:json|txt)$~D', $internalPath)) {
        throw new RuntimeException('INVALID_FILE_TYPE', 403);
    }
    $file = realpath($realRoot . DIRECTORY_SEPARATOR . $internalPath);
    if ($file === false || !str_starts_with($file, $realRoot . DIRECTORY_SEPARATOR) || !is_file($file)) {
        throw new RuntimeException('FILE_NOT_FOUND', 404);
    }
    if (filesize($file) > 2_000_000) {
        throw new RuntimeException('FILE_TOO_LARGE', 413);
    }
    $text = file_get_contents($file);
    if ($text === false) {
        throw new RuntimeException('READ_FAILED', 503);
    }
    return $text;
}
