<?php
abstract class BaseProcessor
{
    abstract public function getPrefix();
    abstract public function getMethod();
    abstract public function execute($requestMethod, $requestUrl);
    protected function response($code, $message)
    {
        header("Content-Type: application/json");
        http_response_code($code);
        exit(json_encode([
          "status" => $code === 200,
          "data" => $message,
        ]));
    }
}
