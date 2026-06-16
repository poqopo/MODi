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
- User creates `ConsentGrant` for the same `DataAsset` and shares it so the researcher can include it in Seal approval transaction bytes.
- User creates an `AccessGrant` for the request researcher with the Seal identity used for encryption, then transfers that `AccessGrant` to the researcher wallet in the same submission PTB.
- `AgentWorkflowAnchor` remains available for a future flow where policy/audit/checkpoint memory artifacts are stored on Walrus.
- Seal key servers evaluate `registry::seal_approve` or the stricter `registry::seal_approve_with_agent_workflow` before releasing decryption key shares.
- Keep `AccessGrant` owned by the researcher wallet for the MVP flow.

The module enforces sender checks for sensitive mutations:

- Only the researcher can deactivate a request.
- Only the user can revoke a consent.
- The researcher can create and revoke access grants.
- The user can create an access grant for the `DataRequest` researcher during submission. The returned object should be transferred to the researcher wallet in the same PTB.
- Only the researcher holding the escrow can pay the reward, and an `AccessLog` must exist for the consent before payout.

## Seal Policy Hook

Both `create_access_grant` and `grant_access_to_request_researcher` store `seal_identity: vector<u8>`. This is the Seal SDK `id` used when encrypting the Walrus dataset. For user submission, prefer `grant_access_to_request_researcher` so the user creates the decryption grant for the researcher declared on the `DataRequest`.

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

For the agent-memory flow, use the stricter hook:

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

This keeps the existing Seal identity and consent checks, then additionally verifies that the `AgentWorkflowAnchor` belongs to the same `DataAsset` and records a passed local privacy-agent audit. The current user-app submission flow does not upload agent memory to Walrus, so the basic `seal_approve` hook is the active MVP path.

## Agent Memory Anchoring

`AgentWorkflowAnchor` stores only public Walrus references and hashes for:

- `policy_pack.json`
- `agent_audit_memory.json`
- `workflow_checkpoint.json`

It does not store raw health data or decrypted payloads. The encrypted health payload remains in the separate `DataAsset` Walrus blob.

## Verification

```sh
sui move build
sui move test
```
