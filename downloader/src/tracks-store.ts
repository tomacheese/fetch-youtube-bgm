import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/** 共有ファイルの更新を直列化し、読み手には完全な JSON のみを公開する。 */
export function updateTracks<T>(file: string, update: (tracks: T) => void): T {
  const lock = `${file}.lock`
  const deadline = Date.now() + 10_000
  const wait = new Int32Array(new SharedArrayBuffer(4))
  for (;;) {
    try {
      fs.mkdirSync(lock)
      break
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'EEXIST' ||
        Date.now() >= deadline
      ) {
        throw error
      }
      Atomics.wait(wait, 0, 0, 25)
    }
  }
  let temp: string | undefined
  try {
    const tracks = (
      fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
    ) as T
    update(tracks)
    temp = path.join(
      path.dirname(file),
      `.${path.basename(file)}.${randomUUID()}.tmp`,
    )
    const mode = fs.existsSync(file) ? fs.statSync(file).mode : 0o666
    fs.writeFileSync(temp, JSON.stringify(tracks), { flag: 'wx', mode })
    fs.renameSync(temp, file)
    return tracks
  } finally {
    try {
      if (temp && fs.existsSync(temp)) fs.unlinkSync(temp)
    } finally {
      fs.rmdirSync(lock)
    }
  }
}
