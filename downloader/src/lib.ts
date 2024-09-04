import axios, { AxiosProxyConfig } from 'axios'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import NodeID3 from 'node-id3'
import { Logger } from '@book000/node-utils'
import sharp from 'sharp'
import { Config } from './configuration'

interface Track {
  vid: string
  track: string | null
  artist: string | null
  album: string | null
  albumArtist: string | null
}

type TrackFile = Record<string, Omit<Track, 'vid'>>

export interface YouTubeoEmbed {
  title: string
  author_name: string
  author_url: string
  type: string
  height: number
  width: number
  version: string
  provider_name: string
  provider_url: string
  thumbnail_height: number
  thumbnail_width: number
  thumbnail_url: string
  html: string
}

interface VideoInformation {
  title: string
  artist: string
}

export function getDefinedTracks(): Track[] {
  if (fs.existsSync('/data/tracks.json')) {
    const result = JSON.parse(
      fs.readFileSync('/data/tracks.json').toString(),
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
    tracks.find((track) => track.vid === vid) ?? {
      vid,
      track: null,
      artist: null,
      album: null,
      albumArtist: null,
    }
  )
}

export function addTrack(vid: string, information: VideoInformation | null) {
  const prev = fs.existsSync('/data/tracks.json')
    ? (JSON.parse(fs.readFileSync('/data/tracks.json').toString()) as TrackFile)
    : {}
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

export function getFilename(config: Config, track: Track) {
  const { vid, track: title, artist } = track

  const defaultSanitizeChars = [
    '/',
    '\\',
    '?',
    '%',
    '*',
    ':',
    '|',
    '"',
    '<',
    '>',
  ]
  const sanitizeChars = config.filename?.sanitizeChars ?? defaultSanitizeChars

  const sanitizedFilename = title
    ? // eslint-disable-next-line unicorn/no-array-reduce
      sanitizeChars.reduce(
        (acc, char) => acc.replaceAll(new RegExp(char, 'g'), ''),
        title,
      )
    : null

  if (sanitizedFilename && artist) {
    return `${sanitizedFilename} - ${artist} (${vid}).mp3`
  }
  return `${vid}.mp3`
}

function parseHttpProxy(): AxiosProxyConfig | false {
  const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY
  if (!proxy) return false

  const parsed = new URL(proxy)
  if (!parsed.hostname || !parsed.port) return false

  return {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port),
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

export async function getVideoInformation(
  vid: string,
): Promise<VideoInformation | null> {
  const logger = Logger.configure('getVideoInformation')
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`
  const response = await axios.get<YouTubeoEmbed>(url, {
    proxy: parseHttpProxy(),
    validateStatus: () => true,
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
  const tags =
    !track.track || !track.artist
      ? {}
      : { title: track.track, artist: track.artist }
  const newBuffer = NodeID3.update(
    {
      ...tags,
      fileUrl: `https://youtu.be/${track.vid}`,
    },
    prevBuffer,
  )
  fs.writeFileSync(file, newBuffer)
}

export function updateArtwork(vid: string, image: Buffer) {
  const file = `/tmp/download-movies/${vid}.mp3`
  const prevBuffer = fs.readFileSync(file)
  const newBuffer = NodeID3.update(
    {
      image: {
        mime: 'image/jpeg',
        type: {
          id: 3,
          name: 'front cover',
        },
        description: 'Cover',
        imageBuffer: image,
      },
    },
    prevBuffer,
  )
  fs.writeFileSync(file, newBuffer)
}

export function isSetArtwork(file: string) {
  const buffer = fs.readFileSync(file)
  const tags = NodeID3.read(buffer)
  return !!tags.image
}

export function getId3TagFileUrl(file: string) {
  const buffer = fs.readFileSync(file)
  const tags = NodeID3.read(buffer)
  return tags.fileUrl
}

export async function getArtworkData(vid: string) {
  const logger = Logger.configure('getArtwork')
  const url = `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`

  let response
  const firstResponse = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    validateStatus: () => true,
  })
  if (firstResponse.status === 200) {
    response = firstResponse
  } else {
    // retry
    const secondResponse = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
    })
    if (secondResponse.status !== 200) {
      logger.warn(
        `🚫 Failed to get artwork for ${vid} (${firstResponse.status} / ${secondResponse.status})`,
      )
      return null
    }
    response = secondResponse
  }

  return response.data
}

export async function getClippedArtwork(vid: string) {
  const artworkData = await getArtworkData(vid)
  if (!artworkData) return null
  return await sharp(artworkData)
    .extract({
      left: 280,
      top: 0,
      width: 720,
      height: 720,
    })
    .toBuffer()
}

export function normalizeVolume(file: string) {
  const envApp = process.env.NORMALIZE_VOLUME_APP ?? 'mp3gain'

  // 89dbになるように音量を調整
  if (envApp === 'mp3gain') {
    // -r: apply Track gain automatically (all files set to equal loudness)
    // -c: ignore clipping warning when applying gain
    // -p: preserve original file timestamp
    return execSync(`mp3gain -r -c -p "${file}"`)
  }
  if (envApp === 'rgain3') {
    return execSync(`replaygain "${file}"`)
  }
  throw new Error(`Unknown normalize volume app: ${envApp}`)
}

export function trimAndAddSilence(file: string, duration: number) {
  // "/tmp/download-movies/${id}.mp3" -> "/tmp/download-movies/${id}-trimmed.mp3"
  const newFile = file.replace('.mp3', '-trimmed.mp3')
  const result = execSync(
    `sox "${file}" "${newFile}" silence 1 0.1 1% reverse silence 1 0.1 1% reverse pad ${duration} ${duration}`,
  )
  fs.unlinkSync(file)
  fs.renameSync(newFile, file)
  return result
}

export function removeCacheDir() {
  execSync('yt-dlp --rm-cache-dir')
}

export function recreateDirectories() {
  if (fs.existsSync('/tmp/download-movies/')) {
    fs.rmSync('/tmp/download-movies/', { recursive: true })
  }
  fs.mkdirSync('/tmp/download-movies/', { recursive: true })

  if (!fs.existsSync('/data/tracks/')) {
    fs.mkdirSync('/data/tracks/', { recursive: true })
  }
}

export function getPlaylistVideoIds(playlistId: string) {
  const httpsProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy
  const command = [
    'yt-dlp',
    '--ignore-config',
    httpsProxy ? '--proxy' : '',
    httpsProxy ?? '',
    '--flat-playlist',
    '--print',
    'id',
    `https://www.youtube.com/playlist?list=${playlistId}`,
  ]
  const result = execSync(command.join(' '), {
    cwd: '/tmp/download-movies/',
  })
  return result.toString().split('\n').filter(Boolean)
}

export function downloadVideo(videoId: string): boolean {
  const httpsProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy
  const command = [
    'yt-dlp',
    '--ignore-config',
    httpsProxy ? '--proxy' : '',
    httpsProxy ?? '',
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
  } catch {
    return false
  }
}

export function getEchoPrint(file: string) {
  const command = ['/usr/local/bin/echoprint-codegen', `"${file}"`, '10', '30']
  const result = execSync(command.join(' '))
  const json: {
    code: string
  } = JSON.parse(result.toString())
  return json.code
}

export function getHumanReadableSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}
