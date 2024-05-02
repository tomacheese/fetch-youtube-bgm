import type { FetchError } from 'ofetch'

export async function getReadableError(error: FetchError | null): Promise<string> {
  if (!error) {
    return 'Unknown error'
  }
  if (error.response) {
    const json = await error.response.json()
    if (json && json.message && typeof json.message === 'string') {
      return `${error.response.status} ${json.message}`
    }
    return `${error.response.status} ${error.response.statusText}`
  }
  return `${error.message}`
}
