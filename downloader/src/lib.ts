import axios, { AxiosProxyConfig } from 'axios'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import NodeID3 from 'node-id3'
import { Logger } from '@book000/node-utils'
import sharp from 'sharp'
import path from 'node:path'
import { Config } from './configuration'
import { MusicBrainz } from './musicbrainz'
import { DOWNLOAD_TEMP_DIR } from './constants'

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

export interface VideoMetadata {
  duration: number | null
  filesizeApprox: number | null
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

export async function getTrack(vid: string): Promise<Track> {
  const tracks = getDefinedTracks()
  const definedTrack = tracks.find((track) => track.vid === vid)
  if (definedTrack) {
    return definedTrack
  }

  const musicbrainzInfo = await MusicBrainz.getTrackInfo(vid)
  if (musicbrainzInfo) {
    return {
      vid,
      track: musicbrainzInfo.title,
      artist: musicbrainzInfo.artist,
      album: null,
      albumArtist: null,
    }
  }

  return {
    vid,
    track: null,
    artist: null,
    album: null,
    albumArtist: null,
  }
}

export function addTrack(vid: string, information: VideoInformation | null) {
  const prev = fs.existsSync('/data/tracks.json')
    ? (JSON.parse(fs.readFileSync('/data/tracks.json').toString()) as TrackFile)
    : {}
  const newTrack = {
    track: information?.title ?? null,
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

  const sanitizedTitle = title
    ? // eslint-disable-next-line unicorn/no-array-reduce
      sanitizeChars.reduce(
        (acc, char) =>
          acc.replaceAll(
            new RegExp(
              char.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`),
              'g',
            ),
            '',
          ),
        title,
      )
    : null

  const sanitizedArtist = artist
    ? // eslint-disable-next-line unicorn/no-array-reduce
      sanitizeChars.reduce(
        (acc, char) =>
          acc.replaceAll(
            new RegExp(
              char.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`),
              'g',
            ),
            '',
          ),
        artist,
      )
    : null

  if (sanitizedTitle && sanitizedArtist) {
    return `${sanitizedTitle} - ${sanitizedArtist} (${vid}).mp3`
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
    headers: {
      'Accept-Language': 'ja-JP',
    },
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

export function addId3Tag(
  track: Track,
  videoIndex: number,
  videoCount: number,
) {
  const file = path.join(DOWNLOAD_TEMP_DIR, `${track.vid}.mp3`)
  const prevBuffer = fs.readFileSync(file)
  const tags =
    !track.track || !track.artist
      ? {}
      : { title: track.track, artist: track.artist }
  const newBuffer = NodeID3.update(
    {
      ...tags,
      fileUrl: `https://youtu.be/${track.vid}`,
      trackNumber: `${videoIndex}/${videoCount}`,
      generalObject: [],
    },
    prevBuffer,
  )
  fs.writeFileSync(file, newBuffer)
}

export function updateArtwork(vid: string, image: Buffer) {
  const file = path.join(DOWNLOAD_TEMP_DIR, `${vid}.mp3`)
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
      generalObject: [],
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
  const resolutions = [
    'maxresdefault.jpg',
    'sddefault.jpg',
    'hqdefault.jpg',
    'mqdefault.jpg',
    'default.jpg',
  ]

  for (const resolution of resolutions) {
    const url = `https://i.ytimg.com/vi/${vid}/${resolution}`

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
          `⏭️ Failed to get artwork for ${vid} at ${resolution} (${firstResponse.status} / ${secondResponse.status}), trying next resolution`,
        )
        continue
      }
      response = secondResponse
    }

    logger.info(`✅ Got artwork for ${vid} at ${resolution}`)
    return response.data
  }

