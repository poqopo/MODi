#!/usr/bin/env node
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultInput = path.resolve(scriptDir, '../samples/step_day.raw.sample.json');
const defaultOutDir = path.resolve(scriptDir, '../build/step-upload');

const schemaVersion = 'step_activity_record@1.0.0';
const processingPolicyVersion = 'step-data-policy-v1';
const policyPackVersion = '1.0.0';
const registerDataAssetArgOrder = [
  'dataset_blob_id',
  'manifest_blob_id',
  'manifest_hash',
  'schema_version',
  'processing_policy_version',
  'processing_receipt_blob_id',
];
const registerAgentWorkflowArgOrder = [
  'policy_blob_id',
  'policy_hash',
  'policy_version',
  'agent_audit_blob_id',
  'agent_audit_hash',
  'checkpoint_blob_id',
  'checkpoint_hash',
  'memory_namespace',
  'latest_stage',
];
const stepAllowedFields = [
  'activeDaysBand',
  'ageRange',
  'averageStepBand',
  'consistencyBand',
  'dailyStepBandCounts',
  'dataDomains',
  'dataType',
  'deviceType',
  'featureTags',
  'goalHitDaysBand',
  'recordedMonth',
  'regionCode',
  'sampleDaysBand',
  'schemaVersion',
];
const stepForbiddenFields = [
  'address',
  'date',
  'deviceId',
  'email',
  'fullName',
  'latitude',
  'longitude',
  'name',
  'phone',
  'sourceId',
  'steps',
  'userId',
  'walletAddress',
];
const knownAllowedUses = new Set([
  'aggregate_research',
  'personalized_coaching',
  'remote_monitoring',
  'reward_validation',
]);

