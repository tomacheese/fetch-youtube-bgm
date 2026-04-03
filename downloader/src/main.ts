import fs, { promises as fsPromises } from 'node:fs'
import path from 'node:path'
import { getConfig } from './configuration'
import { sendDiscordMessage } from './discord'
import {
  addId3Tag,
  addTrack,
  recreateDirectories,
  downloadVideo,
  getClippedArtwork,
  getEchoPrint,
  getFilename,
  getHumanReadableSize,
  getId3TagFileUrl,
  getPlaylistVideoIds,
  getTrack,
  getVideoInformation,
  normalizeVolume,
  removeCacheDir,
  updateArtwork,
  trimAndAddSilence,
  isSetArtwork,
  getArtworkData,
} from './lib'
import { Logger } from '@book000/node-utils'
import { DOWNLOAD_TEMP_DIR } from './constants'

const MAX_DOWNLOAD_RETRIES = 3

class ParallelDownloadVideo {
  private readonly ids: string[]
  private readonly videoCount: number
  private readonly successfulIds: string[] = []

  constructor(ids: string[]) {
    this.ids = [...ids]
    this.videoCount = ids.length
  }

  /**
   * すべての動画をダウンロードする
   *
   * @param runnerCount 並列実行数 (デフォルト: 3)
   * @returns 成功したダウンロードの動画ID配列
   */
  public async runAll(runnerCount = 3): Promise<string[]> {
    const runners = []
    for (let i = 0; i < runnerCount; i++) {
      runners.push(this.runner(i))
    }

    await Promise.all(runners)
    return this.successfulIds
  }

  private async runner(runnerId: number) {
    const logger = Logger.configure(
      `ParallelDownloadVideo.runner#${runnerId.toString()}`,
    )
    logger.info(`Starting download runner #${runnerId}`)
    while (this.ids.length > 0) {
      const id = this.ids.pop()
      if (!id) {
        break
      }
      const videoIndex = this.videoCount - this.ids.length
      logger.info(`📥 Downloading ${id} (${videoIndex} / ${this.videoCount})`)
      const success = await this.runDownloadVideo(id)
      if (success) {
        this.successfulIds.push(id)
      }
    }
  }

