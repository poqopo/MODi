# Step Data Seal Access Policy

## Purpose

Step-count datasets are encrypted client-side before Walrus storage. Seal decryption is approved only when the Sui objects still prove that:

- the Seal identity matches the encrypted dataset identity
- the `AccessGrant` is not revoked
- the `AccessGrant` has not expired
- the `AccessGrant` points to the provided `ConsentGrant`
- the `ConsentGrant` is not revoked
- the `ConsentGrant` has not expired
- the `ConsentGrant` points to the provided `DataAsset`

## Move Policy

The policy function is:

```move
modi::registry::seal_approve(
    id: vector<u8>,
    access_grant: &AccessGrant,
    consent: &ConsentGrant,
    asset: &DataAsset,
    clock: &Clock,
)
```

`registry::seal_approve_with_agent_workflow` remains available for a future agent-memory flow, but the current MVP does not upload agent audit memory or workflow checkpoints to Walrus.

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
3. Client runs local pseudonymization and platform safety verification.
4. Client does not store agent audit memory or workflow checkpoint artifacts on Walrus.
5. Client encrypts the dataset with Seal using:
   - package ID for `registry::seal_approve`
   - `sealIdentityHex`
   - configured key server object IDs
   - threshold
6. Client stores the ciphertext on Walrus.
7. Client stores no processing receipt or agent audit result on Walrus.
8. Client registers `DataAsset` on Sui.
9. Client registers `ConsentGrant` on Sui.
10. Client calls `grant_access_to_request_researcher` with the same Seal identity.
11. In the same PTB, client shares `DataAsset` and `ConsentGrant`, then transfers the returned `AccessGrant` to the researcher wallet.
12. Researcher decrypts only after Seal evaluates `registry::seal_approve`.

## Production Notes

- Keep `AccessGrant` owned by the researcher wallet that is allowed to decrypt. Do not publish it as a broadly shared object unless the policy is extended with an explicit allowlist or session-address check.
- Keep `DataAsset` and `ConsentGrant` shared or otherwise readable by the researcher wallet; owned-only user objects cannot be used by the institution dashboard to build Seal approval transaction bytes.
- Persist the `DataRequest`, `DataAsset`, `ConsentGrant`, and `AccessGrant` object IDs with the submission metadata. The institution dashboard needs those object IDs to build Seal approval transaction bytes before decrypting.
- Do not upload local development fallback ciphertext for real users.
- Do not persist the Seal backup key server-side.
- Treat Walrus blobs as publicly retrievable; confidentiality must come from client-side encryption.
- Keep the manifest free of raw health values, precise dates, direct identifiers, and precise location.
- Do not store raw health samples or decrypted payloads in Walrus Memory/MemWal. Store only policy, audit, checkpoint, and reference metadata.
