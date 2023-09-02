import fs from 'fs'
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
} from './lib'
import { Logger } from '@book000/node-utils'

/**
 * 動画をダウンロードする
 *
 * @param id 動画 ID
 */
async function runDownloadVideo(id: string) {
  const logger = Logger.configure(`runDownloadVideo#${id}`)
  // 3回までリトライする
  for (let i = 0; i < 3; i++) {
    const result = await downloadVideo(id)
    if (result) {
      const filesize = fs.statSync(`/tmp/download-movies/${id}.mp3`).size
      const humanFileSize = getHumanReadableSize(filesize)
      logger.info(`✅ Successfully downloaded ${id} (${humanFileSize})`)
      break
    }
    logger.info(`❌ Failed to download ${id}. Retry after 3 seconds...`)
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  if (!fs.existsSync(`/tmp/download-movies/${id}.mp3`)) {
    throw new Error(`Failed to download ${id}`)
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
 */
async function processVideo(id: string) {
  const logger = Logger.configure(`processVideo#${id}`)
  const config = getConfig()

  let videoInfo = await getVideoInformation(id)
  if (!videoInfo) {
    // retry
    logger.info(`❌ Failed to get video information. Retry after 5 seconds...`)
    await new Promise((resolve) => setTimeout(resolve, 5000))
    videoInfo = await getVideoInformation(id)
  }
  if (videoInfo) {
    logger.info(`📺 ${videoInfo.title}`)
    logger.info(`🎤 ${videoInfo.artist}`)
  }

  // 登録されているトラック情報を取得
  const track = getTrack(id)
  if (!track.track) {
    // トラック情報がない場合は、デフォルト値を設定
    await addTrack(id, videoInfo)
  }

  // 音量を正規化
  logger.info(`🔊 Normalizing volume of ${id}`)
  normalizeVolume(`/tmp/download-movies/${id}.mp3`)

  // ID3タグを付与
  logger.info(`📃 Adding ID3 tag for ${track.vid}`)
  addId3Tag(track)

  // トピック(YouTube Music)の場合、アートワークの更新をする
  if (videoInfo && videoInfo.artist.endsWith(' - Topic')) {
    const artwork = await getClippedArtwork(id)
    if (artwork) {
      logger.info(`🎨 Updating artwork for ${id}`)
      updateArtwork(id, artwork)
    }
  }

  const filename = getFilename(track)

  // タイトルが定義されている場合、古いファイル名（{videoId}.mp3）のファイルを削除
  if (filename !== `${id}.mp3` && fs.existsSync(`/data/tracks/${id}.mp3`)) {
    logger.info(`🗑️ Deleting old file: ${id}.mp3`)
    fs.unlinkSync(`/data/tracks/${id}.mp3`)
  }

  // 音声指紋を元にファイル内容が異なるかを確認
  // 同じな場合はスキップ
  if (
    fs.existsSync(`/data/tracks/${filename}`) &&
    getEchoPrint(`/data/tracks/${filename}`) ===
      getEchoPrint(`/tmp/download-movies/${id}.mp3`)
  ) {
    logger.info(`⏭️ Skipping because the file is the same: ${id}`)
    return
  }

  // ファイルをコピー
  await new Promise<void>((resolve) => {
    fs.createReadStream(`/tmp/download-movies/${id}.mp3`)
      .pipe(fs.createWriteStream(`/data/tracks/${filename}`))
      .on('finish', () => {
        resolve()
      })
  })

  // 一時ファイルを削除
  if (fs.existsSync(`/tmp/download-movies/${id}.mp3`)) {
    fs.unlinkSync(`/tmp/download-movies/${id}.mp3`)
  }

  logger.info(`✅ Successfully processed ${id}`)

  sendDiscordMessage(config, '', {
    title: `Downloaded ${id}`,
    url: `https://youtu.be/${id}`,
    color: 0x00ff00,
    fields: [
      {
        name: 'Title',
        value: track.track || '*Unknown*',
      },
      {
        name: 'Artist',
        value: track.artist || '*Unknown*',
      },
      {
        name: 'Album',
        value: track.album || '*Unknown*',
      },
    ],
  })
}

/**
 * プレイリストから削除された動画の音楽ファイルを削除する
 *
 * @param ids プレイリストに含まれる動画 ID
 */
async function deleteRemovedTracks(ids: string[]) {
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
async function createPlaylistFile() {
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

  logger.info('📁 Recreating directories...')
  recreateDirectories()

  logger.info('🗑️ Deleting yt-dlp cache...')
  await removeCacheDir()

  logger.info(`📚 Getting playlist videos for ${playlistId}`)
  const ids = await getPlaylistVideoIds(playlistId)

  logger.info(`🎥 Found ${ids.length} videos. Downloading...`)

  // プレイリスト動画をダウンロード
  for (const id of ids) {
    logger.info(
      `📥 Downloading video ${id} (${ids.indexOf(id) + 1}/${ids.length})`,
    )
    await runDownloadVideo(id)
  }

  // ダウンロードしたプレイリスト動画を処理
  for (const id of ids) {
    logger.info(`🎵 Processing ${id}`)
    await processVideo(id)
  }

  // プレイリストにない音楽ファイルを削除
  logger.info('🗑️ Deleting playlist removed tracks...')
  await deleteRemovedTracks(ids)

  // ダウンロードした音楽ファイルを元にプレイリストファイルを作成
  logger.info('📝 Creating playlist file...')
  await createPlaylistFile()

  logger.info('🎉 Successfully finished!')
}

;(async () => {
  await main().catch(async (err) => {
    const logger = Logger.configure('main')
    logger.error('Error', err)
  })
})()
