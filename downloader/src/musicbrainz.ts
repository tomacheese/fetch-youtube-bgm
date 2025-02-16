import axios from 'axios'
import { Logger } from '@book000/node-utils'

import DateTimeFormat = Intl.DateTimeFormat

interface IPeriod {
  begin: string
  ended: boolean
  end: string
}

interface IEntity {
  id: string
}

interface IArea extends IEntity {
  'iso-3166-1-codes': string[]
  name: string
  'sort-name': string
  disambiguation: string
}

interface IAlias extends IEntity {
  name: string
  'sort-name': string
  ended: boolean
  'type-id': string
  type: string
  locale: string
  primary: string
  begin: string
  end: string
}

interface IMatch {
  score: number
}

interface IArtist extends IEntity {
  name: string
  disambiguation: string
  'sort-name': string
  'type-id'?: string
  'gender-id'?: string
  'life-span'?: IPeriod
  country?: string
  ipis?: string[]
  isnis?: string[]
  aliases?: IAlias[]
  gender?: string
  type?: string
  area?: IArea
  begin_area?: IArea
  end_area?: IArea
  relations?: IRelation[]
  releases?: IRelease[]
  'release-groups'?: IReleaseGroup[]
}

interface IArtistCredit {
  artist: IArtist
  joinphrase: string
  name: string
}

interface ICollection extends IEntity {
  type: string
  name: string
  'type-id': string
  'recording-count': number
  editor: string
  'entity-type': string
}

interface IReleaseEvent {
  area?: IArea
  date?: string
}

interface ICoverArtArchive {
  count: number
  front: boolean
  darkened: boolean
  artwork: boolean
  back: boolean
}

interface IRelease extends IEntity {
  title: string
  'text-representation': { language: string; script: string }
  disambiguation: string
  asin: string
  'status-id': string
  packaging?: string
  status: string
  'packaging-id'?: string
  'release-events'?: IReleaseEvent[]
  date: string
  media: IMedium[]
  'cover-art-archive': ICoverArtArchive
  country: string
  quality: string
  barcode: string
  relations?: IRelation[]
  'artist-credit'?: IArtistCredit[]
  'release-group'?: IReleaseGroup
  collections?: ICollection[]
}

interface IRecording extends IEntity {
  video: boolean
  length: number
  title: string
  disambiguation: string
  isrcs?: string[]
  releases?: IRelease[]
  relations?: IRelation[]
  'artist-credit'?: IArtistCredit[]
  aliases?: IAlias[]
}

interface ITrack extends IEntity {
  position: number
  recording: IRecording
  number: string
  length: number
  title: string
  'artist-credit'?: IArtistCredit[]
}

interface IMedium {
  title: string
  format?: string
  'format-id': string
  tracks: ITrack[]
  'track-count': number
  'track-offset': number
  position: number
}

interface IReleaseGroup extends IEntity {
  count: number
  disambiguation?: string
  title: string
  'secondary-types': string[]
  'first-release-date': string
  'primary-type': string
  'primary-type-id'?: string
  'secondary-type-ids'?: string[]
  'sort-name': string
  'artist-credit': { artist: IArtist; name: string; joinphrase: string }[]
  releases?: IRelease[]
}

interface ISearchResult {
  created: DateTimeFormat
  count: number
  offset: number
}

interface IUrlList extends ISearchResult {
  urls: IUrlMatch[]
}

type RelationDirection = 'backward' | 'forward'

interface IRelation {
  'attribute-ids': unknown[]
  direction: RelationDirection
  'target-credit': string
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  end: null | unknown
  'source-credit': string
  ended: boolean
  'attribute-values': unknown[]
  attributes?: any[]
  type: string
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  begin?: null | unknown
  'target-type'?: 'url'
  'type-id': string
  url?: IUrl
  release?: IRelease
}

interface IRelationList {
  relations: IRelation[]
}

interface IUrl extends IEntity {
  id: string
  resource: string
  'relation-list'?: IRelationList[]
}

interface IUrlMatch extends IMatch, IUrl {}

interface VideoInformation {
  title: string
  artist: string
}

export class MusicBrainz {
  public static async searchUrl(url: string): Promise<IUrlList> {
    const endpointUrl = `https://musicbrainz.org/ws/2/url?query="${url}"&fmt=json`
    const response = await axios.get<IUrlList>(endpointUrl, {
      headers: {
        'User-Agent':
          'fetch-youtube-bgm (https://github.com/tomacheese/fetch-youtube-bgm)',
      },
    })

    if (response.status !== 200) {
      throw new Error(`Failed to fetch URL: ${endpointUrl}, Status: ${response.status}, Status Text: ${response.statusText}`)
    }

    return response.data
  }

  public static async getRelease(releaseId: string): Promise<IRelease> {
    const endpointUrl = `https://musicbrainz.org/ws/2/release/${releaseId}?inc=artists&fmt=json`
    const response = await axios.get<IRelease>(endpointUrl, {
      headers: {
        'User-Agent':
          'fetch-youtube-bgm (https://github.com/tomacheese/fetch-youtube-bgm)',
      },
    })

    if (response.status !== 200) {
      throw new Error(`Failed to fetch URL: ${response.status}`)
    }

    return response.data
  }

  public static async getTrackInfo(
    vid: string,
  ): Promise<VideoInformation | null> {
    const logger = Logger.configure('Musicbrainz.getTrackInfo')
    const youtubeUrls = [
      `https://www.youtube.com/watch?v=${vid}`,
      `https://youtu.be/${vid}`,
      `https://music.youtube.com/watch?v=${vid}`,
    ]
    let releaseId: string | null = null
    for (const url of youtubeUrls) {
      const searchResult = await this.searchUrl(url)
      if (searchResult.urls.length === 0) {
        continue
      }
      const urlMatch = searchResult.urls[0]
      if (urlMatch.resource === url) {
        const relations = urlMatch['relation-list']
        if (relations) {
          for (const relationList of relations) {
            for (const relation of relationList.relations) {
              if (!relation.release) {
                continue
              }
              releaseId = relation.release.id
              break
            }
          }
        }
      }
    }

    if (releaseId === null) {
      return null
    }
    logger.info(`🚀 Found release ID: ${releaseId}`)

    const release = await this.getRelease(releaseId)

    const title = release.title
    const artist = release['artist-credit']?.[0].artist.name ?? ''

    logger.info(`👀 Found track info: ${title} by ${artist}`)

    return { title, artist }
  }
}
