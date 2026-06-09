# MODi Walrus Upload Layer

This folder defines the MVP upload boundary for mobile and web clients.

Walrus stores only encrypted payloads and public verification metadata. Raw health samples stay on the user device or in a trusted local preprocessing environment.

## Step Data MVP

The first upload path is step-count data because the mobile app already reads Apple Health steps.

Raw input shape:

- exact daily date
- exact daily step count
- owner wallet address
- request object ID
- coarse profile metadata such as age range

Walrus upload shape:

- public `policy_pack`
- encrypted `step_activity_record`
- public `agent_audit_memory`
- public `data_manifest`
- public `processing_receipt`
- public `workflow_checkpoint`

The encrypted dataset excludes exact dates and exact step counts. It keeps only:

- recorded month
- step count range buckets
- average step band
- active day band
- goal-hit day band
- consistency band

## Dry Run

Run this first. It does not call Walrus and uses a local development encryption fallback.

```sh
node infra/walrus/scripts/prepare_step_upload.mjs
```

Generated files are written to `infra/walrus/build/step-upload/`.

Important files:

| File | Purpose |
|---|---|
| `step_activity_record.json` | Pseudonymized dataset before encryption |
| `step_activity_record.seal.localdev.json` | Local encrypted payload placeholder |
| `policy_pack.json` | Research-purpose transform policy for the local privacy agent |
| `agent_audit_memory.json` | Agent privacy audit memory without raw health data |
| `processing_receipt.json` | Filtering and pseudonymization proof |
| `data_manifest.json` | Walrus/Sui/Seal references and hashes |
| `workflow_checkpoint.json` | Long-running agent workflow state for recovery/coordination |
| `sui_register_data_asset_args.json` | Arguments for `registry::register_data_asset` |
| `platform_submission.json` | Shape that web/API can store in `participant_submissions` |

`*.local-dev-key.json` is created only for local inspection and must never be uploaded.

## Real Seal + Walrus Store

Before using real user data, replace the local fallback with Seal SDK or CLI encryption.

The script supports an external Seal command template:

```sh
export MODI_SEAL_ENCRYPT_CMD='seal-cli encrypt --package-id {packageId} --id {sealIdentityHex} --threshold {threshold} --key-servers {keyServers} --input {input} --out {output}'
```

Adjust the command to the installed Seal CLI or SDK wrapper. The placeholders are substituted by the script.

Then store the encrypted dataset, receipt, and manifest on Walrus:

```sh
node infra/walrus/scripts/prepare_step_upload.mjs \
  --store \
  --seal-package-id 0x... \
  --seal-policy-object-id 0x... \
  --key-server-object-ids 0x...,0x... \
  --context testnet \
  --epochs 2
```

The Walrus CLI command used by the script is:

```sh
walrus store <file> --epochs <n> --context <testnet|mainnet> --json
```

The script refuses `--store` when it is still using `local-dev-fallback` encryption. For a synthetic-only demo, pass `--allow-local-dev-store`; do not use that flag with real user data.

## Agent Memory Boundary

MODi does not use Walrus Memory/MemWal as a health-data memory store.

Use the normal Seal-encrypted `DataAsset` flow for health payloads:

```text
HealthKit data -> local transform -> Seal encryption -> Walrus dataset blob -> Sui DataAsset
```

Use agent memory artifacts only for compliance workflow state:

```text
policy_pack -> local privacy audit -> agent_audit_memory -> workflow_checkpoint
```

Allowed agent memory content:

- policy IDs and policy hashes
- audit decisions and findings
- upload stage/checkpoint references
- Walrus blob IDs and hashes for generated artifacts

Forbidden agent memory content:

- raw HealthKit samples
- exact dates or exact health values
- direct identifiers
- decrypted health payloads

This keeps the hackathon "persistent agent memory" layer useful without making it the regulated health-data store.

## Sui Registration

After Walrus storage succeeds, call:

```text
<package_id>::registry::register_data_asset(
  dataset_blob_id,
  manifest_blob_id,
  manifest_hash,
  schema_version,
  processing_policy_version,
  processing_receipt_blob_id
)
```

All six arguments are `vector<u8>` UTF-8 bytes.
The generated `sui_register_data_asset_args.json` includes `moveArgOrder`; bind the values in that exact order when building a PTB or TypeScript transaction.

Then attach the agent workflow memory to the created `DataAsset`:

```text
<package_id>::registry::register_agent_workflow_anchor(
  data_asset,
  policy_blob_id,
  policy_hash,
  policy_version,
  agent_audit_blob_id,
  agent_audit_hash,
  checkpoint_blob_id,
  checkpoint_hash,
  memory_namespace,
  latest_stage,
  agent_audit_passed
)
```

The `AgentWorkflowAnchor` is the onchain link between the encrypted health dataset and the persistent agent memory artifacts. Seal key servers can use the stricter `seal_approve_with_agent_workflow` hook to require both consent/access validity and a passed agent audit.

For access, encrypt with the same `sealIdentityHex`, then create:

```text
<package_id>::registry::create_access_grant(
  request,
  consent,
  seal_identity,
  seal_policy_object_id,
  expires_at_ms,
  clock
)
```

Seal key servers evaluate `registry::seal_approve` with the Seal identity, `AccessGrant`, `ConsentGrant`, `DataAsset`, and `Clock` before releasing decryption key shares.
