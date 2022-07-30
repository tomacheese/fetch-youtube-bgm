import fs from 'fs'

interface Config {
  playlistId: string
}

export function getConfig() {
  const config = JSON.parse(
    fs.readFileSync('./config.json').toString()
  ) as Config
  return config
}
