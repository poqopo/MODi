import * as AuthSession from 'expo-auth-session'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { EnokiClient } from '@mysten/enoki'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { decodeJwt, generateNonce, jwtToAddress, type ZkLoginSignatureInputs } from '@mysten/sui/zklogin'
import { Platform } from 'react-native'

import { getSupabaseClient, isSupabaseConfigured } from './supabase'

WebBrowser.maybeCompleteAuthSession()

declare const process: {
  env: {
    EXPO_PUBLIC_ENOKI_ADDITIONAL_EPOCHS?: string
    EXPO_PUBLIC_ENOKI_API_KEY?: string
    EXPO_PUBLIC_ENOKI_API_URL?: string
    EXPO_PUBLIC_SUI_NETWORK?: string
    EXPO_PUBLIC_ZKLOGIN_GOOGLE_ANDROID_CLIENT_ID?: string
    EXPO_PUBLIC_ZKLOGIN_GOOGLE_CLIENT_ID?: string
    EXPO_PUBLIC_ZKLOGIN_GOOGLE_IOS_CLIENT_ID?: string
    EXPO_PUBLIC_ZKLOGIN_GOOGLE_WEB_CLIENT_ID?: string
    EXPO_PUBLIC_ZKLOGIN_SALT_FUNCTION?: string
  }
}

type SuiNetwork = 'devnet' | 'mainnet' | 'testnet'
type ZkLoginProvider = 'enoki' | 'local-salt'
type ZkLoginNonceContext = {
  enokiClient: EnokiClient | null
  maxEpoch: number
  nonce: string
  provider: ZkLoginProvider
  randomness: string
}

export type ZkLoginSession = {
  authProvider: 'google'
  audience: string
  enokiPublicKey?: string
  ephemeralSecretKey: string
  jwt: string
  loginId: string
  maxEpoch: number
  network: SuiNetwork
  proof?: ZkLoginSignatureInputs
  randomness: string
  salt: string
  suiAddress: string
  zkLoginProvider: ZkLoginProvider
}

const zkLoginSessionKey = 'modi.zklogin.session.v1'

const fullnodeUrls: Record<SuiNetwork, string> = {
  devnet: 'https://fullnode.devnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}

const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
}

export function isZkLoginConfigured() {
  return Boolean(readGoogleClientId() && (readEnokiApiKey() || isSupabaseConfigured))
}

