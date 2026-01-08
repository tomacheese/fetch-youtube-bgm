<script setup lang="ts">
import DarkModeSwitch from './components/DarkModeSwitch.vue'
import type { EditingTrack, Track } from './models/track'
import { getReadableError } from './server/utils/readable-error'

// --- data
/** トラック一覧 */
const tracks = ref<Track[]>([])
/** アーティスト定義済み非表示か */
const isHideDefinedArtist = ref(false)
/** ダウンロード済みのみ表示か */
const isOnlyDownloaded = ref(false)
/** 検索テキスト */
const searchText = ref('')
/** 未確認の WebhookTrack 数 */
const remainingWebhookTracks = ref(0)
/** 編集中トラック情報 */
const editingTrack = ref<EditingTrack>()
/** サムネイル解像度のフォールバック - vid ごとに現在の解像度インデックスを管理 */
const thumbnailResolutionIndex = ref<Record<string, number>>({})
const thumbnailResolutions = ['maxresdefault.jpg', 'sddefault.jpg', 'hqdefault.jpg', 'mqdefault.jpg', 'default.jpg']

// --- methods
/** サムネイルURL取得 */
function getThumbnailUrl(vid: string) {
  const index = thumbnailResolutionIndex.value[vid] || 0
  return `https://i.ytimg.com/vi/${vid}/${thumbnailResolutions[index]}`
}

/** サムネイルエラーハンドリング */
function handleThumbnailError(vid: string) {
  const currentIndex = thumbnailResolutionIndex.value[vid] || 0
  if (currentIndex < thumbnailResolutions.length - 1) {
    thumbnailResolutionIndex.value[vid] = currentIndex + 1
  }
}

/** すべてのトラックを取得する */
async function fetchTracks() {
  const res = await useFetch('/api/tracks')
  if (res.error.value) {
    alert(`Failed to get tracks: ${await getReadableError(res.error.value)}`)
  }
  if (!res.data.value) {
    alert('Failed to get tracks: data is null')
    return
  }
  tracks.value = res.data.value
}

/** 未確認の WebhookTrack 数を取得する */
async function fetchRemainingWebhookTracks() {
  const res = await useFetch('/api/webhook-tracks/')
  if (res.error.value) {
    alert(`Failed to get webhook tracks: ${await getReadableError(res.error.value)}`)
  }
  if (!res.data.value) {
    alert('Failed to get webhook tracks: data is null')
    return
  }
  remainingWebhookTracks.value = res.data.value.length
}

/** トラック編集画面を開く */
function openEditDialog(track: Track | null) {
  if (!track) {
    editingTrack.value = {
      vid: '',
      track: '',
      artist: '',
      album: '',
      albumArtist: '',
      isDownloaded: false,
      isNew: true,
      isWebhookTrack: false
    }
  } else {
    editingTrack.value = {
      vid: track.vid,
      track: track.track,
      artist: track.artist,
      album: track.album,
      albumArtist: track.albumArtist,
      isDownloaded: track.isDownloaded,
      isNew: false,
      isWebhookTrack: false
    }
  }
}

function openCheckWebhookTracksDialog() {
  editingTrack.value = {
    vid: '',
    track: '',
    artist: '',
    album: '',
    albumArtist: '',
    isDownloaded: false,
    isNew: false,
    isWebhookTrack: true
  }
}

function closeEditTrack() {
  editingTrack.value = undefined
  fetchTracks()
  fetchRemainingWebhookTracks()
}

// --- computed
const filteredTracks = computed(() => {
  return tracks.value.filter((t) => {
    if (isHideDefinedArtist.value && t.artist) {
      return false
    }
    if (isOnlyDownloaded.value && !t.isDownloaded) {
      return false
    }
    if (searchText.value) {
      const search = searchText.value.toLowerCase()
      if (
        ![t.track, t.artist, t.album, t.albumArtist].some((v) => v && v.toLowerCase().includes(search))
      ) {
        return false
      }
    }
    return true
  })
})

// --- mounted
onMounted(async () => {
  await fetchTracks()
  await fetchRemainingWebhookTracks()

  // 1分ごとに再取得する
  setInterval(() => {
    fetchTracks()
    fetchRemainingWebhookTracks()
  }, 60000)

  // ?vid=xxx があれば編集画面を開く
  const vid = new URLSearchParams(location.search).get('vid')
  if (!vid || !tracks.value) {
    return
  }

  const track = tracks.value.find(t => t.vid === vid)
  if (track) {
    openEditDialog(track)
  }
})
</script>

<template>
  <v-app>
    <v-container fluid>
      <div class="d-flex align-center justify-space-between">
        <div class="d-flex align-center">
          <v-switch v-model="isHideDefinedArtist" label="Hide artist defined" />
          <v-switch v-model="isOnlyDownloaded" class="mx-2" label="Show only downloaded" />
        </div>
        <v-spacer />
        <DownloadBtn class="mx-2" />
        <DarkModeSwitch />
      </div>

      <div class="mb-2">
        <v-btn block size="large" class="py-7" @click="openEditDialog(null)">
          ADD NEW TRACK
        </v-btn>
      </div>

      <div class="mb-6">
        <v-btn :disabled="remainingWebhookTracks == 0" block size="large" class="py-7" @click="openCheckWebhookTracksDialog">
          CHECK WEBHOOK TRACKS ({{ remainingWebhookTracks }} REMAINING)
        </v-btn>
      </div>

      <div>
        <v-text-field
          v-model="searchText"
          label="Search"
          placeholder="Search by track, artist, album, albumArtist"
          clearable
        />
      </div>

      <v-row>
        <v-col
          v-for="(item, i) in filteredTracks"
          :key="i"
          cols="12"
          md="6"
          lg="4"
          xl="3"
          class="py-1"
        >
          <v-card :class="item.isDownloaded ? '' : 'text-disabled'" height="100%" @click="openEditDialog(item)">
            <div class="d-flex flex-no-wrap justify-space-between">
              <div>
                <v-card-title class="text-h5 wrap-text">
                  {{ item.track }} - {{ item.artist }}
                </v-card-title>

                <v-card-subtitle>
                  Album: {{ item.album }} / AlbumArtist: {{ item.albumArtist }}
                </v-card-subtitle>
              </div>

              <v-avatar class="ma-3" size="100" rounded="0">
                <v-img 
                  :src="getThumbnailUrl(item.vid)" 
                  @error="handleThumbnailError(item.vid)" 
                />
              </v-avatar>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <EditTrack v-if="editingTrack" :track="editingTrack" @close="closeEditTrack()" />
    </v-container>
  </v-app>
</template>

<style>
.wrap-text {
  word-break: break-all;
  white-space: normal;
}
</style>
