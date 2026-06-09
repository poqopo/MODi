# Step Data Seal Access Policy

## Purpose

Step-count datasets are encrypted client-side before Walrus storage. Seal decryption is approved only when the Sui objects still prove that:

- the Seal identity matches the encrypted dataset identity
- the encrypted dataset has an anchored policy/audit/checkpoint memory trail
- the anchored agent audit passed
- the `AccessGrant` is not revoked
- the `AccessGrant` has not expired
- the `AccessGrant` points to the provided `ConsentGrant`
- the `ConsentGrant` is not revoked
- the `ConsentGrant` has not expired
- the `ConsentGrant` points to the provided `DataAsset`

## Move Policy

The policy function is:

```move
modi::registry::seal_approve_with_agent_workflow(
    id: vector<u8>,
    access_grant: &AccessGrant,
    consent: &ConsentGrant,
    asset: &DataAsset,
    workflow: &AgentWorkflowAnchor,
    clock: &Clock,
)
```

`registry::seal_approve` remains available for simpler flows, but MODi's agent-memory flow should use the stricter hook above.

The `id` is the Seal SDK identity bytes used during encryption. For the step upload script, the identity is generated as:

```text
sha256("modi:seal:step_activity_record:v1:<owner>:<request>:<policyHash>:<recordedMonth>:<datasetHash>")
```

The script writes this value as `sealIdentityHex` in:

- `data_manifest.json`
- `sui_register_data_asset_args.json`
- `platform_submission.json`

## Client Flow

1. Mobile or web client creates a pseudonymized `step_activity_record`.
2. Client downloads or creates the research `policy_pack` and stores it on Walrus.
3. Client runs deterministic validation and local privacy-agent audit.
4. Client stores `agent_audit_memory` and `workflow_checkpoint` artifacts on Walrus.
5. Client encrypts the dataset with Seal using:
   - package ID for `registry::seal_approve`
   - `sealIdentityHex`
   - configured key server object IDs
   - threshold
6. Client stores the ciphertext on Walrus.
7. Client stores processing receipt and manifest on Walrus.
8. Client registers `DataAsset` on Sui.
9. Client registers `AgentWorkflowAnchor` on Sui with policy/audit/checkpoint blob IDs and hashes.
10. Researcher creates `AccessGrant` with the same Seal identity.
11. Researcher decrypts only after Seal evaluates `registry::seal_approve_with_agent_workflow`.

## Production Notes

- Keep `AccessGrant` owned by the researcher wallet that is allowed to decrypt. Do not publish it as a broadly shared object unless the policy is extended with an explicit allowlist or session-address check.
- Do not upload local development fallback ciphertext for real users.
- Do not persist the Seal backup key server-side.
- Treat Walrus blobs as publicly retrievable; confidentiality must come from client-side encryption.
- Keep the manifest free of raw health values, precise dates, direct identifiers, and precise location.
- Do not store raw health samples or decrypted payloads in Walrus Memory/MemWal. Store only policy, audit, checkpoint, and reference metadata.
