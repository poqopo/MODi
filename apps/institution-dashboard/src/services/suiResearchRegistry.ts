import type { RegisteredDAppKit } from '@mysten/dapp-kit-react'
import type { SuiClientTypes } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import { fromBase64 } from '@mysten/utils'

const DEFAULT_MODI_TESTNET_REGISTRY_PACKAGE_ID = '0xc5be8a456d0ba7d33fbcff12e92d73181a3817872f6598f5cea65a5326ab3e21'
const DEFAULT_SUI_JSON_RPC_URL = 'https://fullnode.testnet.sui.io:443'
const SUI_CLOCK_OBJECT_ID = '0x6'

type CreatedOnChainObjects = {
  rewardEscrowId: string | null
  suiDataRequestId: string | null
}

type SuiJsonRpcObjectChange = {
  objectId?: string
  objectType?: string
  owner?: unknown
  type?: string
}

type SuiJsonRpcTransactionBlockResponse = {
  error?: {
    message?: string
  }
  result?: {
    effects?: {
      status?: {
        error?: string
        status?: string
      }
    }
    objectChanges?: SuiJsonRpcObjectChange[]
  }
}

export type CreateOnChainDataRequestInput = {
  accessPeriodDays: number
  criteriaHash: string | null
  dataScope: string[]
  purpose: string
  rewardAmountPerParticipant: number
  targetParticipants: number
}

export type OnChainDataRequestResult = {
  registryPackageId: string
  rewardEscrowId: string | null
  suiDataRequestId: string
  txDigest: string
}

export async function createOnChainDataRequest({
  dAppKit,
  input,
}: {
  dAppKit: RegisteredDAppKit
  input: CreateOnChainDataRequestInput
}): Promise<OnChainDataRequestResult> {
  const registryPackageId = readModiRegistryPackageId()
  const tx = new Transaction()
  const rewardMist = readRequestEscrowMist()
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(rewardMist)])
  const owner = readCurrentWalletAddress(dAppKit)
  const criteriaHash = input.criteriaHash ?? await sha256Hex(stableStringify({
    dataScope: input.dataScope,
    purpose: input.purpose,
    rewardAmountPerParticipant: input.rewardAmountPerParticipant,
    targetParticipants: input.targetParticipants,
  }))
  const [request, escrow] = tx.moveCall({
    target: `${registryPackageId}::registry::create_request`,
    arguments: [
      tx.pure.vector('u8', utf8Bytes(input.purpose)),
      tx.pure.vector('u8', utf8Bytes(criteriaHash)),
      tx.pure.u64(toExpiresAtMs(input.accessPeriodDays)),
      payment,
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })

  tx.moveCall({
    target: '0x2::transfer::public_share_object',
    typeArguments: [`${registryPackageId}::registry::DataRequest`],
    arguments: [request],
  })
  tx.transferObjects([escrow], tx.pure.address(owner))

  const result = await signAndExecuteWithSlushSignature({
    dAppKit,
    registryPackageId,
    rewardMist: rewardMist.toString(),
    tx,
  })

  if (result.FailedTransaction) {
    throw new Error(result.FailedTransaction.status.error?.message ?? 'DataRequest 온체인 생성 트랜잭션이 실패했습니다.')
  }

  const transaction = result.Transaction
  const parsedObjects = findCreatedOnChainObjects({
    changedObjects: transaction.effects?.changedObjects ?? [],
    objectTypes: transaction.objectTypes,
    owner,
    registryPackageId,
  })
  let suiDataRequestId = parsedObjects.suiDataRequestId
  let rewardEscrowId = parsedObjects.rewardEscrowId

  if (!suiDataRequestId || !rewardEscrowId) {
    const fetchedObjects = await fetchCreatedOnChainObjects({
      dAppKit,
      digest: transaction.digest,
      owner,
      registryPackageId,
    })
    suiDataRequestId = suiDataRequestId ?? fetchedObjects.suiDataRequestId
    rewardEscrowId = rewardEscrowId ?? fetchedObjects.rewardEscrowId
  }

  if (!suiDataRequestId) {
    throw new Error(`DataRequest object id를 트랜잭션 결과에서 찾지 못했습니다. 트랜잭션 digest: ${transaction.digest}`)
  }

  debugResearchRegistry('created objects', {
    rewardEscrowId,
    suiDataRequestId,
    txDigest: transaction.digest,
  })

  return {
    registryPackageId,
    rewardEscrowId,
    suiDataRequestId,
    txDigest: transaction.digest,
  }
}

function readModiRegistryPackageId() {
  const value = import.meta.env.VITE_MODI_SEAL_PACKAGE_ID?.trim().toLowerCase()
  return value && /^0x[0-9a-f]{64}$/.test(value) ? value : DEFAULT_MODI_TESTNET_REGISTRY_PACKAGE_ID
}

function readSuiJsonRpcUrl() {
  return import.meta.env.VITE_SUI_FULLNODE_URL?.trim() || DEFAULT_SUI_JSON_RPC_URL
}

