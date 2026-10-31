<?php
declare(strict_types=1);
require __DIR__ . '/../server/paid-content-security/private/guard.php';
$root = sys_get_temp_dir() . '/paid-vault-test-' . bin2hex(random_bytes(6));
mkdir($root);
mkdir($root . '/data');
file_put_contents($root . '/data/example.json', '{"answer":"private"}');
$cases = [
  ['data/example.json', false, 403],
  ['../etc/passwd', true, 400],
  ['/etc/passwd', true, 400],
  ['data/../../etc/passwd', true, 400],
  ['data/example.php', true, 403],
  ['data/absent.json', true, 404],
];
try {
  foreach ($cases as [$filename, $authorized, $expected]) {
    try {
      paidVaultRead($root, $filename, $authorized);
      throw new LogicException('Unsafe allow: ' . $filename);
    } catch (RuntimeException $e) {
      if ($e->getCode() !== $expected) {
        throw new LogicException('Unexpected status: ' . $filename . ' ' . $e->getCode());
      }
    }
  }
  if (paidVaultRead($root, 'data/example.json', true) !== '{"answer":"private"}') {
    throw new LogicException('Authorized reading differs from stored original');
  }
  echo '7/7 security checks passed' . PHP_EOL;
} finally {
  unlink($root . '/data/example.json');
  rmdir($root . '/data');
  rmdir($root);
}
