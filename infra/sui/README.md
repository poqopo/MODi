# MODi Sui Package

This package contains the first MVP Move module for MODi's consent, access, and reward flow.

## Module

- `modi::registry`

## Core Objects

| Object | Purpose |
|---|---|
| `DataRequest` | Researcher-created request metadata and reward terms |
| `RewardEscrow` | SUI reward locked for the request |
| `DataAsset` | User-owned reference to encrypted Walrus blobs |
| `ConsentGrant` | User approval for a request and data asset |
| `AccessGrant` | Researcher permission reference for a Seal identity and policy object |
| `AccessLog` | Onchain access audit object |

## Object Sharing Model

The functions return objects instead of transferring them directly. This keeps the package composable with Programmable Transaction Blocks.

Expected MVP usage:

- Researcher creates `DataRequest` and shares it.
- Researcher keeps `RewardEscrow` until reward payout.
- User creates `DataAsset` and shares it after Walrus upload.
- User creates `ConsentGrant` and shares it so the researcher can read the consent state.
- Researcher creates `AccessGrant` with the Seal identity used for encryption.
- Seal key servers evaluate `registry::seal_approve` against `AccessGrant`, `ConsentGrant`, `DataAsset`, and `Clock` before releasing decryption key shares.
- Keep `AccessGrant` owned by the researcher wallet for the MVP flow.

The module enforces sender checks for sensitive mutations:

- Only the researcher can deactivate a request.
- Only the user can revoke a consent.
- Only the researcher can create and revoke access grants.
- Only the researcher holding the escrow can pay the reward, and an `AccessLog` must exist for the consent before payout.

## Seal Policy Hook

`create_access_grant` now stores `seal_identity: vector<u8>`. This is the Seal SDK `id` used when encrypting the Walrus dataset.

```move
registry::seal_approve(
    id,
    access_grant,
    consent,
    data_asset,
    clock,
)
```

The approval function checks that the identity matches, the access grant and consent are active, both are unexpired, and the consent still points to the data asset.

## Verification

```sh
sui move build --skip-fetch-latest-git-deps
sui move test --skip-fetch-latest-git-deps
```
