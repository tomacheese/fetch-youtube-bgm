import axios from 'axios'
import { execSync } from 'child_process'
import fs from 'fs'
import NodeID3 from 'node-id3'

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

export async function getVideoInformation(vid: string) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`
  const response = await axios.get(url)
  if (response.status !== 200) {
    console.warn(`Failed to get video information for ${vid}`)
    return null
  }
  const { title, author_name: authorName } = response.data
  return {
    title,
    artist: authorName,
  }
}

export function addId3Tag(track: Track) {
  console.log(`Adding ID3 tag for ${track.vid}`)
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
  console.log(`Normalizing volume of ${file}`)
  execSync(`mp3gain -r -c -p "${file}"`)
}

export async function downloadPlaylist(playlistId: string) {
  console.log(`Downloading playlist ${playlistId}`)
  if (fs.existsSync('/tmp/download-movies/')) {
    fs.rmSync('/tmp/download-movies/', { recursive: true })
  }
  fs.mkdirSync('/tmp/download-movies/')

  const command = `yt-dlp --ignore-config -f "ba" -x --audio-format mp3 --embed-thumbnail -o "%(id)s.%(ext)s" https://www.youtube.com/playlist?list=${playlistId}`
  execSync(command, {
    cwd: '/tmp/download-movies/',
  })
  return fs
    .readdirSync('/tmp/download-movies/')
    .map((file) => file.replace('.mp3', ''))
}
