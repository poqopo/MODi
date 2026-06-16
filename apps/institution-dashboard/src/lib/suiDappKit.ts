import { createDAppKit } from '@mysten/dapp-kit-react'
import { SuiGrpcClient } from '@mysten/sui/grpc'

const fullnodeUrls = {
  testnet: 'https://fullnode.testnet.sui.io:443',
} as const

export const dAppKit = createDAppKit({
  autoConnect: true,
  defaultNetwork: 'testnet',
  networks: ['testnet'],
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: fullnodeUrls[network] }),
  slushWalletConfig: {
    appName: 'MODi Institution Dashboard',
  },
  storageKey: 'modi-institution-slush-wallet',
})

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit
  }
}