export function getZkLoginConfigStatus() {
  const missing = []

  if (!readGoogleClientId()) {
    missing.push('EXPO_PUBLIC_ZKLOGIN_GOOGLE_*_CLIENT_ID')
  }

  if (!readEnokiApiKey() && !isSupabaseConfigured) {
    missing.push('EXPO_PUBLIC_ENOKI_API_KEY or EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  }

  return {
    isConfigured: missing.length === 0,
    missing,
  }
}

export async function signInWithGoogleZkLogin(): Promise<ZkLoginSession> {
  const clientId = readGoogleClientId()

  if (!clientId) {
    throw new Error('Google zkLogin client ID is not configured.')
  }

  if (!readEnokiApiKey() && !isSupabaseConfigured) {
    throw new Error('Enoki or Supabase is required for zkLogin.')
  }

  const network = readSuiNetwork(process.env.EXPO_PUBLIC_SUI_NETWORK)
  const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(Crypto.getRandomBytes(32))
  const nonceContext = await createZkLoginNonceContext({ ephemeralKeyPair, network })
  const idToken = await requestGoogleIdToken({
    clientId,
    nonce: nonceContext.nonce,
  })

  const decodedJwt = decodeJwt(idToken)
  const audience = readAudience(decodedJwt.aud)
  const loginResult = await resolveZkLoginResult({
    enokiClient: nonceContext.enokiClient,
    ephemeralKeyPair,
    jwt: idToken,
    maxEpoch: nonceContext.maxEpoch,
    network,
    randomness: nonceContext.randomness,
  })
  const session: ZkLoginSession = {
    authProvider: 'google',
    audience,
    enokiPublicKey: loginResult.enokiPublicKey,
    ephemeralSecretKey: ephemeralKeyPair.getSecretKey(),
    jwt: idToken,
    loginId: loginResult.suiAddress,
    maxEpoch: nonceContext.maxEpoch,
    network,
    proof: loginResult.proof,
    randomness: nonceContext.randomness,
    salt: loginResult.salt,
    suiAddress: loginResult.suiAddress,
    zkLoginProvider: loginResult.provider,
  }

  await persistZkLoginSession(session)
  return session
}

async function createZkLoginNonceContext({
  ephemeralKeyPair,
  network,
}: {
  ephemeralKeyPair: Ed25519Keypair
  network: SuiNetwork
}): Promise<ZkLoginNonceContext> {
  const enokiClient = createEnokiClient()

  if (enokiClient) {
    try {
      const nonce = await enokiClient.createZkLoginNonce({
        network,
        ephemeralPublicKey: ephemeralKeyPair.getPublicKey(),
      })

      return {
        enokiClient,
        maxEpoch: nonce.maxEpoch,
        nonce: nonce.nonce,
        provider: 'enoki',
        randomness: nonce.randomness,
      }
    } catch (error) {
      if (!isSupabaseConfigured) {
        throw error
      }
    }
  }

  const currentEpoch = await fetchCurrentEpoch(network)
  const maxEpoch = currentEpoch + 2
  const randomness = generateZkLoginRandomness()

  return {
    enokiClient: null,
    maxEpoch,
    nonce: generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness),
    provider: 'local-salt',
    randomness,
  }
}

async function resolveZkLoginResult({
  enokiClient,
  ephemeralKeyPair,
  jwt,
  maxEpoch,
  network,
  randomness,
}: {
  enokiClient: EnokiClient | null
  ephemeralKeyPair: Ed25519Keypair
  jwt: string
  maxEpoch: number
  network: SuiNetwork
  randomness: string
}) {
  if (enokiClient) {
    try {
      const [{ address, publicKey, salt }, proof] = await Promise.all([
        enokiClient.getZkLogin({ jwt }),
        enokiClient.createZkLoginZkp({
          jwt,
          maxEpoch,
          network,
          randomness,
          ephemeralPublicKey: ephemeralKeyPair.getPublicKey(),
        }),
      ])

      return {
        enokiPublicKey: publicKey,
        proof,
        provider: 'enoki' as const,
        salt,
        suiAddress: address,
      }
    } catch (error) {
      if (!isSupabaseConfigured) {
        throw error
      }
    }
  }

  const salt = await fetchZkLoginSalt(jwt)

  return {
    enokiPublicKey: undefined,
    proof: undefined,
    provider: 'local-salt' as const,
    salt,
    suiAddress: jwtToAddress(jwt, salt, false),
  }
}

export async function getStoredZkLoginSession() {
  try {
    const isAvailable = await SecureStore.isAvailableAsync()
    if (!isAvailable) return null

    const serialized = await SecureStore.getItemAsync(zkLoginSessionKey)
    return serialized ? (JSON.parse(serialized) as ZkLoginSession) : null
  } catch {
    return null
  }
}

export async function clearStoredZkLoginSession() {
  try {
    const isAvailable = await SecureStore.isAvailableAsync()
    if (isAvailable) {
      await SecureStore.deleteItemAsync(zkLoginSessionKey)
    }
  } catch {
    // Ignore storage cleanup failures. The session is still cleared in memory by the caller.
  }
}

async function persistZkLoginSession(session: ZkLoginSession) {
  try {
    const isAvailable = await SecureStore.isAvailableAsync()
    if (isAvailable) {
      await SecureStore.setItemAsync(zkLoginSessionKey, JSON.stringify(session))
    }
  } catch {
    // SecureStore can be unavailable on web. Login still works for the current app session.
  }
}

async function requestGoogleIdToken({
  clientId,
  nonce,
}: {
  clientId: string
  nonce: string
}) {
  const redirectUri = createGoogleRedirectUri()
  const request = new AuthSession.AuthRequest({
    clientId,
    extraParams: {
      nonce,
    },
    prompt: AuthSession.Prompt.SelectAccount,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid'],
    usePKCE: true,
  })
  const result = await request.promptAsync(googleDiscovery)

  if (result.type === 'error') {
    const description = result.params.error_description ?? result.error?.message
    throw new Error(description ?? 'Google login failed.')
  }

  if (result.type !== 'success') {
    throw new Error('Google login was cancelled.')
  }

  const code = result.params.code
  const codeVerifier = request.codeVerifier

  if (!code || !codeVerifier) {
    throw new Error('Google login did not return a valid authorization code.')
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code,
      extraParams: {
        code_verifier: codeVerifier,
      },
      redirectUri,
      scopes: ['openid'],
    },
    googleDiscovery,
  )

  if (!tokenResponse.idToken) {
    throw new Error('Google login did not return an id_token.')
  }

  return tokenResponse.idToken
}

