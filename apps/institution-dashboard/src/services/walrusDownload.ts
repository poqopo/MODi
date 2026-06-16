const DEFAULT_WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space'
const WALRUS_CHECK_TIMEOUT_MS = 8000
const WALRUS_DOWNLOAD_TIMEOUT_MS = 120000

export async function downloadWalrusBlob({
  blobId,
  fileName,
  objectId,
}: {
  blobId: string
  fileName: string
  objectId?: string | null
}) {
  const downloadUrl = await resolveWalrusDownloadUrlWithRetry({ blobId, objectId })
  const blob = await fetchWalrusBlob(downloadUrl)

  triggerBrowserDownload({ blob, fileName })
}

function triggerBrowserDownload({ blob, fileName }: { blob: Blob; fileName: string }) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export function buildWalrusBlobUrl(blobId: string) {
  const aggregatorUrl = readWalrusAggregatorUrl().replace(/\/+$/g, '')
  return `${aggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}`
}

export function buildWalrusBlobObjectUrl(objectId: string) {
  const aggregatorUrl = readWalrusAggregatorUrl().replace(/\/+$/g, '')
  return `${aggregatorUrl}/v1/blobs/by-object-id/${encodeURIComponent(objectId)}`
}

async function resolveWalrusDownloadUrlWithRetry({
  blobId,
  objectId,
}: {
  blobId: string | null
  objectId?: string | null
}) {
  const urls = [
    ...(blobId ? [buildWalrusBlobUrl(blobId)] : []),
    ...(objectId ? [buildWalrusBlobObjectUrl(objectId)] : []),
  ]

  if (urls.length === 0) {
    throw new Error('Walrus blob ID가 없어 다운로드할 수 없습니다.')
  }

  let lastErrorMessage = ''
  let lastStatus = 0

  for (let attempt = 0; attempt < 4; attempt += 1) {
    for (const url of urls) {
      const response = await fetchWalrusHeaders(url)

      if (response.ok) {
        await response.body?.cancel().catch(() => undefined)
        return url
      }

      const responseText = await response.text().catch(() => '')
      lastStatus = response.status
      lastErrorMessage = readWalrusErrorMessage(responseText) || response.statusText

      if (response.status !== 404 && response.status !== 429 && response.status < 500) {
        throw new Error(`Walrus blob 다운로드에 실패했습니다. ${lastErrorMessage}`)
      }
    }

    if (attempt < 3) {
      await wait(700 * (attempt + 1))
    }
  }

  if (lastStatus === 404) {
    throw new Error('Walrus blob을 찾지 못했습니다. testnet blob이 만료됐거나 아직 전파되지 않았을 수 있으니 참가자가 user-app에서 데이터를 다시 제출해야 합니다.')
  }

  throw new Error(
    `Walrus blob 다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요. ${lastErrorMessage}`,
  )
}

async function fetchWalrusHeaders(url: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), WALRUS_CHECK_TIMEOUT_MS)

  try {
    return await fetch(url, {
      cache: 'no-store',
      headers: {
        Range: 'bytes=0-0',
      },
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Walrus aggregator 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.', { cause: error })
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchWalrusBlob(url: string) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), WALRUS_DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      const responseText = await response.text().catch(() => '')
      const errorMessage = readWalrusErrorMessage(responseText) || response.statusText
      throw new Error(`Walrus blob 다운로드에 실패했습니다. ${errorMessage}`)
    }

    return await response.blob()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Walrus blob 다운로드 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.', { cause: error })
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function readWalrusAggregatorUrl() {
  const value = import.meta.env.VITE_WALRUS_AGGREGATOR_URL?.trim()
  return value && /^https?:\/\//.test(value) ? value : DEFAULT_WALRUS_AGGREGATOR_URL
}

function readWalrusErrorMessage(value: string) {
  if (!value) {
    return ''
  }

  try {
    const parsed = JSON.parse(value) as { error?: { message?: unknown } }
    return typeof parsed.error?.message === 'string' ? parsed.error.message : value
  } catch {
    return value
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}
