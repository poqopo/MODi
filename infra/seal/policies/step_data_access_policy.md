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

The `id` is the Seal SDK identity bytes used during encryption. For the step upload script, the identity is generated as:

```text
sha256("modi:seal:step_activity_record:v1:<owner>:<request>:<recordedMonth>:<datasetHash>")
```

The script writes this value as `sealIdentityHex` in:

- `data_manifest.json`
- `sui_register_data_asset_args.json`
- `platform_submission.json`

## Client Flow

1. Mobile or web client creates a pseudonymized `step_activity_record`.
2. Client encrypts the dataset with Seal using:
   - package ID for `registry::seal_approve`
   - `sealIdentityHex`
   - configured key server object IDs
   - threshold
3. Client stores the ciphertext on Walrus.
4. Client stores processing receipt and manifest on Walrus.
5. Client registers `DataAsset` on Sui.
6. Researcher creates `AccessGrant` with the same Seal identity.
7. Researcher decrypts only after Seal evaluates `registry::seal_approve`.

## Production Notes

- Keep `AccessGrant` owned by the researcher wallet that is allowed to decrypt. Do not publish it as a broadly shared object unless the policy is extended with an explicit allowlist or session-address check.
- Do not upload local development fallback ciphertext for real users.
- Do not persist the Seal backup key server-side.
- Treat Walrus blobs as publicly retrievable; confidentiality must come from client-side encryption.
- Keep the manifest free of raw health values, precise dates, direct identifiers, and precise location.
