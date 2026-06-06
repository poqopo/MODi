module modi::registry;

use sui::balance::Balance;
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;

const EInvalidAmount: u64 = 1;
const EExpired: u64 = 2;
const EUnauthorized: u64 = 3;
const EInactiveRequest: u64 = 4;
const EConsentRevoked: u64 = 5;
const ERequestMismatch: u64 = 6;
const EAssetMismatch: u64 = 7;
const EInvalidExpiry: u64 = 8;

public struct DataRequest has key, store {
    id: UID,
    researcher: address,
    purpose: vector<u8>,
    criteria_hash: vector<u8>,
    reward_amount: u64,
    expires_at_ms: u64,
    active: bool,
}

public struct DataAsset has key, store {
    id: UID,
    owner: address,
    dataset_blob_id: vector<u8>,
    manifest_blob_id: vector<u8>,
    manifest_hash: vector<u8>,
    schema_version: vector<u8>,
    processing_policy_version: vector<u8>,
    processing_receipt_blob_id: vector<u8>,
}

public struct ConsentGrant has key, store {
    id: UID,
    user: address,
    request_id: ID,
    data_asset_id: ID,
    purpose: vector<u8>,
    expires_at_ms: u64,
    revoked: bool,
}

public struct AccessGrant has key, store {
    id: UID,
    researcher: address,
    consent_id: ID,
    seal_policy_object_id: ID,
    expires_at_ms: u64,
    revoked: bool,
}

public struct AccessLog has key, store {
    id: UID,
    researcher: address,
    consent_id: ID,
    data_asset_id: ID,
    accessed_at_ms: u64,
}

public struct RewardEscrow has key, store {
    id: UID,
    request_id: ID,
    researcher: address,
    amount: u64,
    funds: Balance<SUI>,
}

public struct DataRequestCreated has copy, drop {
    request_id: ID,
    escrow_id: ID,
    researcher: address,
    reward_amount: u64,
    expires_at_ms: u64,
}

public struct DataAssetRegistered has copy, drop {
    asset_id: ID,
    owner: address,
}

public struct ConsentGranted has copy, drop {
    consent_id: ID,
    request_id: ID,
    data_asset_id: ID,
    user: address,
    expires_at_ms: u64,
}

public struct ConsentRevoked has copy, drop {
    consent_id: ID,
    user: address,
}

public struct AccessGranted has copy, drop {
    access_grant_id: ID,
    consent_id: ID,
    researcher: address,
    seal_policy_object_id: ID,
    expires_at_ms: u64,
}

public struct DataAccessed has copy, drop {
    access_log_id: ID,
    access_grant_id: ID,
    consent_id: ID,
    data_asset_id: ID,
    researcher: address,
    accessed_at_ms: u64,
}

public struct RewardPaid has copy, drop {
    escrow_id: ID,
    request_id: ID,
    consent_id: ID,
    recipient: address,
    amount: u64,
}

public fun create_request(
    purpose: vector<u8>,
    criteria_hash: vector<u8>,
    expires_at_ms: u64,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
): (DataRequest, RewardEscrow) {
    let reward_amount = payment.value();
    assert!(reward_amount > 0, EInvalidAmount);
    assert!(expires_at_ms > clock.timestamp_ms(), EExpired);

    let researcher = ctx.sender();
    let request = DataRequest {
        id: object::new(ctx),
        researcher,
        purpose,
        criteria_hash,
        reward_amount,
        expires_at_ms,
        active: true,
    };

    let request_id = object::id(&request);
    let escrow = RewardEscrow {
        id: object::new(ctx),
        request_id,
        researcher,
        amount: reward_amount,
        funds: coin::into_balance(payment),
    };

    event::emit(DataRequestCreated {
        request_id,
        escrow_id: object::id(&escrow),
        researcher,
        reward_amount,
        expires_at_ms,
    });

    (request, escrow)
}

public fun deactivate_request(request: &mut DataRequest, ctx: &mut TxContext) {
    assert!(request.researcher == ctx.sender(), EUnauthorized);
    request.active = false;
}

public fun register_data_asset(
    dataset_blob_id: vector<u8>,
    manifest_blob_id: vector<u8>,
    manifest_hash: vector<u8>,
    schema_version: vector<u8>,
    processing_policy_version: vector<u8>,
    processing_receipt_blob_id: vector<u8>,
    ctx: &mut TxContext,
): DataAsset {
    let owner = ctx.sender();
    let asset = DataAsset {
        id: object::new(ctx),
        owner,
        dataset_blob_id,
        manifest_blob_id,
        manifest_hash,
        schema_version,
        processing_policy_version,
        processing_receipt_blob_id,
    };

    event::emit(DataAssetRegistered {
        asset_id: object::id(&asset),
        owner,
    });

    asset
}

