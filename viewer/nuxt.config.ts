const baseName = process.env.BASE_NAME || 'fetch-youtube-bgm'
const baseDescription = process.env.BASE_DESCRIPTION || 'fetch-youtube-bgm'
const baseUrl = process.env.BASE_URL || 'http://192.168.0.101:7001'
const isDev = process.env.NODE_ENV === 'development'
const isSsr = true

export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: {
        lang: 'ja'
      },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'apple-mobile-web-app-title', content: baseName },
        { name: 'application-name', content: baseName },
        { name: 'msapplication-TileColor', content: '#ff0000' },
        { name: 'theme-color', content: '#ff0000' },
        { key: 'description', name: 'description', content: baseDescription },
        { key: 'og:site_name', property: 'og:site_name', content: baseName },
        { key: 'og:type', property: 'og:type', content: 'article' },
        { key: 'og:url', property: 'og:url', content: baseUrl },
        { key: 'og:title', property: 'og:title', content: baseName },
        {
          key: 'og:description',
          property: 'og:description',
          content: baseDescription
        },
        {
          key: 'twitter:card',
          name: 'twitter:card',
          content: 'summary'
        },
        {
          key: 'msapplication-TileColor',
          name: 'msapplication-TileColor',
          content: '#ff0000'
        },
        {
          key: 'theme-color',
          name: 'theme-color',
          content: '#ff0000'
        }
      ],
      noscript: [{ children: 'This website requires JavaScript.' }]
    }
  },

  srcDir: 'src/',

  ssr: isSsr,

  typescript: {
    typeCheck: isDev,
    strict: true
  },

  vite: {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    plugins: [isDev ? require('vite-plugin-eslint')() : undefined]
  },

  build: {
    transpile: ['vuetify']
  },

  css: [
    'vuetify/lib/styles/main.sass',
    '@mdi/font/css/materialdesignicons.min.css'
  ],

  modules: [
    '@nuxt/eslint'
  ],

  compatibilityDate: '2024-07-07',
})
