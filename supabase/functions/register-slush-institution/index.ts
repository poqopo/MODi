import { createClient } from 'npm:@supabase/supabase-js@2.108.0'

type RegisterSlushInstitutionBody = {
  institutionName?: unknown
  walletAddress?: unknown
  websiteUrl?: unknown
}

type InstitutionWalletRow = {
  institution_id: string
  institution_name: string | null
  institution_slug: string | null
  wallet_address: string
}

type InstitutionRow = {
  id: string
  name: string
  slug: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, x-supabase-api-version, apikey, content-type, accept-profile, content-profile',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin, Access-Control-Request-Headers',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: getCorsHeaders(request),
      status: 204,
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = getSupabaseAdminKey()

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Supabase function secrets are not configured.' }, 500)
    }

    const body = (await request.json().catch(() => null)) as RegisterSlushInstitutionBody | null
    const walletAddress = normalizeSuiAddress(body?.walletAddress)

    if (!walletAddress) {
      return jsonResponse({ error: 'Valid walletAddress is required.' }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const registered = await findInstitutionByWallet(supabase, walletAddress)

    if (registered) {
      return jsonResponse({
        registered: true,
        institution: registered,
      })
    }

    const institutionName = readText(body?.institutionName)

    if (!institutionName) {
      return jsonResponse({
        registered: false,
        institution: null,
      })
    }

    const created = await createInstitutionForWallet({
      institutionName,
      supabase,
      walletAddress,
      websiteUrl: readText(body?.websiteUrl) || null,
    })

    return jsonResponse({
      registered: true,
      institution: created,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Slush institution registration error.'
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

function getCorsHeaders(request: Request) {
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers')

  return {
    ...corsHeaders,
    'Access-Control-Allow-Headers': requestedHeaders || corsHeaders['Access-Control-Allow-Headers'],
  }
}

async function findInstitutionByWallet(supabase: ReturnType<typeof createClient>, walletAddress: string) {
  const { data, error } = await supabase
    .from('institution_wallets')
    .select('institution_id,wallet_address,institution_name,institution_slug')
    .eq('wallet_address', walletAddress)
    .maybeSingle<InstitutionWalletRow>()

  if (error) {
    throw error
  }

  if (!data || !data.institution_name || !data.institution_slug) {
    return null
  }

  return {
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    institutionSlug: data.institution_slug,
    walletAddress: data.wallet_address,
  }
}

async function createInstitutionForWallet({
  institutionName,
  supabase,
  walletAddress,
  websiteUrl,
}: {
  institutionName: string
  supabase: ReturnType<typeof createClient>
  walletAddress: string
  websiteUrl: string | null
}) {
  const slugBase = slugify(institutionName) || 'institution'
  const walletSuffix = walletAddress.slice(-8)
  const slug = `${slugBase}-${walletSuffix}`

  const { data: institution, error: institutionError } = await supabase
    .from('institutions')
    .insert({
      name: institutionName,
      slug,
      website_url: websiteUrl,
    })
    .select('id,name,slug')
    .single<InstitutionRow>()

  if (institutionError) {
    throw institutionError
  }

  const { error: walletError } = await supabase
    .from('institution_wallets')
    .insert({
      institution_id: institution.id,
      institution_name: institution.name,
      institution_slug: institution.slug,
      wallet_address: walletAddress,
      role: 'owner',
    })

  if (walletError) {
    throw walletError
  }

  return {
    institutionId: institution.id,
    institutionName: institution.name,
    institutionSlug: institution.slug,
    walletAddress,
  }
}

function getSupabaseAdminKey() {
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS')

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, string | undefined>
      const defaultKey = secretKeys.default

      if (defaultKey) {
        return defaultKey
      }
    } catch {
      // Fall back to legacy single-key environment variables below.
    }
  }

  return (
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE') ??
    null
  )
}

function normalizeSuiAddress(value: unknown) {
  const text = readText(value).toLowerCase()
  return /^0x[0-9a-f]{64}$/.test(text) ? text : null
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
