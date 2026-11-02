<?php
// php scripts/filament-strings.php > src/lib/admin-i18n/filament.en.json
// Filament's Indonesian interface text => its English, from the Laravel app's vendor lang
// files and its own lang/vendor overrides (Indonesian wins from the override).
$root = '/home/cuncis/inofarma';
function flatten(array $a, string $p = ''): array { $o = []; foreach ($a as $k => $v) { $key = $p === '' ? (string) $k : "$p.$k"; if (is_array($v)) { $o += flatten($v, $key); } elseif (is_string($v)) { $o[$key] = $v; } } return $o; }
$map = [];
foreach (glob("$root/vendor/filament/*/resources/lang/id", GLOB_ONLYDIR) as $idDir) {
  $package = basename(dirname($idDir, 3));
  $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($idDir, FilesystemIterator::SKIP_DOTS));
  foreach ($files as $file) {
    $idFile = $file->getPathname();
    $name = substr($idFile, strlen($idDir) + 1);
    $enFile = dirname($idDir) . "/en/$name";
    if (! is_file($enFile)) continue;
    $id = flatten(include $idFile);
    $override = "$root/lang/vendor/filament-$package/id/$name";
    if (is_file($override)) $id = array_replace($id, flatten(include $override));
    $en = flatten(include $enFile);
    foreach ($id as $key => $text) {
        if (isset($en[$key]) && $text !== $en[$key] && ! isset($map[$text])) $map[$text] = $en[$key];
    }
  }
}
ksort($map);
echo json_encode($map, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