const prohibitedRawKeys = new Set([
  'address',
  'birthdate',
  'dateofbirth',
  'email',
  'fullname',
  'gps',
  'insurancenumber',
  'latitude',
  'longitude',
  'name',
  'patientid',
  'phone',
  'phonenumber',
  'residentregistrationnumber',
  'ssn',
  'streetaddress',
]);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const cfg = {
    context: args.context ?? process.env.WALRUS_CONTEXT ?? 'testnet',
    epochs: Number(args.epochs ?? process.env.WALRUS_EPOCHS ?? 2),
    input: path.resolve(args.input ?? defaultInput),
    keyServerObjectIds: csv(args.keyServerObjectIds ?? process.env.MODI_SEAL_KEY_SERVER_IDS),
    allowedUse: args.allowedUse ?? process.env.MODI_ALLOWED_USE,
    memoryNamespace: args.memoryNamespace ?? process.env.MODI_AGENT_MEMORY_NAMESPACE,
    outDir: path.resolve(args.outDir ?? defaultOutDir),
    ownerAddress: args.owner ?? process.env.MODI_OWNER_ADDRESS,
    policyId: args.policyId ?? process.env.MODI_POLICY_ID,
    projectId: args.projectId ?? process.env.MODI_PROJECT_ID,
    requestId: args.requestId ?? process.env.MODI_REQUEST_ID,
    sealPackageId: args.sealPackageId ?? process.env.MODI_SEAL_PACKAGE_ID ?? process.env.MODI_SUI_PACKAGE_ID ?? '0x0',
    sealPolicyObjectId: args.sealPolicyObjectId ?? process.env.MODI_SEAL_POLICY_OBJECT_ID ?? '0x0',
    sealThreshold: Number(args.sealThreshold ?? process.env.MODI_SEAL_THRESHOLD ?? 1),
    allowLocalDevStore: Boolean(args.allowLocalDevStore),
    store: Boolean(args.store),
  };

  assertPositiveInteger(cfg.epochs, 'Walrus epochs');
  assertPositiveInteger(cfg.sealThreshold, 'Seal threshold');
  if (cfg.store && !process.env.MODI_SEAL_ENCRYPT_CMD && !cfg.allowLocalDevStore) {
    throw new Error('Refusing to store local-dev-fallback artifacts on Walrus. Set MODI_SEAL_ENCRYPT_CMD for real Seal encryption, or pass --allow-local-dev-store for synthetic demos only.');
  }

  const raw = await readJson(cfg.input);
  assertNoProhibitedKeys(raw);

  const ownerAddress = normalizeObjectId(cfg.ownerAddress ?? raw.ownerAddress, 'ownerAddress');
  const requestId = normalizeObjectId(cfg.requestId ?? raw.requestId, 'requestId');
  const sealPackageId = normalizeObjectId(cfg.sealPackageId, 'sealPackageId');
  const sealPolicyObjectId = normalizeObjectId(cfg.sealPolicyObjectId, 'sealPolicyObjectId');
  const projectId = requiredString(cfg.projectId ?? raw.projectId ?? 'synthetic-step-reward-study', 'projectId');
  const allowedUse = requiredString(cfg.allowedUse ?? raw.allowedUse ?? 'reward_validation', 'allowedUse');
  const policyId = requiredString(cfg.policyId ?? raw.policyId ?? 'step_monthly_reward_policy_v1', 'policyId');
  const memoryNamespace = requiredString(
    cfg.memoryNamespace ?? deriveMemoryNamespace({ ownerAddress, policyId, requestId }),
    'memoryNamespace',
  );

  await mkdir(cfg.outDir, { recursive: true });

  const policyPack = buildPolicyPack({ allowedUse, policyId, projectId });
  const policyPath = path.join(cfg.outDir, 'policy_pack.json');
  await writeJson(policyPath, policyPack);
  const policyHash = hashJson(policyPack);
  const policyBlob = await storeWalrusBlob(policyPath, cfg);

  const stepRecord = buildStepRecord(raw);
  assertPolicyAllowedFields(stepRecord, policyPack);
  assertNoProhibitedKeys(stepRecord);
  assertNoRawStepLeak(stepRecord);

  const rawSha256 = sha256(Buffer.from(stableStringify(raw)));
  const datasetSha256 = hashJson(stepRecord);
  const sealIdentityHex = args.sealIdentityHex ?? deriveSealIdentityHex({
    datasetSha256,
    ownerAddress,
    policyHash,
    recordedMonth: stepRecord.recordedMonth,
    requestId,
  });
  assertHexBytes(sealIdentityHex, 32, 'sealIdentityHex');

  const datasetPath = path.join(cfg.outDir, 'step_activity_record.json');
  await writeJson(datasetPath, stepRecord);

  const encrypted = await encryptDataset({
    datasetPath,
    keyServerObjectIds: cfg.keyServerObjectIds,
    outDir: cfg.outDir,
    sealIdentityHex,
    sealPackageId,
    sealPolicyObjectId,
    sealThreshold: cfg.sealThreshold,
  });

  const encryptedDatasetSha256 = sha256(encrypted.bytes);

  if (cfg.store && encrypted.mode === 'local-dev-fallback' && !cfg.allowLocalDevStore) {
    throw new Error('Refusing to store local-dev-fallback ciphertext on Walrus. Set MODI_SEAL_ENCRYPT_CMD for real Seal encryption, or pass --allow-local-dev-store for synthetic demos only.');
  }

  const agentAudit = buildAgentAuditMemory({
    datasetSha256,
    memoryNamespace,
    policyBlob,
    policyHash,
    policyPack,
    stepRecord,
  });
  if (agentAudit.decision !== 'passed') {
    throw new Error(`Agent privacy audit blocked upload: ${agentAudit.findings.map((finding) => finding.detail).join('; ')}`);
  }
  const agentAuditPath = path.join(cfg.outDir, 'agent_audit_memory.json');
  await writeJson(agentAuditPath, agentAudit);
  const agentAuditHash = hashJson(agentAudit);
  const agentAuditBlob = await storeWalrusBlob(agentAuditPath, cfg);

  const receipt = {
    receiptVersion: '1.0.0',
    dataType: 'step_activity_record',
    processingPolicyVersion,
    createdAt: new Date().toISOString(),
    sourceSummary: {
      source: raw.source ?? 'synthetic',
      inputRecordCount: raw.dailySteps.length,
      inputPeriod: 'month',
    },
    removedFields: ['date', 'steps'],
    pseudonymization: {
      timeGranularity: 'month',
      stepValueTransform: 'range_bands_and_counts',
      identityPolicy: 'no_direct_identifier_in_dataset',
    },
    hashes: {
      inputSha256: rawSha256,
      pseudonymizedDatasetSha256: datasetSha256,
      encryptedDatasetSha256,
    },
    policy: {
      policyId: policyPack.policyId,
      policyVersion: policyPack.policyVersion,
      walrusBlobId: policyBlob.blobId,
      sha256: policyHash,
    },
    agentMemory: {
      namespace: memoryNamespace,
      auditWalrusBlobId: agentAuditBlob.blobId,
      auditSha256: agentAuditHash,
      decision: agentAudit.decision,
      riskLevel: agentAudit.riskLevel,
    },
    agentVerification: {
      status: agentAudit.decision,
      checks: [
        {
          name: 'forbidden_fields',
          status: 'passed',
          detail: 'No direct identifier or precise location keys were present in the upload payload.',
        },
        {
          name: 'raw_step_values_removed',
          status: 'passed',
          detail: 'Exact dates and raw step counts were converted to month-level bands.',
        },
        {
          name: 'seal_before_walrus',
          status: 'passed',
          detail: encrypted.mode === 'local-dev-fallback'
            ? 'Local dev encryption fallback was used. Replace with Seal SDK or CLI before testnet/mainnet storage.'
            : 'Seal encryption command produced the Walrus payload.',
        },
        ...agentAudit.findings.map((finding) => ({
          name: finding.name,
          status: finding.status,
          detail: finding.detail,
        })),
      ],
    },
  };

  const receiptPath = path.join(cfg.outDir, 'processing_receipt.json');
  await writeJson(receiptPath, receipt);

  const datasetBlob = await storeWalrusBlob(encrypted.path, cfg);
  const receiptBlob = await storeWalrusBlob(receiptPath, cfg);

  const manifest = {
    manifestVersion: '1.0.0',
    dataType: 'step_activity_record',
    schemaVersion,
    ownerAddress,
    requestId,
    policy: {
      policyId: policyPack.policyId,
      policyVersion: policyPack.policyVersion,
      walrusBlobId: policyBlob.blobId,
      walrusObjectId: policyBlob.objectId,
      sha256: policyHash,
    },
    dataset: {
      walrusBlobId: datasetBlob.blobId,
      walrusObjectId: datasetBlob.objectId,
      ciphertextSha256: encryptedDatasetSha256,
      ciphertextBytes: encrypted.bytes.length,
    },
    processingReceipt: {
      walrusBlobId: receiptBlob.blobId,
      walrusObjectId: receiptBlob.objectId,
      sha256: hashJson(receipt),
    },
    agentMemory: {
      namespace: memoryNamespace,
      audit: {
        walrusBlobId: agentAuditBlob.blobId,
        walrusObjectId: agentAuditBlob.objectId,
        sha256: agentAuditHash,
        decision: agentAudit.decision,
        riskLevel: agentAudit.riskLevel,
      },
    },
    encryption: {
      provider: 'seal',
      mode: encrypted.mode,
      sealPackageId,
      sealIdentityHex,
      sealPolicyObjectId,
      threshold: cfg.sealThreshold,
      keyServerObjectIds: cfg.keyServerObjectIds,
    },
    metadata: {
      recordedMonth: stepRecord.recordedMonth,
      ageRange: stepRecord.ageRange,
      ...(stepRecord.regionCode ? { regionCode: stepRecord.regionCode } : {}),
      deviceType: stepRecord.deviceType,
      dataDomains: stepRecord.dataDomains,
      featureTags: stepRecord.featureTags,
    },
    retention: {
      walrusContext: cfg.context,
      walrusEpochs: cfg.epochs,
    },
  };

  const manifestPath = path.join(cfg.outDir, 'data_manifest.json');
  await writeJson(manifestPath, manifest);
  const manifestHash = hashJson(manifest);
  const manifestBlob = await storeWalrusBlob(manifestPath, cfg);

  const workflowCheckpoint = buildWorkflowCheckpoint({
    agentAuditBlob,
    agentAuditHash,
    datasetBlob,
    manifestBlob,
    manifestHash,
    memoryNamespace,
    policyBlob,
    policyHash,
    policyPack,
    receiptBlob,
    receiptHash: hashJson(receipt),
    requestId,
  });
  const workflowCheckpointPath = path.join(cfg.outDir, 'workflow_checkpoint.json');
  await writeJson(workflowCheckpointPath, workflowCheckpoint);
  const workflowCheckpointHash = hashJson(workflowCheckpoint);
  const workflowCheckpointBlob = await storeWalrusBlob(workflowCheckpointPath, cfg);

  const suiRegisterArgs = {
    packageId: sealPackageId,
    target: `${sealPackageId}::registry::register_data_asset`,
    moveArgOrder: registerDataAssetArgOrder,
    moveArgsAsUtf8Vectors: {
      dataset_blob_id: datasetBlob.blobId,
      manifest_blob_id: manifestBlob.blobId,
      manifest_hash: manifestHash,
      schema_version: schemaVersion,
      processing_policy_version: processingPolicyVersion,
      processing_receipt_blob_id: receiptBlob.blobId,
    },
    accessGrant: {
      target: `${sealPackageId}::registry::create_access_grant`,
      seal_identity_hex: sealIdentityHex,
      seal_policy_object_id: sealPolicyObjectId,
    },
    agentWorkflow: {
      target: `${sealPackageId}::registry::register_agent_workflow_anchor`,
      moveArgOrder: registerAgentWorkflowArgOrder,
      moveArgsAsUtf8Vectors: {
        policy_blob_id: policyBlob.blobId,
        policy_hash: policyHash,
        policy_version: policyPack.policyVersion,
        agent_audit_blob_id: agentAuditBlob.blobId,
        agent_audit_hash: agentAuditHash,
        checkpoint_blob_id: workflowCheckpointBlob.blobId,
        checkpoint_hash: workflowCheckpointHash,
        memory_namespace: memoryNamespace,
        latest_stage: workflowCheckpoint.stage,
      },
      moveArgs: {
        agent_audit_passed: true,
      },
      typescriptHint:
        'Pass the DataAsset object first, then bind moveArgsAsUtf8Vectors in moveArgOrder as vector<u8>, and pass agent_audit_passed as a bool.',
    },
    sealApproveWithAgentWorkflow: {
      target: `${sealPackageId}::registry::seal_approve_with_agent_workflow`,
      requiredObjects: ['AccessGrant', 'ConsentGrant', 'DataAsset', 'AgentWorkflowAnchor', 'Clock'],
    },
    typescriptHint:
      "Bind moveArgsAsUtf8Vectors in moveArgOrder, then call tx.pure.vector('u8', Array.from(new TextEncoder().encode(value))) for each register_data_asset vector<u8> argument.",
  };

  const platformSubmission = {
    category: 'activity_workout',
    volume_bytes: encrypted.bytes.length,
    validation_status: 'policy_passed',
    walrus_blob_id: datasetBlob.blobId,
    walrus_dataset_object_id: datasetBlob.objectId,
    walrus_manifest_blob_id: manifestBlob.blobId,
    walrus_manifest_object_id: manifestBlob.objectId,
    walrus_manifest_hash: manifestHash,
    processing_receipt_blob_id: receiptBlob.blobId,
    processing_receipt_hash: hashJson(receipt),
    privacy_policy_blob_id: policyBlob.blobId,
    privacy_policy_hash: policyHash,
    privacy_policy_version: policyPack.policyVersion,
    agent_audit_blob_id: agentAuditBlob.blobId,
    agent_audit_hash: agentAuditHash,
    agent_audit_decision: agentAudit.decision,
    agent_memory_namespace: memoryNamespace,
    workflow_checkpoint_blob_id: workflowCheckpointBlob.blobId,
    workflow_checkpoint_hash: workflowCheckpointHash,
    workflow_stage: workflowCheckpoint.stage,
    schema_version: schemaVersion,
    processing_policy_version: processingPolicyVersion,
    encryption_provider: 'seal',
    encryption_mode: encrypted.mode,
    seal_policy_id: sealPolicyObjectId,
    seal_identity_hex: sealIdentityHex,
    metadata: {
      walrusContext: cfg.context,
      walrusEpochs: cfg.epochs,
    },
  };

  const summary = {
    storedOnWalrus: cfg.store,
    outDir: cfg.outDir,
    files: {
      pseudonymizedDataset: datasetPath,
      encryptedDataset: encrypted.path,
      policyPack: policyPath,
      agentAuditMemory: agentAuditPath,
      processingReceipt: receiptPath,
      manifest: manifestPath,
      workflowCheckpoint: workflowCheckpointPath,
      suiRegisterArgs: path.join(cfg.outDir, 'sui_register_data_asset_args.json'),
      platformSubmission: path.join(cfg.outDir, 'platform_submission.json'),
      ...(encrypted.keyPath ? { localDevKey: encrypted.keyPath } : {}),
    },
    walrus: {
      policy: policyBlob,
      dataset: datasetBlob,
      agentAudit: agentAuditBlob,
      processingReceipt: receiptBlob,
      manifest: manifestBlob,
      workflowCheckpoint: workflowCheckpointBlob,
    },
    sui: suiRegisterArgs,
    manifestHash,
    policyHash,
    agentAuditHash,
    workflowCheckpointHash,
  };

  await writeJson(summary.files.suiRegisterArgs, suiRegisterArgs);
  await writeJson(summary.files.platformSubmission, platformSubmission);
  await writeJson(path.join(cfg.outDir, 'upload_summary.json'), summary);

  console.log(JSON.stringify({
    storedOnWalrus: cfg.store,
    encryptionMode: encrypted.mode,
    datasetBlobId: datasetBlob.blobId,
    policyBlobId: policyBlob.blobId,
    agentAuditBlobId: agentAuditBlob.blobId,
    manifestBlobId: manifestBlob.blobId,
    processingReceiptBlobId: receiptBlob.blobId,
    workflowCheckpointBlobId: workflowCheckpointBlob.blobId,
    manifestHash,
    policyHash,
    agentAuditHash,
    workflowCheckpointHash,
    outDir: cfg.outDir,
  }, null, 2));
}

