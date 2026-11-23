import fs from 'fs'
import type { FileTrack, ITracksFile } from '~~/src/models/track'
import { updateTracks } from './tracks-store'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TrackManager {
  private static readonly tracksFile = process.env.TRACKS_FILE || 'data/tracks.json'
  private static readonly tracksDir = process.env.TRACKS_DIR || 'data/tracks/'

  private static trackFiles: string[] | undefined
  private static lastLoadedAt: number | undefined

  public static getTracks(): ITracksFile {
    if (!fs.existsSync(this.tracksFile)) {
      return {}
    }
    const data = fs.readFileSync(this.tracksFile, 'utf8')
    return JSON.parse(data) as ITracksFile
  }

  public static getTrack(vid: string): FileTrack | undefined {
    const tracks = this.getTracks()
    return tracks[vid]
  }

  public static set(vid: string, track: FileTrack) {
    updateTracks<ITracksFile>(this.tracksFile, (tracks) => {
      tracks[vid] = track
    })
  }

  public static delete(vid: string) {
    updateTracks<ITracksFile>(this.tracksFile, (tracks) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete tracks[vid]
    })
  }

  public static getDownloadedTrackFiles() {
    if (!fs.existsSync(this.tracksDir)) {
      return []
    }
    if (this.trackFiles && this.lastLoadedAt && Date.now() - this.lastLoadedAt < 600000) {
      return this.trackFiles
    }
    this.trackFiles = fs.readdirSync(this.tracksDir).map(file => file.replace('.mp3', ''))
    this.lastLoadedAt = Date.now()
    return this.trackFiles
  }
}
