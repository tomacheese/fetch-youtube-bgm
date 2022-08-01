<?php
class ApiGetProcessor extends BaseProcessor
{
    public function getMethod()
    {
        return 'GET';
    }
    public function getPrefix()
    {
        return '/api/';
    }

    public function execute($requestMethod, $requestUrl)
    {
        $requestUrls = explode('/', $requestUrl);
        if (count($requestUrls) == 0) {
            $this->response(400, 'Bad Request');
        }

        $action = $requestUrls[0];
        switch ($action) {
            case 'info':
                $this->getVideoInformation($requestUrls);
                break;
            default:
                $this->response(400, 'Bad Request');
                break;
        }
    }

    private function getVideoInformation($requestUrls)
    {
        if (count($requestUrls) == 1) {
            // get all video information
            $json = json_decode(file_get_contents('/data/tracks.json'), true);
            $ret = [];
            foreach ($json as $videoId => $videoInfo) {
                $ret[] = [
                    "id" => $videoId,
                    "track" => $videoInfo['track'],
                    "artist" => $videoInfo['artist'],
                    "album" => $videoInfo['album'],
                    "albumArtist" => $videoInfo['albumArtist'],
                ];
            }
            $this->response(200, $ret);
        }

        if (count($requestUrls) == 2) {
            // get details
            $videoId = $requestUrls[1];
            $json = json_decode(file_get_contents('/data/tracks.json'), true);

            if (isset($json[$videoId])) {
                $this->response(200, $json[$videoId]);
            } else {
                $this->response(404, 'Not Found');
            }
        }
        $this->response(404, 'Not Found');
    }
}