function buildPolicyPack({ allowedUse, policyId, projectId }) {
  return {
    policyVersion: policyPackVersion,
    policyId,
    projectId,
    dataType: 'step_activity_record',
    purpose: 'Validate participation with minimized monthly step activity evidence.',
    allowedUse,
    transformPolicy: {
      source: 'healthkit_daily_steps',
      outputSchema: schemaVersion,
      timeGranularity: 'month',
      valueTransform: 'range_bands_and_counts',
      allowedFields: stepAllowedFields,
      forbiddenFields: stepForbiddenFields,
      minimumSampleDays: 1,
      exactValuePolicy: 'forbid_exact_dates_and_raw_step_counts',
      locationPolicy: 'coarse_region_only',
      identityPolicy: 'no_direct_identifier_in_dataset',
    },
    localAgentPolicy: {
      modelClass: 'lightweight_on_device_or_rule_based_agent',
      role: 'secondary_privacy_auditor',
      finalAuthority: 'deterministic_validator',
      instruction:
        'Review the transformed payload for direct identifiers, exact health values, precise time/location leakage, schema drift, and consent-purpose mismatch before Seal encryption.',
      outputSchema: {
        decision: ['passed', 'blocked', 'needs_review'],
        riskLevel: ['low', 'medium', 'high'],
        findings: 'array of policy check results',
      },
    },
    walrusMemoryPolicy: {
      storeRawHealthData: false,
      allowedMemoryTypes: [
        'privacy_audit_summary',
        'upload_checkpoint',
        'policy_selection',
      ],
      note:
        'Walrus Memory/MemWal should store compliance workflow memory only. Health payloads stay in the separate Seal-encrypted DataAsset flow.',
    },
  };
}