function readCurrentWalletAddress(dAppKit: RegisteredDAppKit) {
  const connection = dAppKit.stores.$connection.get()

  if (!connection.account) {
    throw new Error('기관 Slush 지갑 연결이 필요합니다.')
  }

  return connection.account.address
}

function readRequestEscrowMist() {
  const value = BigInt(Number.parseInt(import.meta.env.VITE_MODI_REQUEST_ESCROW_MIST ?? '1', 10))
  return value > 0n ? value : 1n
}

function debugResearchRegistry(label: string, payload: unknown) {
  if (import.meta.env.DEV) {
    console.info(`[MODi research registry] ${label}`, payload)
  }
}

function toExpiresAtMs(accessPeriodDays: number) {
  const retentionDays = Math.max(1, Math.trunc(accessPeriodDays || 1))
  return BigInt(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
}

function utf8Bytes(value: string) {
  return Array.from(new TextEncoder().encode(value))
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}

function findCreatedOnChainObjects({
  changedObjects,
  objectTypes,
  owner,
  registryPackageId,
}: {
  changedObjects: SuiClientTypes.ChangedObject[]
  objectTypes?: Record<string, string>
  owner: string
  registryPackageId: string
}): CreatedOnChainObjects {
  const suiDataRequestId =
    findCreatedObjectIdByType({
      changedObjects,
      objectTypes,
      ownerMatches: isSharedOwner,
      registryPackageId,
      structName: 'DataRequest',
    }) ?? findCreatedSharedObjectId(changedObjects)
  const rewardEscrowId =
    findCreatedObjectIdByType({
      changedObjects,
      excludeObjectId: suiDataRequestId,
      objectTypes,
      ownerMatches: (objectOwner) => isAddressOwner(objectOwner, owner),
      registryPackageId,
      structName: 'RewardEscrow',
    }) ?? findCreatedAddressOwnedObjectId(changedObjects, owner, suiDataRequestId)

  return {
    rewardEscrowId,
    suiDataRequestId,
  }
}

async function fetchCreatedOnChainObjects({
  dAppKit,
  digest,
  owner,
  registryPackageId,
}: {
  dAppKit: RegisteredDAppKit
  digest: string
  owner: string
  registryPackageId: string
}): Promise<CreatedOnChainObjects> {
  let parsedObjects: CreatedOnChainObjects | null = null

  try {
    const transaction = await dAppKit.stores.$currentClient.get().getTransaction({
      digest,
      include: {
        effects: true,
        objectTypes: true,
      },
    })

    if (transaction.Transaction) {
      parsedObjects = findCreatedOnChainObjects({
        changedObjects: transaction.Transaction.effects?.changedObjects ?? [],
        objectTypes: transaction.Transaction.objectTypes,
        owner,
        registryPackageId,
      })

      if (parsedObjects.suiDataRequestId && parsedObjects.rewardEscrowId) {
        return parsedObjects
      }
    }
  } catch {
    // Fall through to JSON-RPC lookup. Slush can return a digest before parsed effects are available.
  }

  try {
    const jsonRpcObjects = await fetchCreatedOnChainObjectsFromJsonRpc({
      digest,
      owner,
      registryPackageId,
    })

    return {
      rewardEscrowId: parsedObjects?.rewardEscrowId ?? jsonRpcObjects.rewardEscrowId,
      suiDataRequestId: parsedObjects?.suiDataRequestId ?? jsonRpcObjects.suiDataRequestId,
    }
  } catch {
    return {
      rewardEscrowId: parsedObjects?.rewardEscrowId ?? null,
      suiDataRequestId: parsedObjects?.suiDataRequestId ?? null,
    }
  }
}

async function signAndExecuteWithSlushSignature({
  dAppKit,
  registryPackageId,
  rewardMist,
  tx,
}: {
  dAppKit: RegisteredDAppKit
  registryPackageId: string
  rewardMist: string
  tx: Transaction
}) {
  debugResearchRegistry('signTransaction:start', {
    registryPackageId,
    rewardMist,
  })
  const signedTransaction = await dAppKit.signTransaction({ transaction: tx })
  debugResearchRegistry('signTransaction:result', {
    bytesLength: signedTransaction.bytes.length,
    signaturePrefix: signedTransaction.signature.slice(0, 16),
  })

  debugResearchRegistry('executeTransaction:start', null)
  const executedTransaction = await dAppKit.stores.$currentClient.get().executeTransaction({
    include: {
      effects: true,
      objectTypes: true,
    },
    signatures: [signedTransaction.signature],
    transaction: fromBase64(signedTransaction.bytes),
  })
  debugResearchRegistry('executeTransaction:result', executedTransaction)

  return executedTransaction
}

async function fetchCreatedOnChainObjectsFromJsonRpc({
  digest,
  owner,
  registryPackageId,
}: {
  digest: string
  owner: string
  registryPackageId: string
}): Promise<CreatedOnChainObjects> {
  const response = await fetch(readSuiJsonRpcUrl(), {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'sui_getTransactionBlock',
      params: [
        digest,
        {
          showEffects: true,
          showObjectChanges: true,
        },
      ],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Sui fullnode 트랜잭션 조회에 실패했습니다. (${response.status})`)
  }

  const payload = await response.json() as SuiJsonRpcTransactionBlockResponse
  const rpcErrorMessage = payload.error?.message

  if (rpcErrorMessage) {
    throw new Error(rpcErrorMessage)
  }

  const status = payload.result?.effects?.status

  if (status?.status === 'failure') {
    throw new Error(status.error ?? 'Sui 트랜잭션이 실패했습니다.')
  }

  const objectChanges = payload.result?.objectChanges ?? []
  const suiDataRequestId = findJsonRpcCreatedObjectId({
    objectChanges,
    ownerMatches: isJsonRpcSharedOwner,
    registryPackageId,
    structName: 'DataRequest',
  })
  const rewardEscrowId = findJsonRpcCreatedObjectId({
    excludeObjectId: suiDataRequestId,
    objectChanges,
    ownerMatches: (objectOwner) => isJsonRpcAddressOwner(objectOwner, owner),
    registryPackageId,
    structName: 'RewardEscrow',
  })

  return {
    rewardEscrowId,
    suiDataRequestId,
  }
}

function findCreatedSharedObjectId(changedObjects: SuiClientTypes.ChangedObject[]) {
  return changedObjects.find((object) => object.idOperation === 'Created' && isSharedOwner(object.outputOwner))?.objectId ?? null
}

function findCreatedAddressOwnedObjectId(
  changedObjects: SuiClientTypes.ChangedObject[],
  owner: string,
  excludeObjectId: string | null,
) {
  const normalizedOwner = owner.toLowerCase()
  return changedObjects.find((object) => {
    if (object.objectId === excludeObjectId || object.idOperation !== 'Created') {
      return false
    }

    return isAddressOwner(object.outputOwner, normalizedOwner)
  })?.objectId ?? null
}

function findCreatedObjectIdByType({
  changedObjects,
  excludeObjectId = null,
  objectTypes,
  ownerMatches,
  registryPackageId,
  structName,
}: {
  changedObjects: SuiClientTypes.ChangedObject[]
  excludeObjectId?: string | null
  objectTypes?: Record<string, string>
  ownerMatches: (owner: SuiClientTypes.ObjectOwner | null) => boolean
  registryPackageId: string
  structName: string
}) {
  if (!objectTypes) {
    return null
  }

  return changedObjects.find((object) => {
    if (object.objectId === excludeObjectId || object.idOperation !== 'Created') {
      return false
    }

    if (!ownerMatches(object.outputOwner)) {
      return false
    }

    return isRegistryStructType(objectTypes[object.objectId], registryPackageId, structName)
  })?.objectId ?? null
}

function findJsonRpcCreatedObjectId({
  excludeObjectId = null,
  objectChanges,
  ownerMatches,
  registryPackageId,
  structName,
}: {
  excludeObjectId?: string | null
  objectChanges: SuiJsonRpcObjectChange[]
  ownerMatches: (owner: unknown) => boolean
  registryPackageId: string
  structName: string
}) {
  return objectChanges.find((objectChange) => {
    if (objectChange.type !== 'created' || objectChange.objectId === excludeObjectId || !objectChange.objectId) {
      return false
    }

    if (!ownerMatches(objectChange.owner)) {
      return false
    }

    return isRegistryStructType(objectChange.objectType, registryPackageId, structName)
  })?.objectId ?? null
}

function isRegistryStructType(objectType: string | undefined, registryPackageId: string, structName: string) {
  if (!objectType) {
    return false
  }

  const normalizedType = objectType.toLowerCase()
  const normalizedPackageId = registryPackageId.toLowerCase()
  const normalizedStructName = structName.toLowerCase()
  const expectedType = `${normalizedPackageId}::registry::${normalizedStructName}`

  return normalizedType === expectedType || normalizedType.endsWith(`::registry::${normalizedStructName}`)
}

function isSharedOwner(owner: SuiClientTypes.ObjectOwner | null) {
  return owner?.$kind === 'Shared'
}

function isAddressOwner(owner: SuiClientTypes.ObjectOwner | null, address: string) {
  return owner?.$kind === 'AddressOwner' && owner.AddressOwner.toLowerCase() === address.toLowerCase()
}

function isJsonRpcSharedOwner(owner: unknown) {
  return Boolean(owner && typeof owner === 'object' && 'Shared' in owner)
}

function isJsonRpcAddressOwner(owner: unknown, address: string) {
  if (!owner || typeof owner !== 'object' || !('AddressOwner' in owner)) {
    return false
  }

  const ownerAddress = (owner as { AddressOwner?: unknown }).AddressOwner
  return typeof ownerAddress === 'string' && ownerAddress.toLowerCase() === address.toLowerCase()
}
