import axios, { AxiosProxyConfig } from 'axios'
import { execSync } from 'child_process'
import fs from 'fs'
import NodeID3 from 'node-id3'
import { Logger } from './logger'

interface Track {
  vid: string
  track: string | null
  artist: string | null
  album: string | null
  albumArtist: string | null
}

type TrackFile = {
  [vid: string]: Omit<Track, 'vid'>
}

export function getDefinedTracks(): Track[] {
  if (fs.existsSync('/data/tracks.json')) {
    const result = JSON.parse(
      fs.readFileSync('/data/tracks.json').toString()
    ) as TrackFile
    const ret = []
    for (const vid in result) {
      ret.push({
        vid,
        ...result[vid],
      })
    }
    return ret
  }
  return []
}

export function getTrack(vid: string): Track {
  const tracks = getDefinedTracks()
  return (
    tracks.find((track) => track.vid === vid) || {
      vid,
      track: null,
      artist: null,
      album: null,
      albumArtist: null,
    }
  )
}

export async function addTrack(vid: string) {
  const prev = fs.existsSync('/data/tracks.json')
    ? (JSON.parse(fs.readFileSync('/data/tracks.json').toString()) as TrackFile)
    : {}
  const information = await getVideoInformation(vid)
  const newTrack = {
    track: information ? information.title : null,
    artist: null,
    album: null,
    albumArtist: null,
  }
  const next = {
    ...prev,
    [vid]: newTrack,
  }
  fs.writeFileSync('/data/tracks.json', JSON.stringify(next))
}

export function getFilename(track: Track) {
  const { vid, track: title, artist } = track

  if (title && artist) {
    return `${title} - ${artist} (${vid}).mp3`
  }
  return `${vid}.mp3`
}

function parseHttpProxy(): AxiosProxyConfig | false {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (!proxy) return false

  const parsed = new URL(proxy)
  if (!parsed.hostname || !parsed.port) return false

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port),
    auth:
      parsed.username && parsed.password
        ? {
            username: parsed.username,
            password: parsed.password,
          }
        : undefined,
    protocol: parsed.protocol.replace(':', ''),
  }
}

export async function getVideoInformation(vid: string) {
  const logger = Logger.configure('getVideoInformation')
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`
  const response = await axios.get(url, {
    proxy: parseHttpProxy(),
  })
  if (response.status !== 200) {
    logger.warn(`🚫 Failed to get video information for ${vid}`)
    return null
  }
  const { title, author_name: authorName } = response.data
  return {
    title,
    artist: authorName,
  }
}

export function addId3Tag(track: Track) {
  const file = `/tmp/download-movies/${track.vid}.mp3`
  const prevBuffer = fs.readFileSync(file)
  if (!track.track || !track.artist) {
    return
  }
  const newBuffer = NodeID3.update(
    {
      title: track.track,
      artist: track.artist.split(',').join('/'),
      fileUrl: `https://youtu.be/${track.vid}`,
    },
    prevBuffer
  )
  fs.writeFileSync(file, newBuffer)
}

export function getId3TagFileUrl(file: string) {
  const buffer = fs.readFileSync(file)
  const tags = NodeID3.read(buffer)
  return tags.fileUrl
}

export function normalizeVolume(file: string) {
  execSync(`mp3gain -r -c -p "${file}"`)
}

export async function removeCacheDir() {
  execSync('yt-dlp --rm-cache-dir')
}

export function deleteDownloadMoviesDir() {
  if (fs.existsSync('/tmp/download-movies/')) {
    fs.rmSync('/tmp/download-movies/', { recursive: true })
  }
  fs.mkdirSync('/tmp/download-movies/')
}

export async function getPlaylistVideoIds(playlistId: string) {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
  const command = [
    'yt-dlp',
    '--ignore-config',
    httpsProxy ? '--proxy' : '',
    httpsProxy || '',
    '--flat-playlist',
    '--print',
    'id',
    `https://www.youtube.com/playlist?list=${playlistId}`,
  ]
  const result = execSync(command.join(' '), {
    cwd: '/tmp/download-movies/',
  })
  return result
    .toString()
    .split('\n')
    .filter((id) => id)
}

export async function downloadVideo(videoId: string): Promise<boolean> {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy
  const command = [
    'yt-dlp',
    '--ignore-config',
    httpsProxy ? '--proxy' : '',
    httpsProxy || '',
    '-f',
    'ba',
    '-x',
    '--audio-format',
    'mp3',
    '--embed-thumbnail',
    '-o',
    '"%(id)s.%(ext)s"',
    `https://youtu.be/${videoId}`,
  ]
  try {
    execSync(command.join(' '), {
      cwd: '/tmp/download-movies/',
    })
    return true
  } catch (e) {
    return false
  }
}

export function getEchoPrint(file: string) {
  const command = ['/usr/local/bin/echoprint-codegen', `"${file}"`, '10', '30']
  const result = execSync(command.join(' '))
  const json = JSON.parse(result.toString())
  return json.code
}

export function getHumanReadableSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}