function buildAgentAuditMemory({
  datasetSha256,
  memoryNamespace,
  policyBlob,
  policyHash,
  policyPack,
  stepRecord,
}) {
  const findings = runLocalAgentAudit(stepRecord, policyPack);
  const failed = findings.some((finding) => finding.status === 'failed');
  const needsReview = findings.some((finding) => finding.status === 'needs_review');
  const decision = failed ? 'blocked' : needsReview ? 'needs_review' : 'passed';

  return {
    memoryVersion: '1.0.0',
    memoryType: 'privacy_audit_summary',
    namespace: memoryNamespace,
    policyId: policyPack.policyId,
    policyVersion: policyPack.policyVersion,
    policyWalrusBlobId: policyBlob.blobId,
    policyHash,
    dataType: 'step_activity_record',
    schemaVersion,
    datasetSha256,
    createdAt: new Date().toISOString(),
    decision,
    riskLevel: decision === 'passed' ? 'low' : 'high',
    findings,
    recommendedAction: decision === 'passed' ? 'allow_upload' : 'block_upload',
    memorySafety: {
      rawHealthDataIncluded: false,
      exactDatesIncluded: false,
      rawStepCountsIncluded: false,
      directIdentifiersIncluded: false,
    },
  };
}

function runLocalAgentAudit(stepRecord, policyPack) {
  const findings = [];
  const allowed = new Set(policyPack.transformPolicy.allowedFields);
  const forbidden = new Set(policyPack.transformPolicy.forbiddenFields.map(normalizeKey));
  const keys = Object.keys(stepRecord);
  const disallowedKeys = keys.filter((key) => !allowed.has(key));

  findings.push({
    name: 'allow_list_schema',
    status: disallowedKeys.length === 0 ? 'passed' : 'failed',
    detail: disallowedKeys.length === 0
      ? 'Transformed payload uses only policy allowed fields.'
      : `Payload contains fields outside policy allow-list: ${disallowedKeys.join(', ')}`,
  });

  const forbiddenKeys = collectForbiddenKeys(stepRecord, forbidden);
  findings.push({
    name: 'forbidden_field_scan',
    status: forbiddenKeys.length === 0 ? 'passed' : 'failed',
    detail: forbiddenKeys.length === 0
      ? 'No forbidden direct identifier, raw value, precise date, or location fields were found.'
      : `Forbidden fields found: ${forbiddenKeys.join(', ')}`,
  });

  findings.push({
    name: 'time_granularity',
    status: /^\d{4}-\d{2}$/.test(stepRecord.recordedMonth) ? 'passed' : 'failed',
    detail: 'Recorded time is represented at month granularity.',
  });

  findings.push({
    name: 'raw_step_value_scan',
    status: hasLikelyRawStepValues(stepRecord) ? 'failed' : 'passed',
    detail: hasLikelyRawStepValues(stepRecord)
      ? 'Payload appears to contain raw step-like numeric values.'
      : 'Payload contains band counts and no raw daily step values.',
  });

  const knownUse = knownAllowedUses.has(policyPack.allowedUse);
  findings.push({
    name: 'purpose_minimization',
    status: knownUse ? 'passed' : 'needs_review',
    detail: knownUse
      ? `Allowed use ${policyPack.allowedUse} is recognized and constrained by the policy pack allow-list.`
      : `Allowed use ${policyPack.allowedUse} should be reviewed against project consent text.`,
  });

  findings.push({
    name: 'walrus_memory_scope',
    status: 'passed',
    detail: 'Agent memory stores audit/checkpoint metadata only; health payload remains in the encrypted DataAsset flow.',
  });

  return findings;
}

