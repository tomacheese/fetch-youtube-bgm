<script setup lang="ts">
function downloadJson() {
  useFetch('/api/tracks-raw')
    .then((response) => {
      if (!response.data.value) {
        return
      }

      const blob = new Blob([JSON.stringify(response.data.value)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'export-video-informations.json'
      link.click()
    })
}
</script>

<template>
  <v-btn elevation="2" icon="mdi-download" @click="downloadJson()" />
</template>