public fun grant_consent(
    request: &DataRequest,
    asset: &DataAsset,
    purpose: vector<u8>,
    expires_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ConsentGrant {
    let now_ms = clock.timestamp_ms();
    assert!(request.active, EInactiveRequest);
    assert!(request.expires_at_ms > now_ms, EExpired);
    assert!(asset.owner == ctx.sender(), EUnauthorized);
    assert!(expires_at_ms > now_ms, EExpired);
    assert!(expires_at_ms <= request.expires_at_ms, EInvalidExpiry);

    let consent = ConsentGrant {
        id: object::new(ctx),
        user: ctx.sender(),
        request_id: object::id(request),
        data_asset_id: object::id(asset),
        purpose,
        expires_at_ms,
        revoked: false,
    };

    event::emit(ConsentGranted {
        consent_id: object::id(&consent),
        request_id: consent.request_id,
        data_asset_id: consent.data_asset_id,
        user: consent.user,
        expires_at_ms,
    });

    consent
}

public fun revoke_consent(consent: &mut ConsentGrant, ctx: &mut TxContext) {
    assert!(consent.user == ctx.sender(), EUnauthorized);
    consent.revoked = true;

    event::emit(ConsentRevoked {
        consent_id: object::id(consent),
        user: consent.user,
    });
}

public fun create_access_grant(
    request: &DataRequest,
    consent: &ConsentGrant,
    seal_policy_object_id: ID,
    expires_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): AccessGrant {
    let now_ms = clock.timestamp_ms();
    assert!(request.researcher == ctx.sender(), EUnauthorized);
    assert!(request.active, EInactiveRequest);
    assert!(request.expires_at_ms > now_ms, EExpired);
    assert!(consent.request_id == object::id(request), ERequestMismatch);
    assert!(!consent.revoked, EConsentRevoked);
    assert!(consent.expires_at_ms > now_ms, EExpired);
    assert!(expires_at_ms > now_ms, EExpired);
    assert!(expires_at_ms <= consent.expires_at_ms, EInvalidExpiry);

    let access_grant = AccessGrant {
        id: object::new(ctx),
        researcher: ctx.sender(),
        consent_id: object::id(consent),
        seal_policy_object_id,
        expires_at_ms,
        revoked: false,
    };

    event::emit(AccessGranted {
        access_grant_id: object::id(&access_grant),
        consent_id: access_grant.consent_id,
        researcher: access_grant.researcher,
        seal_policy_object_id,
        expires_at_ms,
    });

    access_grant
}

public fun revoke_access_grant(access_grant: &mut AccessGrant, ctx: &mut TxContext) {
    assert!(access_grant.researcher == ctx.sender(), EUnauthorized);
    access_grant.revoked = true;
}

public fun record_data_access(
    access_grant: &AccessGrant,
    consent: &ConsentGrant,
    asset: &DataAsset,
    clock: &Clock,
    ctx: &mut TxContext,
): AccessLog {
    let now_ms = clock.timestamp_ms();
    assert!(access_grant.researcher == ctx.sender(), EUnauthorized);
    assert!(!access_grant.revoked, EConsentRevoked);
    assert!(access_grant.expires_at_ms > now_ms, EExpired);
    assert!(access_grant.consent_id == object::id(consent), ERequestMismatch);
    assert!(!consent.revoked, EConsentRevoked);
    assert!(consent.expires_at_ms > now_ms, EExpired);
    assert!(consent.data_asset_id == object::id(asset), EAssetMismatch);

    let access_log = AccessLog {
        id: object::new(ctx),
        researcher: ctx.sender(),
        consent_id: object::id(consent),
        data_asset_id: object::id(asset),
        accessed_at_ms: now_ms,
    };

    event::emit(DataAccessed {
        access_log_id: object::id(&access_log),
        access_grant_id: object::id(access_grant),
        consent_id: access_log.consent_id,
        data_asset_id: access_log.data_asset_id,
        researcher: access_log.researcher,
        accessed_at_ms: now_ms,
    });

    access_log
}

public fun pay_reward(
    escrow: RewardEscrow,
    request: &DataRequest,
    consent: &ConsentGrant,
    access_log: &AccessLog,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock.timestamp_ms();
    assert!(escrow.researcher == ctx.sender(), EUnauthorized);
    assert!(escrow.request_id == object::id(request), ERequestMismatch);
    assert!(consent.request_id == object::id(request), ERequestMismatch);
    assert!(access_log.researcher == ctx.sender(), EUnauthorized);
    assert!(access_log.consent_id == object::id(consent), ERequestMismatch);
    assert!(access_log.data_asset_id == consent.data_asset_id, EAssetMismatch);
    assert!(!consent.revoked, EConsentRevoked);
    assert!(consent.expires_at_ms > now_ms, EExpired);

    let RewardEscrow {
        id,
        request_id,
        researcher: _,
        amount,
        funds,
    } = escrow;

    let escrow_id = id.to_inner();
    id.delete();

    event::emit(RewardPaid {
        escrow_id,
        request_id,
        consent_id: object::id(consent),
        recipient: consent.user,
        amount,
    });

    transfer::public_transfer(coin::from_balance(funds, ctx), consent.user);
}

public fun data_request_researcher(request: &DataRequest): address {
    request.researcher
}

public fun data_request_expires_at_ms(request: &DataRequest): u64 {
    request.expires_at_ms
}

public fun data_asset_owner(asset: &DataAsset): address {
    asset.owner
}

public fun consent_user(consent: &ConsentGrant): address {
    consent.user
}

public fun consent_revoked(consent: &ConsentGrant): bool {
    consent.revoked
}

public fun access_grant_revoked(access_grant: &AccessGrant): bool {
    access_grant.revoked
}
