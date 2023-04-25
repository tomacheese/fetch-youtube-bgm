<script setup lang="ts">
import { VForm } from 'vuetify/components'
import { Track } from '../models/track'
import { YouTubeOembed } from '../models/youtube-oembed'
import { getReadableError } from '../server/utils/readable-error'

// --- emits

// eslint-disable-next-line func-call-spacing
const emit = defineEmits<{
  (e: 'close'): void
}>()

// --- props
/** トラック */
const track = defineProps<{ track: Track }>()

// --- data
/** ダイヤログ表示有無 */
const isActiveDialog = ref(true)
/** 編集中トラック情報 */
const editingTrack = ref<Track>({
  vid: '',
  track: '',
  artist: '',
  album: '',
  albumArtist: '',
  isDownloaded: false
})
/** 保存中か */
const loading = ref(false)
/** 保存成功 */
const isSaved = ref(false)
/** 保存失敗 */
const isSaveFailed = ref(false)
/** 削除成功 */
const isDeleted = ref(false)
/** 削除失敗 */
const isDeleteFailed = ref(false)
/** YouTubeからの動画情報取得失敗か */
const isFetchFailed = ref(false)
/** 失敗理由 */
const failedMessage = ref('')

// --- data validation
const isRequired = (value: string) => !!value || 'Required.'

// --- refs
const form = ref<VForm>()

// --- methods
/** YouTube URLから動画 IDを取得する */
function getVideoId(url: string) {
  const ytLongUrlRegex = /https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/
  const ytShortUrlRegex = /https:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/

  const ytLongUrlMatch = url.match(ytLongUrlRegex)
  if (ytLongUrlMatch) {
    return ytLongUrlMatch[1]
  }
  const ytShortUrlMatch = url.match(ytShortUrlRegex)
  if (ytShortUrlMatch) {
    return ytShortUrlMatch[1]
  }

  return null
}

/** YouTubeから動画情報を取得する */
function getVideoInfo() {
  const vid = getVideoId(editingTrack.value.vid)
  if (vid) {
    editingTrack.value.vid = vid
  }

  useFetch<YouTubeOembed>(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${editingTrack.value.vid}&format=json`)
    .then((response) => {
      if (!response.data.value) {
        return
      }
      editingTrack.value.track = response.data.value.title
      editingTrack.value.artist = response.data.value.author_name
    })
    .catch((error) => {
      alert(`Failed to get video info: ${error}`)
    })
}

/** トラックを保存する */
function submitForm() {
  form.value?.validate().then((result) => {
    if (!result.valid) {
      return
    }
    loading.value = true
    useFetch(`/api/tracks/${editingTrack.value.vid}`, {
      // @ts-ignore
      method: 'PATCH',
      body: JSON.stringify(editingTrack.value)
    })
      .then((response) => {
        if (response.error.value) {
          getReadableError(response.error.value).then((message) => {
            failedMessage.value = message
          })
          isSaveFailed.value = true
          return
        }
        isSaved.value = true

        setTimeout(() => {
          isActiveDialog.value = false
        }, 3000)
      })
      .catch((error) => {
        failedMessage.value = String(error)
        isSaveFailed.value = true
      })
      .finally(() => {
        loading.value = false
      })
  })
}

function deleteTrack() {
  if (!confirm('このトラックを削除しますか？')) {
    return
  }
  loading.value = true
  useFetch(`/api/tracks/${editingTrack.value.vid}`, {
    // @ts-ignore
    method: 'DELETE'
  })
    .then((response) => {
      if (response.error.value) {
        getReadableError(response.error.value).then((message) => {
          failedMessage.value = message
        })
        isDeleteFailed.value = true
        return
      }
      isDeleted.value = true

      setTimeout(() => {
        isActiveDialog.value = false
      }, 3000)
    })
    .catch((error) => {
      failedMessage.value = String(error)
      isDeleteFailed.value = true
    })
    .finally(() => {
      loading.value = false
    })
}

// --- watch
/** 保存失敗フラグが false になったら = スナックバーが閉じたら失敗理由をクリアする */
watch(isSaveFailed, (value, oldValue) => {
  if (oldValue && !value) {
    failedMessage.value = ''
  }
})
/** YouTubeからの動画情報取得失敗フラグが false になったら = スナックバーが閉じたら失敗理由をクリアする */
watch(isFetchFailed, (value, oldValue) => {
  if (oldValue && !value) {
    failedMessage.value = ''
  }
})

watch(isActiveDialog, (value, oldValue) => {
  if (oldValue && !value) {
    emit('close')
  }
})

// --- onMounted
onMounted(() => {
  editingTrack.value = { ...track.track }
})
</script>

<template>
  <div>
    <v-dialog v-model="isActiveDialog" persistent>
      <v-form ref="form" class="scrollable-form">
        <v-card>
          <v-card-title>Create or Edit track</v-card-title>

          <v-card-text>
            <iframe
              v-if="editingTrack.vid"
              :src="`https://www.youtube.com/embed/${editingTrack.vid}`"
              title="YouTube video player"
              frameborder="0"
              height="320"
              width="100%"
            />
            <v-text-field
              v-model="editingTrack.vid"
              label="YouTube Video Id (Or URL)"
              required
              :rules="[isRequired]"
              @blur="getVideoInfo()"
            />
            <v-text-field v-model="editingTrack.track" label="Title" required :rules="[isRequired]" />
            <v-text-field v-model="editingTrack.artist" label="Artist" hint="Multiple artists can be separated by commas." />
            <v-text-field v-model="editingTrack.album" label="Album" />
            <v-text-field v-model="editingTrack.albumArtist" label="AlbumArtist" />
          </v-card-text>

          <v-card-actions>
            <v-btn color="orange" variant="tonal" @click="isActiveDialog = false">
              Cancel
            </v-btn>
            <v-btn color="error" variant="tonal" @click="deleteTrack()">
              Delete
            </v-btn>
            <v-spacer />
            <v-btn color="success" variant="tonal" :loading="loading" :disabled="isSaved" @click="submitForm()">
              <span v-if="!isSaved">Save</span>
              <v-icon v-else>
                mdi-check
              </v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-form>
    </v-dialog>

    <v-snackbar v-model="isSaved" color="success">
      <v-icon>mdi-check</v-icon>
      Track saved. Close this dialog after 3 seconds.
      <template #action="{ attrs }">
        <v-btn text v-bind="attrs" @click="isSaved = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
    <v-snackbar v-model="isDeleted" color="success">
      <v-icon>mdi-check</v-icon>
      Track deleted. Close this dialog after 3 seconds.
      <template #action="{ attrs }">
        <v-btn text v-bind="attrs" @click="isSaved = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
    <v-snackbar v-model="isSaveFailed" color="error">
      <v-icon>mdi-close</v-icon>
      Failed to save track: {{ failedMessage }}
      <template #action="{ attrs }">
        <v-btn text v-bind="attrs" @click="isSaveFailed = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
    <v-snackbar v-model="isSaveFailed" color="error">
      <v-icon>mdi-close</v-icon>
      Failed to delete track: {{ failedMessage }}
      <template #action="{ attrs }">
        <v-btn text v-bind="attrs" @click="isSaveFailed = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
    <v-snackbar v-model="isFetchFailed" color="error">
      <v-icon>mdi-close</v-icon>
      Failed to fetch youtube video: {{ failedMessage }}
      <template #action="{ attrs }">
        <v-btn text v-bind="attrs" @click="isFetchFailed = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<style scoped>
.scrollable-form {
  overflow-y: scroll;
}
</style>
