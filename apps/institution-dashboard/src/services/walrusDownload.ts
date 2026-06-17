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
  const downloadBlob = await unwrapPlatformEncryptedDataset(blob)

  triggerBrowserDownload({ blob: downloadBlob, fileName })
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
    throw new Error('Cannot download because the Walrus blob ID is missing.')
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
        throw new Error(`Failed to download the Walrus blob. ${lastErrorMessage}`)
      }
    }

    if (attempt < 3) {
      await wait(700 * (attempt + 1))
    }
  }

  if (lastStatus === 404) {
    throw new Error('Walrus blob was not found. The testnet blob may have expired or not propagated yet; ask the participant to submit again from the user app.')
  }

  throw new Error(
    `Failed to download the Walrus blob. Please try again shortly. ${lastErrorMessage}`,
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
      throw new Error('Walrus aggregator response is delayed. Please try again shortly.', { cause: error })
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
      throw new Error(`Failed to download the Walrus blob. ${errorMessage}`)
    }

    return await response.blob()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Walrus blob download timed out. Please try again shortly.', { cause: error })
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function unwrapPlatformEncryptedDataset(blob: Blob) {
  const text = await blob.text()
  const envelope = parseJsonRecord(text)
  const encryption = asRecord(envelope?.encryption)

  if (encryption?.mode !== 'platform_encryption_v1') {
    return blob
  }

  const plaintext = await decryptPlatformEnvelope(envelope)
  const prettyJson = formatJsonForDownload(plaintext)

  return new Blob([prettyJson], {
    type: 'application/json',
  })
}

async function decryptPlatformEnvelope(envelope: Record<string, unknown> | null) {
  const projectPublicCode = readString(envelope?.projectPublicCode)
  const dataset = asRecord(envelope?.dataset)
  const encryption = asRecord(envelope?.encryption)
  const cipher = asRecord(envelope?.cipher)
  const algorithm = readString(encryption?.algorithm)
  const ciphertextBase64 = readString(cipher?.ciphertextBase64)
  const keyId = readString(encryption?.keyId)
  const nonceBase64 = readString(encryption?.nonceBase64)
  const privacyPolicyHash = readString(encryption?.privacyPolicyHash)
  const plaintextSha256 = readString(dataset?.plaintextSha256)

  if (!projectPublicCode || !algorithm || !ciphertextBase64 || !keyId || !nonceBase64) {
    throw new Error('The platform_encryption_v1 envelope is missing decryption metadata.')
  }

  const platformKeyHex = await derivePlatformEncryptionKeyHex({
    encryptionKeyId: keyId,
    privacyPolicyHash,
    projectPublicCode,
  })
  const ciphertext = base64ToBytes(ciphertextBase64)
  const nonce = base64ToBytes(nonceBase64)
  const plaintextBytes = algorithm === 'AES-GCM'
    ? await decryptAesGcm({ ciphertext, nonce, platformKeyHex })
    : await xorWithSha256KeyStream({ input: ciphertext, nonce, platformKeyHex })
  const plaintext = utf8Decode(plaintextBytes)

  if (plaintextSha256) {
    const actualHash = await sha256Hex(plaintext)

    if (actualHash !== plaintextSha256) {
      throw new Error('Downloaded dataset failed platform_encryption_v1 integrity verification.')
    }
  }

  return plaintext
}

async function decryptAesGcm({
  ciphertext,
  nonce,
  platformKeyHex,
}: {
  ciphertext: Uint8Array
  nonce: Uint8Array
  platformKeyHex: string
}) {
  const subtle = globalThis.crypto?.subtle

  if (!subtle) {
    throw new Error('This browser cannot decrypt AES-GCM platform_encryption_v1 datasets.')
  }

  const key = await subtle.importKey('raw', toArrayBuffer(hexToBytes(platformKeyHex)), { name: 'AES-GCM' }, false, ['decrypt'])
  const plaintext = await subtle.decrypt({ iv: toArrayBuffer(nonce), name: 'AES-GCM' }, key, toArrayBuffer(ciphertext))

  return new Uint8Array(plaintext)
}

async function derivePlatformEncryptionKeyHex({
  encryptionKeyId,
  privacyPolicyHash,
  projectPublicCode,
}: {
  encryptionKeyId: string
  privacyPolicyHash: string | null
  projectPublicCode: string
}) {
  return sha256Hex(
    ['modi', 'platform_encryption_v1', encryptionKeyId, projectPublicCode, privacyPolicyHash ?? 'no-policy'].join(':'),
  )
}

async function xorWithSha256KeyStream({
  input,
  nonce,
  platformKeyHex,
}: {
  input: Uint8Array
  nonce: Uint8Array
  platformKeyHex: string
}) {
  const output = new Uint8Array(input.length)
  const nonceBase64 = bytesToBase64(nonce)
  let offset = 0
  let counter = 0

  while (offset < input.length) {
    const block = hexToBytes(await sha256Hex(`${platformKeyHex}:${nonceBase64}:${counter}`))

    for (let index = 0; index < block.length && offset < input.length; index += 1) {
      output[offset] = input[offset] ^ block[index]
      offset += 1
    }

    counter += 1
  }

  return output
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

function parseJsonRecord(value: string) {
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return null
  }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function formatJsonForDownload(value: string) {
  try {
    return `${JSON.stringify(JSON.parse(value), null, 2)}\n`
  } catch {
    return value
  }
}

async function sha256Hex(value: string) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', utf8Encode(value))
  return bytesToHex(new Uint8Array(digest))
}

function base64ToBytes(value: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const cleanValue = value.replace(/=+$/g, '')
  const bytes: number[] = []
  let buffer = 0
  let bits = 0

  for (const char of cleanValue) {
    const index = chars.indexOf(char)

    if (index === -1) {
      continue
    }

    buffer = (buffer << 6) | index
    bits += 6

    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 255)
    }
  }

  return new Uint8Array(bytes)
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let index = 0

  for (; index + 2 < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2]
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + chars[chunk & 63]
  }

  if (index < bytes.length) {
    const remaining = bytes.length - index
    const chunk = (bytes[index] << 16) | (remaining === 2 ? bytes[index + 1] << 8 : 0)
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + (remaining === 2 ? chars[(chunk >> 6) & 63] : '=') + '='
  }

  return result
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }

  return bytes
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

function utf8Encode(value: string) {
  return new TextEncoder().encode(value)
}

function utf8Decode(value: Uint8Array) {
  return new TextDecoder().decode(value)
}
