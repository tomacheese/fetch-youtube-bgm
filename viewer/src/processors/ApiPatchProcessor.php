<?php
class ApiPatchProcessor extends BaseProcessor
{
    public function getMethod()
    {
        return 'PATCH';
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
                $this->patchVideoInformation($requestUrls);
                break;
            default:
                $this->response(400, 'Bad Request');
                break;
        }
    }

    private function patchVideoInformation($requestUrls)
    {
        if (count($requestUrls) == 2) {
            // update details
            $videoId = $requestUrls[1];

            $requestBody = file_get_contents('php://input');
            $requestBody = json_decode($requestBody, true);
            $track = (isset($requestBody['track']) && !empty($requestBody['track'])) ? $requestBody['track'] : null;
            $artist = (isset($requestBody['artist']) && !empty($requestBody['artist'])) ? $requestBody['artist'] : null;
            $album = (isset($requestBody['album']) && !empty($requestBody['album'])) ? $requestBody['album'] : null;
            $albumArtist = (isset($requestBody['albumArtist']) && !empty($requestBody['albumArtist'])) ? $requestBody['albumArtist'] : null;

            $json = json_decode(file_get_contents('/data/tracks.json'), true);
            $json[$videoId] = [
                "track" => $track,
                "artist" => $artist,
                "album" => $album,
                "albumArtist" => $albumArtist,
            ];
            file_put_contents('/data/tracks.json', json_encode($json));
            $this->response(200, 'OK');
        }
        $this->response(404, 'Not Found');
    }
}
