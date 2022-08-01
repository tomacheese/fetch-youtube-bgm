<?php
function getFiles($dir)
{
    $fullFiles = [];
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file == "." || $file == "..") {
            continue;
        }
        if (is_dir($dir . DIRECTORY_SEPARATOR . $file)) {
            $fullFiles = array_merge($fullFiles, getFiles($dir . DIRECTORY_SEPARATOR . $file));
        }
        if (is_file($dir . DIRECTORY_SEPARATOR . $file)) {
            $fullFiles[] = $dir . DIRECTORY_SEPARATOR . $file;
        }
    }
    return $fullFiles;
}

$files = getFiles(__DIR__);
$files = array_filter($files, function ($file) {
    return substr($file, -4) === '.php';
});
foreach ($files as $file) {
    require_once($file);
}

$requestUrl = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

$processor = [
  new ApiGetProcessor(),
  new ApiPatchProcessor(),
  new ViewProcessor(),
];

usort($processor, function ($a, $b) {
    return strlen($b->getPrefix()) <=> strlen($a->getPrefix());
});

$isFound = false;
foreach ($processor as $p) {
    $method = $p->getMethod();
    if ($requestMethod !== $method) {
        continue;
    }
    $prefix = $p->getPrefix();
    if (strpos($requestUrl, $prefix) !== 0) {
        continue;
    }
    $requestUrl = substr($requestUrl, strlen($prefix));
    $p->execute($requestMethod, $requestUrl);
    $isFound = true;
    break;
}
if (!$isFound) {
    http_response_code(404);
    exit(json_encode([
      "status" => false,
      "data" => "Not Found",
    ]));
}