  logger.warn(`🚫 Failed to get artwork for ${vid} at all resolutions`)
  return null
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
  if (fs.existsSync(DOWNLOAD_TEMP_DIR)) {
    fs.rmSync(DOWNLOAD_TEMP_DIR, { recursive: true })
  }
  fs.mkdirSync(DOWNLOAD_TEMP_DIR, { recursive: true })

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
    '--add-header',
    'Accept-Language:ja-JP',
    '--flat-playlist',
    '--print',
    'id',
    `https://www.youtube.com/playlist?list=${playlistId}`,
  ]
  const result = execSync(command.join(' '), {
    cwd: DOWNLOAD_TEMP_DIR,
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
    '--add-header',
    'Accept-Language:ja-JP',
    '-o',
    '"%(id)s.%(ext)s"',
    `https://youtu.be/${videoId}`,
  ]
  try {
    execSync(command.join(' '), {
      cwd: DOWNLOAD_TEMP_DIR,
    })
    return true
  } catch {
    return false
  }
}

/**
 * yt-dlp でダウンロードせずに動画のメタデータ(再生時間・概算ファイルサイズ)を取得する
 *
 * @param videoId 動画 ID
 * @returns 取得できたメタデータ。コマンド自体が失敗した場合は null
 */
export function getVideoMetadata(videoId: string): VideoMetadata | null {
  const logger = Logger.configure('getVideoMetadata')
  const httpsProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy
  const command = [
    'yt-dlp',
    '--ignore-config',
    httpsProxy ? '--proxy' : '',
    httpsProxy ?? '',
    '--skip-download',
    '--add-header',
    'Accept-Language:ja-JP',
    '--print',
    '"%(duration)s;%(filesize_approx)s"',
    `https://youtu.be/${videoId}`,
  ]
  try {
    const result = execSync(command.join(' '), {
      cwd: DOWNLOAD_TEMP_DIR,
    })
    const [durationRaw, filesizeApproxRaw] = result
      .toString()
      .trim()
      .split(';', 2)
    const duration = Number.parseFloat(durationRaw)
    const filesizeApprox = Number.parseFloat(filesizeApproxRaw)
    return {
      duration: Number.isNaN(duration) ? null : duration,
      filesizeApprox: Number.isNaN(filesizeApprox) ? null : filesizeApprox,
    }
  } catch (error) {
    logger.warn(`⚠️ Failed to get metadata for ${videoId}:`, error as Error)
    return null
  }
}

type VideoMetadataFile = Record<string, VideoMetadata>

const VIDEO_METADATA_STORE_PATH = '/data/video-metadata.json'

/**
 * 動画メタデータの専用ストアを読み込む
 *
 * @returns 動画 ID をキーとしたメタデータの一覧。ファイルが存在しない場合は空オブジェクト
 */
export function getVideoMetadataStore(): VideoMetadataFile {
  if (fs.existsSync(VIDEO_METADATA_STORE_PATH)) {
    return JSON.parse(
      fs.readFileSync(VIDEO_METADATA_STORE_PATH).toString(),
    ) as VideoMetadataFile
  }
  return {}
}

/**
 * 動画メタデータの専用ストアに単一動画のエントリを追加・更新する
 *
 * @param vid 動画 ID
 * @param metadata 保存するメタデータ
 */
export function updateVideoMetadata(vid: string, metadata: VideoMetadata) {
  const store = getVideoMetadataStore()
  const next = {
    ...store,
    [vid]: metadata,
  }
  fs.writeFileSync(VIDEO_METADATA_STORE_PATH, JSON.stringify(next))
}

/**
 * 動画メタデータの専用ストアから、現在のプレイリストに存在しない動画のエントリを削除する
 *
 * @param currentIds 現在のプレイリストに含まれる動画 ID の一覧
 */
export function pruneVideoMetadataStore(currentIds: string[]) {
  const store = getVideoMetadataStore()
  const next: VideoMetadataFile = {}
  for (const vid in store) {
    if (currentIds.includes(vid)) {
      next[vid] = store[vid]
    }
  }
  fs.writeFileSync(VIDEO_METADATA_STORE_PATH, JSON.stringify(next))
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