function buildWorkflowCheckpoint({
  agentAuditBlob,
  agentAuditHash,
  datasetBlob,
  manifestBlob,
  manifestHash,
  memoryNamespace,
  policyBlob,
  policyHash,
  policyPack,
  receiptBlob,
  receiptHash,
  requestId,
}) {
  return {
    checkpointVersion: '1.0.0',
    checkpointType: 'agent_upload_workflow',
    namespace: memoryNamespace,
    stage: 'sui_registration_ready',
    createdAt: new Date().toISOString(),
    requestId,
    policy: {
      policyId: policyPack.policyId,
      policyVersion: policyPack.policyVersion,
      walrusBlobId: policyBlob.blobId,
      sha256: policyHash,
    },
    artifacts: {
      encryptedDataset: {
        walrusBlobId: datasetBlob.blobId,
        sha256: datasetBlob.sha256,
      },
      agentAuditMemory: {
        walrusBlobId: agentAuditBlob.blobId,
        sha256: agentAuditHash,
      },
      processingReceipt: {
        walrusBlobId: receiptBlob.blobId,
        sha256: receiptHash,
      },
      dataManifest: {
        walrusBlobId: manifestBlob.blobId,
        sha256: manifestHash,
      },
    },
    nextAction: 'register_data_asset_and_agent_workflow_anchor_on_sui',
    memorySafety: {
      rawHealthDataIncluded: false,
      healthPayloadIncluded: false,
    },
  };
}

