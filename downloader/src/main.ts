import axios from 'axios'
import fs from 'fs'
import { getConfig } from './configuration'
import {
  addId3Tag,
  addTrack,
  downloadPlaylist,
  getFilename,
  getId3TagFileUrl,
  getTrack,
  normalizeVolume,
} from './lib'

async function main() {
  const config = getConfig()
  const playlistId = config.playlistId

  const ids = await downloadPlaylist(playlistId)

  console.log(`Downloaded ${ids.length} videos. Processing...`)

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
