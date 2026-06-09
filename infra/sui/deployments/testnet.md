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

## Walrus Step Data Smoke Test - 2026-06-08

- Local CLI: `sui@testnet-v1.73.1`, `walrus@testnet-v1.50.0`
- Deployer: `0xc25f6a8ffd5bfdc3bb9d84ca3e4283f82e7e8798c1e92e7fb4fd73b0329aa777`
- Package ID: `0xfe5843387f3fffa133b2575afe1f424b9dd4bca5bbe09b668cc95f54d866b6f4`
- Publish transaction: `EbVg41dYuZEJ2RjZGYWu6utUswTpc3udz1JoGijBsRYG`

Walrus blobs created by `infra/walrus/scripts/prepare_step_upload.mjs --store --allow-local-dev-store`:

- Dataset ciphertext blob: `-jq385KJn_dZbfrY_H3S1hU8CeYcOjnAtRC7RxNNan4`
- Dataset Walrus object: `0xc16718417e6d554996a03ccfd8f62886624413f812b543795dcb3e1e6d6d446b`
- Manifest blob: `UlJzN5nl3pRPd32tNRL7yeuo7o_UxkjEr-RdsGoq4l4`
- Manifest Walrus object: `0x864cc796ce8e8748b55b8ad27acc52cf2e0fe9f809ddf93bdaf1798680f078aa`
- Processing receipt blob: `cXT9HJ_EBe_EzuwBns-MVwx1wHVz9ghFhEE0CB2uddM`
- Processing receipt Walrus object: `0xfcae78492ed1f453a745a077b1dea835a0a3f3d2506fdaea6e5d68797117a33a`
- Manifest hash: `b51ef15f2a0c11c20f49041020fb144b37251c8c4b146be9fc31315061b23d82`

Correct-order `registry::register_data_asset` smoke test:

- Transaction: `GxCAUpZLg5bbuH1RFhTHC28xAKeoKtxyuesyZwD5UPB4`
- Created DataAsset ID: `0x74f63597d2fd5233b0dcbebca8a3aa3f089c807c807aa803735d4ddbaa93405c`
- Event type: `0xfe5843387f3fffa133b2575afe1f424b9dd4bca5bbe09b668cc95f54d866b6f4::registry::DataAssetRegistered`

This smoke test used the synthetic local-dev Seal fallback encryption. Do not use `--allow-local-dev-store` for real participant data.
