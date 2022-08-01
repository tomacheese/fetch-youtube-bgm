<?php
class ViewProcessor extends BaseProcessor
{
    public function getMethod()
    {
        return 'GET';
    }
    public function getPrefix()
    {
        return '/';
    }
    public function execute($requestMethod, $requestUrl)
    {
        if (strlen($requestUrl) == 0) {
            exit(file_get_contents("/app/src/view/index.html"));
        }
        if (isset($_GET["vid"])) {
            exit(file_get_contents("/app/src/view/video.html"));
        }
        $this->response(404, 'Not Found');
    }
}
