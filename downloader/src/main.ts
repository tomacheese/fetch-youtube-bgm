import axios from 'axios'
import fs from 'fs'
import { getConfig } from './configuration'
import {
  addId3Tag,
  addTrack,
  downloadPlaylist,
  getFilename,
  getTrack,
  normalizeVolume,
} from './lib'

async function main() {
  const config = getConfig()
  const playlistId = config.playlistId

  const ids = await downloadPlaylist(playlistId)

  for (const id of ids) {
    console.log(`Processing ${id}`)
    const track = getTrack(id)
    if (!track.track) {
      await addTrack(id)
    }
    normalizeVolume(`/tmp/download-movies/${id}.mp3`)
    addId3Tag(track)

    const filename = getFilename(track)
    await new Promise<void>((resolve) => {
      fs.createReadStream(`/tmp/download-movies/${id}.mp3`)
        .pipe(fs.createWriteStream(`/data/tracks/${filename}`))
        .on('finish', () => {
          resolve()
        })
    })
    if (fs.existsSync(`/data/tracks/${id}.mp3`)) {
      fs.unlinkSync(`/data/tracks/${id}.mp3`)
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