function buildStepRecord(raw) {
  if (!Array.isArray(raw.dailySteps) || raw.dailySteps.length === 0) {
    throw new Error('raw.dailySteps must contain at least one daily step sample.');
  }

  const recordedMonth = monthFromSamples(raw.dailySteps);
  const dailyStepBandCounts = {
    under_3k: 0,
    '3k_6k': 0,
    '6k_10k': 0,
    '10k_15k': 0,
    '15k_plus': 0,
  };

  let sum = 0;
  let activeDays = 0;
  let goalHitDays = 0;
  const values = [];

  for (const sample of raw.dailySteps) {
    if (!Number.isFinite(sample.steps) || sample.steps < 0) {
      throw new Error('Each dailySteps item must have a non-negative numeric steps value.');
    }

    const steps = Math.round(sample.steps);
    values.push(steps);
    sum += steps;
    dailyStepBandCounts[stepBand(steps)] += 1;
    if (steps >= 7000) activeDays += 1;
    if (steps >= 10000) goalHitDays += 1;
  }

  const average = sum / raw.dailySteps.length;
  const record = {
    schemaVersion: '1.0.0',
    dataType: 'step_activity_record',
    recordedMonth,
    ageRange: requiredString(raw.ageRange, 'ageRange'),
    ...(raw.regionCode ? { regionCode: requiredString(raw.regionCode, 'regionCode') } : {}),
    deviceType: requiredString(raw.deviceType, 'deviceType'),
    dataDomains: ['activity_workout'],
    featureTags: ['step_count'],
    dailyStepBandCounts,
    sampleDaysBand: sampleDaysBand(raw.dailySteps.length),
    averageStepBand: stepBand(average),
    activeDaysBand: ratioBand(activeDays / raw.dailySteps.length),
    goalHitDaysBand: goalHitBand(goalHitDays),
    consistencyBand: consistencyBand(values),
  };

  return record;
}

function monthFromSamples(samples) {
  let month;

  for (const sample of samples) {
    if (typeof sample.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sample.date)) {
      throw new Error('Each dailySteps item must have a YYYY-MM-DD date.');
    }

    const current = sample.date.slice(0, 7);
    if (!month) month = current;
    if (month !== current) {
      throw new Error('All dailySteps samples must be from the same recorded month.');
    }
  }

  return month;
}

function stepBand(steps) {
  if (steps < 3000) return 'under_3k';
  if (steps < 6000) return '3k_6k';
  if (steps < 10000) return '6k_10k';
  if (steps < 15000) return '10k_15k';
  return '15k_plus';
}

function sampleDaysBand(days) {
  if (days <= 3) return '1-3d';
  if (days <= 7) return '4-7d';
  if (days <= 14) return '8-14d';
  if (days <= 21) return '15-21d';
  return '22d-plus';
}

function ratioBand(ratio) {
  if (ratio === 0) return 'none';
  if (ratio < 0.34) return 'low';
  if (ratio < 0.67) return 'moderate';
  return 'high';
}

function goalHitBand(days) {
  if (days === 0) return 'none';
  if (days <= 2) return '1-2d';
  if (days <= 5) return '3-5d';
  if (days <= 10) return '6-10d';
  return '11d-plus';
}

function consistencyBand(values) {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) return 'stable';

  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  const coefficient = Math.sqrt(variance) / average;

  if (coefficient <= 0.25) return 'stable';
  if (coefficient <= 0.5) return 'variable';
  return 'highly_variable';
}

