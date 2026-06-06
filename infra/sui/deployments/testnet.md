# Testnet Deployment

## Network

- Network: Sui testnet
- RPC: `https://fullnode.testnet.sui.io:443`
- Deployer: `0xef9d81217e5c9c213b27104dd5ea89534b28d7f0295289ae407147461094a614`
- Local CLI: `sui 1.61.2-homebrew`

## Package

- Package ID: `0xf5bfd2be7083f4caa2a2a0f26ae10bbbb5e679c901ab949d07549506260382e2`
- Module: `registry`
- Publish transaction: `6ipUwRBs1xpJpVazkNXTEQ6jgNi8Vf9d8eNvL4Aa7KwY`
- Checkpoint: `342773116`
- Published at: `2026-05-30T11:37:48.867Z`
- Package digest: `7q9sbvnbRoU4kYxbRJgBpUdgm3fcH9EGQYmkq5M23qLv`

## Upgrade Cap

- UpgradeCap ID: `0x626ba81047b67a15891f62fa6f2921353cc793b4b70b477916518cabf7c4598b`
- Owner: `0xef9d81217e5c9c213b27104dd5ea89534b28d7f0295289ae407147461094a614`

## Smoke Test

Called `registry::register_data_asset` on testnet and transferred the returned `DataAsset` to the deployer address.

- Smoke test transaction: `EXPG4m2Q6WWkf3b7Sx8fcMNUVczBN67JHVTV2dN3HJHe`
- Checkpoint: `342773489`
- Executed at: `2026-05-30T11:39:14.031Z`
- Created DataAsset ID: `0x9b451fc0978e16a8887120159afa928fe89934fff354dcf24003ad1bdbf5f6bf`
- DataAsset type: `0xf5bfd2be7083f4caa2a2a0f26ae10bbbb5e679c901ab949d07549506260382e2::registry::DataAsset`
- Event type: `0xf5bfd2be7083f4caa2a2a0f26ae10bbbb5e679c901ab949d07549506260382e2::registry::DataAssetRegistered`

## Useful Commands

```sh
sui client tx-block 6ipUwRBs1xpJpVazkNXTEQ6jgNi8Vf9d8eNvL4Aa7KwY --json
sui client object 0xf5bfd2be7083f4caa2a2a0f26ae10bbbb5e679c901ab949d07549506260382e2 --json
sui client object 0x626ba81047b67a15891f62fa6f2921353cc793b4b70b477916518cabf7c4598b --json
sui client tx-block EXPG4m2Q6WWkf3b7Sx8fcMNUVczBN67JHVTV2dN3HJHe --json
sui client object 0x9b451fc0978e16a8887120159afa928fe89934fff354dcf24003ad1bdbf5f6bf --json
```

## Notes

The local CLI emitted a client/server version mismatch warning:

- Client API version: `1.61.2`
- Server API version: `1.73.0`

The publish and smoke test transactions both executed successfully despite the warning. Upgrade or dependency-verification work should use a current Sui CLI.

