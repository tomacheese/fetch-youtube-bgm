import fs from 'fs'
import { getConfig } from './configuration'
import { sendDiscordMessage } from './discord'
import {
  addId3Tag,
  addTrack,
  deleteDownloadMoviesDir,
  downloadVideo,
  getEchoPrint,
  getFilename,
  getHumanReadableSize,
  getId3TagFileUrl,
  getPlaylistVideoIds,
  getTrack,
  normalizeVolume,
  removeCacheDir,
} from './lib'
import { Logger } from '@book000/node-utils'

async function main() {
  const logger = Logger.configure('main')
  const config = getConfig()
  const playlistId = config.playlistId

  deleteDownloadMoviesDir()

  await removeCacheDir()

  logger.info(`📚 Getting playlist videos for ${playlistId}`)
  const ids = await getPlaylistVideoIds(playlistId)

  logger.info(`🎥 Found ${ids.length} videos. Downloading...`)

  // プレイリスト動画をダウンロード
  for (const id of ids) {
    logger.info(
      `📥 Downloading video ${id} (${ids.indexOf(id) + 1}/${ids.length})`
    )
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

  // ダウンロードしたプレイリスト動画を処理する
  for (const id of ids) {
    logger.info(`🎵 Processing ${id}`)

    // 登録されているトラック情報を取得
    const track = getTrack(id)
    if (!track.track) {
      // トラック情報がない場合は、デフォルト値を設定
      await addTrack(id)
    }

    // 音量を正規化・ID3タグを付与
    logger.info(`🔊 Normalizing volume of ${id}`)
    normalizeVolume(`/tmp/download-movies/${id}.mp3`)

    logger.info(`📃 Adding ID3 tag for ${track.vid}`)
    addId3Tag(track)

    const filename = getFilename(track)

    // タイトルが定義されている場合、古いファイル名（{videoId}.mp3）のファイルを削除
    if (filename !== `${id}.mp3` && fs.existsSync(`/data/tracks/${id}.mp3`)) {
      logger.info(`🗑️ Deleting old file: ${id}.mp3`)
      fs.unlinkSync(`/data/tracks/${id}.mp3`)
    }

    // ファイル内容が異なるかを確認
    // 同じな場合はスキップ
    if (
      fs.existsSync(`/data/tracks/${filename}`) &&
      getEchoPrint(`/data/tracks/${filename}`) ===
        getEchoPrint(`/tmp/download-movies/${id}.mp3`)
    ) {
      logger.info(`⏭️ Skipping because the file is the same: ${id}`)
      continue
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

  // プレイリストにない音楽ファイルを削除
  logger.info('🗑️ Deleting playlist removed tracks...')

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

  logger.info('🎉 Successfully finished!')
}

;(async () => {
  await main().catch(async (err) => {
    const logger = Logger.configure('main')
    logger.error('Error', err)
  })
})()
