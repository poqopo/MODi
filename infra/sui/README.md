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
| `AgentWorkflowAnchor` | User-owned link between a `DataAsset` and Walrus policy/audit/checkpoint memory artifacts |
| `ConsentGrant` | User approval for a request and data asset |
| `AccessGrant` | Researcher permission reference for a Seal identity and policy object |
| `AccessLog` | Onchain access audit object |

## Object Sharing Model

The functions return objects instead of transferring them directly. This keeps the package composable with Programmable Transaction Blocks.

Expected MVP usage:

- Researcher creates `DataRequest` and shares it.
- Researcher keeps `RewardEscrow` until reward payout.
- User creates `DataAsset` and shares it after Walrus upload.
- User creates `AgentWorkflowAnchor` for the same `DataAsset` after policy pack, agent audit memory, and workflow checkpoint blobs are stored on Walrus.
- User creates `ConsentGrant` and shares it so the researcher can read the consent state.
- Researcher creates `AccessGrant` with the Seal identity used for encryption.
- Seal key servers evaluate `registry::seal_approve` or the stricter `registry::seal_approve_with_agent_workflow` before releasing decryption key shares.
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

For the hackathon agent-memory flow, prefer:

```move
registry::seal_approve_with_agent_workflow(
    id,
    access_grant,
    consent,
    data_asset,
    agent_workflow_anchor,
    clock,
)
```

This keeps the existing Seal identity and consent checks, then additionally verifies that the `AgentWorkflowAnchor` belongs to the same `DataAsset` and records a passed local privacy-agent audit.

## Agent Memory Anchoring

`AgentWorkflowAnchor` stores only public Walrus references and hashes for:

- `policy_pack.json`
- `agent_audit_memory.json`
- `workflow_checkpoint.json`

It does not store raw health data or decrypted payloads. The encrypted health payload remains in the separate `DataAsset` Walrus blob.

## Verification

```sh
sui move build --skip-fetch-latest-git-deps
sui move test --skip-fetch-latest-git-deps
```
