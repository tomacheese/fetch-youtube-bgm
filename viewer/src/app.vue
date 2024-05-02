<script setup lang="ts">
import DarkModeSwitch from './components/DarkModeSwitch.vue'
import { type Track } from './models/track'
import { getReadableError } from './server/utils/readable-error'

// --- data
/** トラック一覧 */
const tracks = ref<Track[]>([])
/** アーティスト定義済み非表示か */
const isHideDefinedArtist = ref(false)
/** ダウンロード済みのみ表示か */
const isOnlyDownloaded = ref(false)
/** 編集中トラック情報 */
const editingTrack = ref<Track>()

// --- methods
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
/** トラック編集画面を開く */
function openEditDialog(track: Track | null) {
  if (!track) {
    editingTrack.value = {
      vid: '',
      track: '',
      artist: '',
      album: '',
      albumArtist: '',
      isDownloaded: false
    }
  } else {
    editingTrack.value = track
  }
}
function closeEditTrack() {
  editingTrack.value = undefined
  fetchTracks()
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
    return true
  })
})

// --- mounted
onMounted(async () => {
  await fetchTracks()

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
          <v-switch v-model="isHideDefinedArtist" label="アーティスト定義済みを非表示" />
          <v-switch v-model="isOnlyDownloaded" class="mx-2" label="ダウンロード済みのみ表示" />
        </div>
        <v-spacer />
        <DownloadBtn class="mx-2" />
        <DarkModeSwitch />
      </div>

      <div class="mb-4">
        <v-btn block size="large" class="py-7" @click="openEditDialog(null)">
          ADD NEW TRACK
        </v-btn>
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
                <v-img :src="`https://i.ytimg.com/vi/${item.vid}/maxresdefault.jpg`" />
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
