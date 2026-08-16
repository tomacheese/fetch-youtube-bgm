import axios, { AxiosProxyConfig } from 'axios'
import { exec, execSync } from 'node:child_process'
import fs from 'node:fs'
import NodeID3 from 'node-id3'
import { Logger } from '@book000/node-utils'
import sharp from 'sharp'
import path from 'node:path'
import { promisify } from 'node:util'
import { Config } from './configuration'
import { MusicBrainz } from './musicbrainz'
import { DOWNLOAD_TEMP_DIR } from './constants'

const execAsync = promisify(exec)

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
        // 個別解像度の 404 は fallback 設計上の想定内事象のため、GlitchTip 等の監視ノイズにしない
        logger.debug(
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

/**
 * 動画サムネイルの中央を最大の正方形として切り出す
 *
 * @param vid 動画 ID
 * @returns 加工済み artwork。取得または加工できない場合は null
 */
export async function getClippedArtwork(vid: string) {
  const artworkData = await getArtworkData(vid)
  if (!artworkData) return null

  const logger = Logger.configure('getClippedArtwork')
  try {
    const image = sharp(artworkData)
    const { width, height } = await image.metadata()
    if (!width || !height) {
      logger.warn(`🚫 Failed to get artwork dimensions for ${vid}`)
      return null
    }

    const side = Math.min(width, height)
    return await image
      .extract({
        left: Math.floor((width - side) / 2),
        top: Math.floor((height - side) / 2),
        width: side,
        height: side,
      })
      .toBuffer()
  } catch (error) {
    logger.warn(`⚠️ Failed to clip artwork for ${vid}:`, error as Error)
    return null
  }
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

/**
 * stderr 等の診断文字列から秘密情報(URL 内の認証情報、Cookie / Authorization
 * ヘッダーの値)を scrub する
 *
 * @param text scrub 対象の文字列
 * @returns 秘密情報を scrub した文字列
 */
export function sanitizeSecrets(text: string): string {
  return text
    .replaceAll(/(\w+:\/\/)[^/\s:@]+:[^/\s@]+@/g, '$1***:***@')
    .replaceAll(/(Cookie:\s*).+/gi, '$1***')
    .replaceAll(/(Authorization:\s*).+/gi, '$1***')
}

/**
 * yt-dlp によるダウンロード結果
 */
export interface DownloadResult {
  success: boolean
  exitCode: number | null
  stderr: string | null
}

/**
 * yt-dlp で動画をダウンロードする
 *
 * @param videoId 動画 ID
 * @returns ダウンロード結果。失敗時は yt-dlp の exit code と sanitized stderr を含む
 */
export function downloadVideo(videoId: string): DownloadResult {
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
    return { success: true, exitCode: 0, stderr: null }
  } catch (error) {
    // error.message はプロキシ認証情報を含みうるコマンド全体を含むため、stderr のみを診断情報として扱う
    const exitCode =
      typeof error === 'object' && error !== null && 'status' in error
        ? (error.status as number | null)
        : null
    const rawStderr =
      typeof error === 'object' && error !== null && 'stderr' in error
        ? String(error.stderr)
        : null
    return {
      success: false,
      exitCode,
      stderr: rawStderr ? sanitizeSecrets(rawStderr) : null,
    }
  }
}

/**
 * yt-dlp でダウンロードせずに動画のメタデータ(再生時間・概算ファイルサイズ)を取得する
 *
 * @param videoId 動画 ID
 * @returns 取得できたメタデータ。コマンド自体が失敗した場合は null
 */
export async function getVideoMetadata(
  videoId: string,
): Promise<VideoMetadata | null> {
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
    // execSync だと呼び出し中 Node プロセス全体がブロックされ、複数動画分の
    // yt-dlp 呼び出しを並列実行できないため、ここだけ非同期の exec を使う
    const { stdout } = await execAsync(command.join(' '), {
      cwd: DOWNLOAD_TEMP_DIR,
    })
    const [durationRaw, filesizeApproxRaw] = stdout.trim().split(';', 2)
    const duration = Number.parseFloat(durationRaw)
    const filesizeApprox = Number.parseFloat(filesizeApproxRaw)
    return {
      duration: Number.isNaN(duration) ? null : duration,
      filesizeApprox: Number.isNaN(filesizeApprox) ? null : filesizeApprox,
    }
  } catch (error) {
    // error.message には実行したシェルコマンド全体(プロキシの認証情報が
    // 埋め込まれている場合はそれも含む)が含まれるため、ログには出力しない。
    // yt-dlp 自身のエラー出力である stderr のみを診断情報として残す
    const stderr =
      typeof error === 'object' && error !== null && 'stderr' in error
        ? sanitizeSecrets(String(error.stderr))
        : undefined
    logger.warn(
      `⚠️ Failed to get metadata for ${videoId}${stderr ? `: ${stderr}` : ''}`,
    )
    return null
  }
}

type VideoMetadataFile = Record<string, VideoMetadata>

const VIDEO_METADATA_STORE_PATH = '/data/video-metadata.json'

/**
 * 動画メタデータの専用ストアを読み込む
 *
 * @returns 動画 ID をキーとしたメタデータの一覧。ファイルが存在しない、または
 * 内容が壊れている場合は空オブジェクト(fail-open)
 */
export function getVideoMetadataStore(): VideoMetadataFile {
  if (!fs.existsSync(VIDEO_METADATA_STORE_PATH)) {
    return {}
  }
  try {
    return JSON.parse(
      fs.readFileSync(VIDEO_METADATA_STORE_PATH).toString(),
    ) as VideoMetadataFile
  } catch (error) {
    const logger = Logger.configure('getVideoMetadataStore')
    logger.warn(
      `⚠️ Failed to parse video metadata store, treating as empty:`,
      error as Error,
    )
    return {}
  }
}

/**
 * 動画メタデータの専用ストアファイルへ書き込む
 *
 * 書き込み途中でプロセスが停止しても壊れたファイルが残らないよう、
 * 一時ファイルへ書き込んでからリネームすることでアトミックに反映する
 *
 * @param store 書き込む内容
 */
function writeVideoMetadataStore(store: VideoMetadataFile) {
  const tempPath = `${VIDEO_METADATA_STORE_PATH}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(store))
  fs.renameSync(tempPath, VIDEO_METADATA_STORE_PATH)
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
  writeVideoMetadataStore(next)
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
  writeVideoMetadataStore(next)
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
