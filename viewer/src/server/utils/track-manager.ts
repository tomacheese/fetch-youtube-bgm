import fs from 'fs'
import { FileTrack, ITracksFile } from '~~/src/models/track'

export class TrackManager {
  private static readonly tracksFile = process.env.TRACKS_FILE || 'data/tracks.json'
  private static readonly tracksDir = process.env.TRACKS_DIR || 'data/tracks/'

  private static trackFiles: string[] | undefined

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
    const tracks = this.getTracks()
    tracks[vid] = track
    fs.writeFileSync(this.tracksFile, JSON.stringify(tracks, null, 2))
  }

  public static delete(vid: string) {
    const tracks = this.getTracks()
    if (!tracks[vid]) {
      return
    }
    delete tracks[vid]
    fs.writeFileSync(this.tracksFile, JSON.stringify(tracks, null, 2))
  }

  public static getDownloadedTrackFiles() {
    if (!fs.existsSync(this.tracksDir)) {
      return []
    }
    if (this.trackFiles) {
      return this.trackFiles
    }
    this.trackFiles = fs.readdirSync(this.tracksDir).map(file => file.replace('.mp3', ''))
  }
}