  /**
   * 動画をダウンロードする
   *
   * @param id 動画 ID
   * @returns ダウンロードに成功した場合は true、失敗した場合は false
   */
  async runDownloadVideo(id: string): Promise<boolean> {
    const logger = Logger.configure(
      `ParallelDownloadVideo.runDownloadVideo#${id}`,
    )
    const filePath = path.join(DOWNLOAD_TEMP_DIR, `${id}.mp3`)

    // MAX_DOWNLOAD_RETRIES回までリトライする
    for (let i = 0; i < MAX_DOWNLOAD_RETRIES; i++) {
      const result = downloadVideo(id)
      if (result) {
        try {
          const stats = await fsPromises.stat(filePath)
          const humanFileSize = getHumanReadableSize(stats.size)
          logger.info(`✅ Successfully downloaded ${id} (${humanFileSize})`)
          return true
        } catch (err) {
          logger.warn(`⚠️ Failed to get file stats for ${id}:`, err as Error)
          // ファイルステータス確認に失敗してもリトライを継続
        }
      }
      logger.info(`❌ Failed to download ${id}. Retry after 3 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    try {
      await fsPromises.access(filePath)
    } catch {
      logger.warn(
        `⚠️ Skipping ${id} due to download failure after ${MAX_DOWNLOAD_RETRIES} retries`,
      )
      return false
    }
    return true
  }
}

class ParallelProcessVideo {
  private readonly ids: string[]
  private readonly videoCount: number

  constructor(ids: string[]) {
    this.ids = [...ids]
    this.videoCount = ids.length
  }

  public async runAll(runnerCount = 3) {
    const runners = []
    for (let i = 0; i < runnerCount; i++) {
      runners.push(this.runner(i))
    }

    await Promise.all(runners)
  }

  private async runner(runnerId: number) {
    const logger = Logger.configure(
      `ParallelProcessVideo.runner#${runnerId.toString()}`,
    )
    while (this.ids.length > 0) {
      const id = this.ids.pop()
      if (!id) {
        break
      }
      const videoIndex = this.videoCount - this.ids.length
      logger.info(`🎵 Processing ${id} (${videoIndex} / ${this.videoCount})`)
      await this.processVideo(id, videoIndex, this.videoCount)
    }
  }

  /**
   * 動画を処理する
   *
   * - 音量を正規化
   * - 登録トラック情報を元に ID3 タグを付与
   * - echoprint (音声指紋) を元にダウンロード済み & 変更がないかどうかを判定
   * - Discord に通知
   *
   * @param id 動画 ID
   * @param videoIndex 動画のインデックス
   * @param videoCount 動画の総数
   */
  private async processVideo(
    id: string,
    videoIndex: number,
    videoCount: number,
  ) {
    const logger = Logger.configure(`ParallelProcessVideo.processVideo#${id}`)
    const config = getConfig()
    const downloadedFilePath = path.join(DOWNLOAD_TEMP_DIR, `${id}.mp3`)

    // ダウンロードファイルの存在確認
    try {
      await fsPromises.access(downloadedFilePath)
    } catch {
      logger.warn(`⚠️ Downloaded file not found for ${id}, skipping processing`)
      return
    }

    let videoInfo = null
    try {
      videoInfo = await getVideoInformation(id)
    } catch (err) {
      logger.error('Failed to get video information', err as Error)
    }
    if (!videoInfo) {
      // retry
      logger.info(
        `❌ Failed to get video information. Retry after 5 seconds...`,
      )
      await new Promise((resolve) => setTimeout(resolve, 5000))
      try {
        videoInfo = await getVideoInformation(id)
      } catch (err) {
        logger.error('Failed to get video information (retry)', err as Error)
      }
    }
    if (videoInfo) {
      logger.info(`📺 ${videoInfo.title}`)
      logger.info(`🎤 ${videoInfo.artist}`)
    }

    // 登録されているトラック情報を取得
    const track = await getTrack(id)
    if (!track.track) {
      // トラック情報がない場合は、デフォルト値を設定
      addTrack(id, videoInfo)
    }
    logger.info(`🎵 ${track.track}`)
    logger.info(`🎤 ${track.artist}`)

    // 音量を正規化
    logger.info(`🔊 Normalizing volume of ${id}`)
    const normalizeResult = normalizeVolume(downloadedFilePath)
    for (const line of normalizeResult.toString().split('\n')) {
      logger.info(`  > ${line}`)
    }

    // 前後の空白を削除し、無音を追加
    const secondsForSilence = 2
    logger.info(
      `🎵 Trim and add ${secondsForSilence} seconds of silence for ${id}`,
    )
    const trimAndAddSilenceResult = trimAndAddSilence(
      downloadedFilePath,
      secondsForSilence,
    )
    for (const line of trimAndAddSilenceResult.toString().split('\n')) {
      logger.info(`  > ${line}`)
    }

    // ID3タグを付与
    logger.info(`📃 Adding ID3 tag for ${track.vid}`)
    addId3Tag(track, videoIndex, videoCount)

    // トピック(YouTube Music)の場合、リサイズしたアートワークへ更新をする
    if (videoInfo?.artist.endsWith(' - Topic')) {
      const artwork = await getClippedArtwork(id)
      if (artwork) {
        logger.info(`🎨 Updating clipped artwork for ${id}`)
        updateArtwork(id, artwork)
      }
    }
    // アートワークが設定されていない場合、設定
    else if (!isSetArtwork(downloadedFilePath)) {
      logger.info(`🎨 Setting artwork for ${id}`)
      const artwork = await getArtworkData(id)
      if (artwork) {
        updateArtwork(id, Buffer.from(artwork))
      }
    }

    const filename = getFilename(config, track)

    // 異なるファイル名で同じIDが含まれているファイルを探し、削除
    const oldEqualFilename = fs.readdirSync('/data/tracks/').filter((file) => {
      const fileUrl = getId3TagFileUrl(`/data/tracks/${file}`)
      return file !== filename && fileUrl?.split('/').pop() === id
    })
    if (oldEqualFilename.length > 0) {
      for (const oldFile of oldEqualFilename) {
        logger.info(`🗑️ Deleting old file: ${oldFile}`)
        fs.unlinkSync(`/data/tracks/${oldFile}`)
      }
    }

    // 音声指紋を元にファイル内容が異なるかを確認
    // 同じな場合はスキップ
    if (
      fs.existsSync(`/data/tracks/${filename}`) &&
      getEchoPrint(`/data/tracks/${filename}`) ===
        getEchoPrint(downloadedFilePath)
    ) {
      logger.info(`⏭️ Skipping because the file is the same: ${id}`)
      return
    }

    // ファイルをコピー
    await new Promise<void>((resolve) => {
      fs.createReadStream(downloadedFilePath)
        .pipe(fs.createWriteStream(`/data/tracks/${filename}`))
        .on('finish', () => {
          resolve()
        })
    })

    // 一時ファイルを削除
    try {
      await fsPromises.unlink(downloadedFilePath)
    } catch {
      // ファイルが存在しない場合は何もしない
    }

    logger.info(`✅ Successfully processed ${id}`)

    const baseUrl = process.env.BASE_URL ?? undefined
    const editUrl = baseUrl ? `${baseUrl}?vid=${id}` : undefined

    await sendDiscordMessage(config, '', {
      title: `Downloaded ${id}`,
      url: editUrl,
      color: 0x00_ff_00,
      fields: [
        {
          name: 'Title',
          value: track.track ?? '*Unknown*',
          inline: true,
        },
        {
          name: 'Artist',
          value: track.artist ?? '*Unknown*',
          inline: true,
        },
        {
          name: 'Album',
          value: track.album ?? '*Unknown*',
          inline: true,
        },
        {
          name: 'YouTube',
          value: `https://youtu.be/${id}`,
          inline: true,
        },
      ],
    })
  }
}

/**
 * プレイリストから削除された動画の音楽ファイルを削除する
 *
 * @param ids プレイリストに含まれる動画 ID
 */
function deleteRemovedTracks(ids: string[]) {
  const logger = Logger.configure('deleteRemovedTracks')
  const files = fs.readdirSync('/data/tracks/')
  for (const file of files) {
    const fileUrl = getId3TagFileUrl(`/data/tracks/${file}`)
    if (!fileUrl) {
      continue
    }

    const id = fileUrl.split('/').pop()
    if (id && !ids.includes(id)) {
      logger.info(`🗑️ Deleting track: ${file}`)
      fs.unlinkSync(`/data/tracks/${file}`)
    }
  }
}

/**
 * m3u8 プレイリストファイルを作成する
 */
function createPlaylistFile() {
  const logger = Logger.configure('createPlaylistFile')
  // 相対パスで表記された m3u8 プレイリストを作成
  const files = fs.readdirSync('/data/tracks/')
  const playlist = files.filter((file) => file.endsWith('.mp3')).join('\n')
  const oldPlaylist = fs.existsSync('/data/tracks/YouTubeDownloadeds.m3u8')
    ? fs.readFileSync('/data/tracks/YouTubeDownloadeds.m3u8').toString()
    : ''
  if (playlist === oldPlaylist) {
    logger.info('⏭️ Skipping because the playlist is the same')
    return
  }
  fs.writeFileSync('/data/tracks/YouTubeDownloadeds.m3u8', playlist)
}

async function main() {
  const logger = Logger.configure('main')
  const config = getConfig()
  const playlistId = config.playlistId

  const runnerCountForDownload = process.env.RUNNER_COUNT_FOR_DOWNLOAD
    ? Number.parseInt(process.env.RUNNER_COUNT_FOR_DOWNLOAD, 10)
    : 3
  const runnerCountForProcessing = process.env.RUNNER_COUNT_FOR_PROCESSING
    ? Number.parseInt(process.env.RUNNER_COUNT_FOR_PROCESSING, 10)
    : 3

  logger.info('📝 Configuration:')
  logger.info(`  - Playlist ID: ${playlistId}`)
  logger.info(`  - Discord: ${config.discord ? 'Enabled' : 'Disabled'}`)
  logger.info(
    `  - Using normalize volume app: ${process.env.NORMALIZE_VOLUME_APP ?? 'mp3gain'}`,
  )
  logger.info(`  - Runner count for download: ${runnerCountForDownload}`)
  logger.info(`  - Runner count for processing: ${runnerCountForProcessing}`)

  logger.info('📁 Recreating directories...')
  recreateDirectories()

  logger.info('🗑️ Deleting yt-dlp cache...')
  removeCacheDir()

  logger.info(`📚 Getting playlist videos for ${playlistId}`)
  const ids = getPlaylistVideoIds(playlistId)

  logger.info(`🎥 Found ${ids.length} videos. Downloading...`)

  // プレイリスト動画をダウンロード
  const successfullyDownloadedIds = await new ParallelDownloadVideo(ids).runAll(
    runnerCountForDownload,
  )

  logger.info(
    `📥 Successfully downloaded ${successfullyDownloadedIds.length}/${ids.length} videos`,
  )

  if (successfullyDownloadedIds.length === 0) {
    logger.warn(
      '⚠️ No videos were successfully downloaded. Skipping processing.',
    )
    return
  }

  // ダウンロードしたプレイリスト動画を処理
  await new ParallelProcessVideo(successfullyDownloadedIds).runAll(
    runnerCountForProcessing,
  )

  // プレイリストにない音楽ファイルを削除
  logger.info('🗑️ Deleting playlist removed tracks...')
  deleteRemovedTracks(ids)

  // ダウンロードした音楽ファイルを元にプレイリストファイルを作成
  logger.info('📝 Creating playlist file...')
  createPlaylistFile()

  logger.info('🎉 Successfully finished!')
}

;(async () => {
  await main().catch((err: unknown) => {
    const logger = Logger.configure('main')
    logger.error('Error', err as Error)
  })
})()