async function encryptDataset({
  datasetPath,
  keyServerObjectIds,
  outDir,
  sealIdentityHex,
  sealPackageId,
  sealPolicyObjectId,
  sealThreshold,
}) {
  const externalCommand = process.env.MODI_SEAL_ENCRYPT_CMD;
  const outputPath = path.join(outDir, externalCommand ? 'step_activity_record.seal.bin' : 'step_activity_record.seal.localdev.json');

  if (externalCommand) {
    const command = applyTemplate(externalCommand, {
      input: shellQuote(datasetPath),
      keyServers: shellQuote(keyServerObjectIds.join(',')),
      output: shellQuote(outputPath),
      packageId: shellQuote(sealPackageId),
      policyObjectId: shellQuote(sealPolicyObjectId),
      sealIdentityHex: shellQuote(sealIdentityHex),
      threshold: shellQuote(String(sealThreshold)),
    });
    const result = spawnSync(command, { encoding: 'utf8', shell: true });
    if (result.error) {
      throw new Error(`MODI_SEAL_ENCRYPT_CMD could not start: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(`MODI_SEAL_ENCRYPT_CMD failed:\n${result.stderr || result.stdout || `exit status ${result.status}`}`);
    }

    const bytes = await readFile(outputPath);
    return {
      bytes,
      mode: 'seal-cli',
      path: outputPath,
    };
  }

  const plaintext = await readFile(datasetPath);
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope = {
    format: 'modi-local-dev-seal-envelope',
    warning: 'Local development fallback only. Use @mysten/seal or seal-cli before storing real user data on Walrus.',
    seal: {
      packageId: sealPackageId,
      identityHex: sealIdentityHex,
      policyObjectId: sealPolicyObjectId,
      threshold: sealThreshold,
      keyServerObjectIds,
    },
    cipher: {
      algorithm: 'aes-256-gcm',
      ivBase64: iv.toString('base64'),
      tagBase64: tag.toString('base64'),
      ciphertextBase64: ciphertext.toString('base64'),
    },
  };

  await writeJson(outputPath, envelope);

  const keyPath = path.join(outDir, 'step_activity_record.local-dev-key.json');
  await writeJson(keyPath, {
    warning: 'Do not upload this file. It exists only so local dry-run output can be decrypted during development.',
    algorithm: 'aes-256-gcm',
    keyBase64: key.toString('base64'),
  });
  await chmod(keyPath, 0o600).catch(() => {});

  return {
    bytes: Buffer.from(stableStringify(envelope)),
    keyPath,
    mode: 'local-dev-fallback',
    path: outputPath,
  };
}

async function storeWalrusBlob(filePath, cfg) {
  const bytes = await readFile(filePath);
  const digest = sha256(bytes);

  if (!cfg.store) {
    return {
      blobId: `dryrun-${digest.slice(0, 48)}`,
      objectId: `0x${digest}`,
      sha256: digest,
      sizeBytes: bytes.length,
      stored: false,
    };
  }

  const walrusBin = process.env.WALRUS_BIN ?? 'walrus';
  const result = spawnSync(walrusBin, [
    'store',
    filePath,
    '--epochs',
    String(cfg.epochs),
    '--context',
    cfg.context,
    '--json',
  ], { encoding: 'utf8' });

  if (result.error) {
    throw new Error(`walrus store could not start (${walrusBin}): ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`walrus store failed for ${filePath}:\n${result.stderr || result.stdout || `exit status ${result.status}`}`);
  }

  const ids = parseWalrusStoreOutput(result.stdout);
  return {
    blobId: ids.blobId,
    objectId: ids.objectId,
    sha256: digest,
    sizeBytes: bytes.length,
    stored: true,
  };
}

function parseWalrusStoreOutput(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = undefined;
  }

  const blobId = (parsed && findValueByKey(parsed, ['blobId', 'blob_id'])) ?? match(stdout, /Blob ID:\s*([^\s]+)/i);
  const objectId =
    (parsed && findObjectId(parsed)) ??
    match(stdout, /Sui object ID:\s*(0x[0-9a-fA-F]+)/i) ??
    match(stdout, /Object ID:\s*(0x[0-9a-fA-F]+)/i);

  if (!blobId || !objectId) {
    throw new Error(`Could not parse Walrus blob/object IDs from output:\n${stdout}`);
  }

  return { blobId, objectId };
}

function findValueByKey(value, keys) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValueByKey(item, keys);
      if (found) return found;
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') return undefined;

  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key) && typeof child === 'string') return child;
    const found = findValueByKey(child, keys);
    if (found) return found;
  }

  return undefined;
}

function findObjectId(value, keyPath = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObjectId(item, keyPath);
      if (found) return found;
    }
    return undefined;
  }

  if (!value || typeof value !== 'object') return undefined;

  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...keyPath, key];
    if (
      typeof child === 'string' &&
      /^0x[0-9a-fA-F]{1,64}$/.test(child) &&
      nextPath.join('.').toLowerCase().includes('object')
    ) {
      return child;
    }

    const found = findObjectId(child, nextPath);
    if (found) return found;
  }

  return undefined;
}

function deriveSealIdentityHex({ datasetSha256, ownerAddress, policyHash, recordedMonth, requestId }) {
  return sha256(Buffer.from([
    'modi:seal:step_activity_record:v1',
    ownerAddress.toLowerCase(),
    requestId.toLowerCase(),
    policyHash,
    recordedMonth,
    datasetSha256,
  ].join(':')));
}

function deriveMemoryNamespace({ ownerAddress, policyId, requestId }) {
  const digest = sha256(Buffer.from([
    'modi:agent-memory:v1',
    ownerAddress.toLowerCase(),
    requestId.toLowerCase(),
    policyId,
  ].join(':')));
  return `modi-agent-memory-${digest.slice(0, 24)}`;
}