function createGoogleRedirectUri() {
  const nativeApplicationId = Platform.select({
    android: 'com.modi.userapp',
    ios: 'com.modi.userapp',
  })

  return AuthSession.makeRedirectUri({
    native: nativeApplicationId ? `${nativeApplicationId}:/oauthredirect` : undefined,
    path: 'zklogin',
    scheme: 'modi-user-app',
  })
}

async function fetchZkLoginSalt(idToken: string) {
  const functionName = process.env.EXPO_PUBLIC_ZKLOGIN_SALT_FUNCTION ?? 'zklogin-salt'
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      idToken,
      provider: 'google',
    },
  })

  if (error) {
    throw error
  }

  const response = data as { salt?: unknown }
  if (typeof response.salt !== 'string' || response.salt.length === 0) {
    throw new Error('zkLogin salt response is invalid.')
  }

  return response.salt
}

async function fetchCurrentEpoch(network: SuiNetwork) {
  const response = await fetch(fullnodeUrls[network], {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'suix_getLatestSuiSystemState',
      params: [],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Could not fetch Sui ${network} epoch.`)
  }

  const body = (await response.json()) as {
    error?: { message?: string }
    result?: { epoch?: string }
  }

  if (body.error) {
    throw new Error(body.error.message ?? 'Sui epoch RPC failed.')
  }

  const epoch = Number(body.result?.epoch)
  if (!Number.isInteger(epoch)) {
    throw new Error('Sui epoch response is invalid.')
  }

  return epoch
}

function readSuiNetwork(value: string | undefined): SuiNetwork {
  if (value === 'devnet' || value === 'mainnet' || value === 'testnet') {
    return value
  }

  return 'testnet'
}

function readGoogleClientId() {
  if (Platform.OS === 'ios' && process.env.EXPO_PUBLIC_ZKLOGIN_GOOGLE_IOS_CLIENT_ID) {
    return process.env.EXPO_PUBLIC_ZKLOGIN_GOOGLE_IOS_CLIENT_ID
  }

  if (Platform.OS === 'android' && process.env.EXPO_PUBLIC_ZKLOGIN_GOOGLE_ANDROID_CLIENT_ID) {
    return process.env.EXPO_PUBLIC_ZKLOGIN_GOOGLE_ANDROID_CLIENT_ID
  }

  if (Platform.OS === 'web' && process.env.EXPO_PUBLIC_ZKLOGIN_GOOGLE_WEB_CLIENT_ID) {
    return process.env.EXPO_PUBLIC_ZKLOGIN_GOOGLE_WEB_CLIENT_ID
  }

  return process.env.EXPO_PUBLIC_ZKLOGIN_GOOGLE_CLIENT_ID
}

function createEnokiClient() {
  const apiKey = readEnokiApiKey()

  if (!apiKey) {
    return null
  }

  ensureCryptoRandomUUID()

  return new EnokiClient({
    additionalEpochs: readEnokiAdditionalEpochs(),
    apiKey,
    apiUrl: process.env.EXPO_PUBLIC_ENOKI_API_URL,
  })
}

function readEnokiApiKey() {
  return process.env.EXPO_PUBLIC_ENOKI_API_KEY?.trim()
}

function readEnokiAdditionalEpochs() {
  const value = Number(process.env.EXPO_PUBLIC_ENOKI_ADDITIONAL_EPOCHS)

  if (!Number.isInteger(value)) {
    return undefined
  }

  return Math.min(30, Math.max(0, value))
}

function ensureCryptoRandomUUID() {
  const globalScope = globalThis as typeof globalThis & {
    crypto?: {
      randomUUID?: () => string
    }
  }

  try {
    if (!globalScope.crypto) {
      Object.defineProperty(globalScope, 'crypto', {
        configurable: true,
        value: {},
      })
    }

    if (!globalScope.crypto?.randomUUID) {
      Object.defineProperty(globalScope.crypto, 'randomUUID', {
        configurable: true,
        value: () => Crypto.randomUUID(),
      })
    }
  } catch {
    // EnokiClient will surface a request error if the runtime cannot expose randomUUID.
  }
}

function readAudience(value: unknown) {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

function generateZkLoginRandomness() {
  return bytesToBigInt(Crypto.getRandomBytes(16)).toString()
}

function bytesToBigInt(bytes: Uint8Array) {
  let value = 0n

  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte)
  }

  return value
}
