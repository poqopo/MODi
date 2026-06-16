type ZkLoginSaltBody = {
  idToken?: unknown
  provider?: unknown
}

type GoogleTokenInfo = {
  aud?: string
  exp?: string
  iss?: string
  sub?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const saltSecret = Deno.env.get('ZKLOGIN_SALT_SECRET')

    if (!saltSecret) {
      return jsonResponse({ error: 'ZKLOGIN_SALT_SECRET is not configured.' }, 500)
    }

    const body = (await request.json().catch(() => null)) as ZkLoginSaltBody | null
    const provider = readRequiredText(body?.provider)
    const idToken = readRequiredText(body?.idToken)

    if (provider !== 'google') {
      return jsonResponse({ error: 'Only the google provider is supported.' }, 400)
    }

    if (!idToken) {
      return jsonResponse({ error: 'idToken is required.' }, 400)
    }

    const allowedAudiences = readAllowedAudiences()

    if (allowedAudiences.size === 0) {
      return jsonResponse({ error: 'ZKLOGIN_GOOGLE_CLIENT_IDS is not configured.' }, 500)
    }

    const tokenInfo = await verifyGoogleIdToken(idToken, allowedAudiences)
    const salt = await deriveSalt(saltSecret, tokenInfo)

    return jsonResponse({
      audience: tokenInfo.aud,
      provider: 'google',
      salt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown zkLogin salt error.'
    return jsonResponse({ error: message }, 500)
  }
})

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function verifyGoogleIdToken(idToken: string, allowedAudiences: Set<string>) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)

  if (!response.ok) {
    throw new Error('Google id_token verification failed.')
  }

  const tokenInfo = (await response.json()) as GoogleTokenInfo

  if (!tokenInfo.sub || !tokenInfo.aud || !tokenInfo.iss || !tokenInfo.exp) {
    throw new Error('Google id_token is missing required claims.')
  }

  if (tokenInfo.iss !== 'accounts.google.com' && tokenInfo.iss !== 'https://accounts.google.com') {
    throw new Error('Google id_token issuer is invalid.')
  }

  if (allowedAudiences.size > 0 && !allowedAudiences.has(tokenInfo.aud)) {
    throw new Error('Google id_token audience is not allowed.')
  }

  const expiresAtMs = Number(tokenInfo.exp) * 1000

  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error('Google id_token is expired.')
  }

  return tokenInfo
}

async function deriveSalt(secret: string, tokenInfo: GoogleTokenInfo) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      hash: 'SHA-256',
      name: 'HMAC',
    },
    false,
    ['sign'],
  )
  const digest = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${tokenInfo.iss}|${tokenInfo.aud}|${tokenInfo.sub}`)),
  )
  let salt = 0n

  for (const byte of digest.slice(0, 16)) {
    salt = (salt << 8n) + BigInt(byte)
  }

  return salt.toString()
}

function readAllowedAudiences() {
  const rawAudiences =
    Deno.env.get('ZKLOGIN_GOOGLE_CLIENT_IDS') ??
    Deno.env.get('ZKLOGIN_GOOGLE_CLIENT_ID') ??
    Deno.env.get('EXPO_PUBLIC_ZKLOGIN_GOOGLE_CLIENT_ID') ??
    ''

  return new Set(
    rawAudiences
      .split(',')
      .map((audience) => audience.trim())
      .filter(Boolean),
  )
}

function readRequiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
