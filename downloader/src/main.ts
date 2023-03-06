import axios from 'axios'
import fs from 'fs'
import { getConfig } from './configuration'
import {
  addId3Tag,
  addTrack,
  deleteDownloadMoviesDir,
  downloadVideo,
  getEchoPrint,
  getFilename,
  getId3TagFileUrl,
  getPlaylistVideoIds,
  getTrack,
  normalizeVolume,
  removeCacheDir,
} from './lib'

async function main() {
  const config = getConfig()
  const playlistId = config.playlistId

  deleteDownloadMoviesDir()

  await removeCacheDir()

  const ids = await getPlaylistVideoIds(playlistId)

  console.log(`Found ${ids.length} videos. Download...`)

  // プレイリスト動画をダウンロード
  for (const id of ids) {
    // 3回までリトライする
    for (let i = 0; i < 3; i++) {
      const result = await downloadVideo(id)
      if (result) {
        console.log(`Successfully downloaded ${id}`)
        break
      }
      console.log(`Failed to download ${id}. Retry...`)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    if (!fs.existsSync(`/tmp/download-movies/${id}.mp3`)) {
      throw new Error(`Failed to download ${id}`)
    }
  }

  // ダウンロードしたプレイリスト動画を処理する
  for (const id of ids) {
    console.log(`Processing ${id}`)

    // 登録されているトラック情報を取得
    const track = getTrack(id)
    if (!track.track) {
      // トラック情報がない場合は、デフォルト値を設定
      await addTrack(id)
    }

    // 音量を正規化・ID3タグを付与
    normalizeVolume(`/tmp/download-movies/${id}.mp3`)
    addId3Tag(track)

    const filename = getFilename(track)

    // タイトルが定義されている場合、古いファイル名（{videoId}.mp3）のファイルを削除
    if (filename !== `${id}.mp3` && fs.existsSync(`/data/tracks/${id}.mp3`)) {
      fs.unlinkSync(`/data/tracks/${id}.mp3`)
    }

    // ファイル内容が異なるかを確認
    // 同じな場合はスキップ
    if (
      fs.existsSync(`/data/tracks/${filename}`) &&
      getEchoPrint(`/data/tracks/${filename}`) ===
        getEchoPrint(`/tmp/download-movies/${id}.mp3`)
    ) {
      console.log(`Skip ${id}`)
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

    // メタデータが未定義かを確認し、未定義だったら通知
    if (!track.track) {
      await axios
        .post('http://discord-deliver', {
          embed: {
            title: `Downloaded ${id}`,
            url: `https://youtu.be/${id}`,
            color: 0x00ff00,
          },
        })
        .catch(() => null)
    }
  }

  // プレイリストにない音楽ファイルを削除
  console.log('Deleting playlist removed tracks...')

  const files = fs.readdirSync('/data/tracks/')
  for (const file of files) {
    console.log(`Processing ${file}`)
    const fileUrl = getId3TagFileUrl(`/data/tracks/${file}`)
    if (!fileUrl) {
      continue
    }

    const id = fileUrl.split('/').pop()
    if (id && !ids.includes(id)) {
      console.log(`Deleting ${file}`)
      fs.unlinkSync(`/data/tracks/${file}`)
    }
  }

  console.log('Done')
}

;(async () => {
  await main().catch(async (err) => {
    console.error(err)
    await axios
      .post('http://discord-deliver', {
        embed: {
          title: `Error`,
          description: `${err.message}`,
          color: 0xff0000,
        },
      })
      .catch(() => null)
  })
})()