function assertPolicyAllowedFields(value, policyPack) {
  const allowed = new Set(policyPack.transformPolicy.allowedFields);
  const keys = Object.keys(value);
  const disallowed = keys.filter((key) => !allowed.has(key));
  if (disallowed.length > 0) {
    throw new Error(`Pseudonymized dataset contains fields outside policy allow-list: ${disallowed.join(', ')}`);
  }
}

function assertNoProhibitedKeys(value, currentPath = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoProhibitedKeys(item, `${currentPath}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (prohibitedRawKeys.has(normalized)) {
      throw new Error(`Prohibited field found at ${currentPath}.${key}`);
    }
    assertNoProhibitedKeys(child, `${currentPath}.${key}`);
  }
}

function collectForbiddenKeys(value, forbidden, currentPath = '$') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectForbiddenKeys(item, forbidden, `${currentPath}[${index}]`));
  }

  if (!value || typeof value !== 'object') return [];

  const found = [];
  for (const [key, child] of Object.entries(value)) {
    const nextPath = `${currentPath}.${key}`;
    if (forbidden.has(normalizeKey(key))) {
      found.push(nextPath);
    }
    found.push(...collectForbiddenKeys(child, forbidden, nextPath));
  }
  return found;
}

function hasLikelyRawStepValues(value) {
  if (Array.isArray(value)) return value.some(hasLikelyRawStepValues);
  if (!value || typeof value !== 'object') return false;

  for (const [key, child] of Object.entries(value)) {
    if (normalizeKey(key).includes('step') && typeof child === 'number' && child > 100) {
      return true;
    }
    if (hasLikelyRawStepValues(child)) return true;
  }
  return false;
}

function assertNoRawStepLeak(value) {
  const serialized = JSON.stringify(value);
  if (/"steps"\s*:/.test(serialized) || /"date"\s*:/.test(serialized)) {
    throw new Error('Pseudonymized dataset must not contain raw steps or date fields.');
  }
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value;
}

function normalizeObjectId(value, name) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    throw new Error(`${name} must be a Sui-style object/address string like 0x1234.`);
  }
  return value.toLowerCase();
}

function assertHexBytes(value, bytes, name) {
  const expectedLength = bytes * 2;
  if (typeof value !== 'string' || !/^[0-9a-fA-F]+$/.test(value) || value.length !== expectedLength) {
    throw new Error(`${name} must be ${bytes} bytes of hex without 0x.`);
  }
}

function assertPositiveInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${stableStringify(value)}\n`);
}

function hashJson(value) {
  return sha256(Buffer.from(stableStringify(value)));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stableStringify(value) {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortJson(child)]));
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--store' || arg === '--allow-local-dev-store') {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      args[key] = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value.`);
      }
      args[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function csv(value) {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => normalizeObjectId(item, 'keyServerObjectId'));
}

function match(value, regex) {
  const result = value.match(regex);
  return result?.[1];
}

function applyTemplate(template, values) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown MODI_SEAL_ENCRYPT_CMD placeholder: {${key}}`);
    return values[key];
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function printHelp() {
  console.log(`Usage:
  node infra/walrus/scripts/prepare_step_upload.mjs [options]

Options:
  --input <path>                    Raw synthetic step sample JSON.
  --out-dir <path>                  Output directory. Default: infra/walrus/build/step-upload
  --owner <0x...>                   User Sui address. Defaults to input.ownerAddress.
  --request-id <0x...>              DataRequest object ID. Defaults to input.requestId.
  --project-id <id>                 Research project ID for policy/memory artifacts.
  --policy-id <id>                  Policy pack ID. Default: step_monthly_reward_policy_v1.
  --allowed-use <value>             Consent purpose/use class. Default: reward_validation.
  --memory-namespace <value>        Agent memory namespace. Defaults to deterministic non-PII namespace.
  --seal-package-id <0x...>         Package containing registry::seal_approve.
  --seal-policy-object-id <0x...>   Access policy object ID recorded in AccessGrant.
  --seal-identity-hex <hex>         32-byte Seal identity. Defaults to deterministic dataset identity.
  --seal-threshold <n>              Seal threshold. Default: 1.
  --key-server-object-ids <ids>     Comma-separated Seal key server object IDs.
  --context <testnet|mainnet>       Walrus context. Default: testnet.
  --epochs <n>                      Walrus storage epochs. Default: 2.
  --store                           Actually call: walrus store <file> --epochs ... --context ... --json
  --allow-local-dev-store           Permit storing local-dev-fallback ciphertext. Synthetic demos only.

Environment:
  MODI_SEAL_ENCRYPT_CMD             Optional command template for real Seal encryption.
                                    Placeholders: {input} {output} {packageId} {sealIdentityHex}
                                    {policyObjectId} {threshold} {keyServers}
  MODI_PROJECT_ID                   Optional project ID for policy/memory artifacts.
  MODI_POLICY_ID                    Optional policy pack ID.
  MODI_ALLOWED_USE                  Optional allowed use class.
  MODI_AGENT_MEMORY_NAMESPACE       Optional Walrus Memory namespace.
  WALRUS_BIN                        Optional Walrus binary name/path.
`);
}
