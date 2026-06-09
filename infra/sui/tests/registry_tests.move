#[test_only]
module modi::registry_tests;

use modi::registry;
use std::unit_test::destroy;
use sui::clock;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::test_scenario;

const RESEARCHER: address = @0xA11CE;
const USER: address = @0xB0B;

#[test]
fun registers_data_asset_with_sender_as_owner() {
    let mut scenario = test_scenario::begin(USER);

    let asset = registry::register_data_asset(
        b"dataset_blob",
        b"manifest_blob",
        b"manifest_hash",
        b"1.0.0",
        b"mvp-health-v1",
        b"receipt_blob",
        scenario.ctx(),
    );

    assert!(registry::data_asset_owner(&asset) == USER);

    let mut workflow = registry::register_agent_workflow_anchor(
        &asset,
        b"policy_blob",
        b"policy_hash",
        b"step-policy-v1",
        b"agent_audit_blob",
        b"agent_audit_hash",
        b"checkpoint_blob",
        b"checkpoint_hash",
        b"user:step_upload",
        b"sui_registration_ready",
        true,
        scenario.ctx(),
    );
    assert!(registry::agent_workflow_data_asset_id(&workflow) == object::id(&asset));
    assert!(registry::agent_workflow_audit_passed(&workflow));

    registry::update_agent_workflow_checkpoint(
        &mut workflow,
        b"checkpoint_blob_2",
        b"checkpoint_hash_2",
        b"access_grant_pending",
        scenario.ctx(),
    );
    assert!(registry::agent_workflow_latest_stage(&workflow) == b"access_grant_pending");

    destroy(workflow);
    destroy(asset);
    scenario.end();
}

#[test]
fun creates_request_consent_access_log_and_reward() {
    let mut scenario = test_scenario::begin(RESEARCHER);
    let clock = clock::create_for_testing(scenario.ctx());
    let payment = coin::mint_for_testing<SUI>(100, scenario.ctx());

    let (request, escrow) = registry::create_request(
        b"diabetes_research",
        b"criteria_hash",
        1_000,
        payment,
        &clock,
        scenario.ctx(),
    );

    assert!(registry::data_request_researcher(&request) == RESEARCHER);

    scenario.next_tx(USER);
    let asset = registry::register_data_asset(
        b"dataset_blob",
        b"manifest_blob",
        b"manifest_hash",
        b"1.0.0",
        b"mvp-health-v1",
        b"receipt_blob",
        scenario.ctx(),
    );
    let workflow = registry::register_agent_workflow_anchor(
        &asset,
        b"policy_blob",
        b"policy_hash",
        b"step-policy-v1",
        b"agent_audit_blob",
        b"agent_audit_hash",
        b"checkpoint_blob",
        b"checkpoint_hash",
        b"user:step_upload",
        b"sui_registration_ready",
        true,
        scenario.ctx(),
    );
    let consent = registry::grant_consent(
        &request,
        &asset,
        b"diabetes_research",
        900,
        &clock,
        scenario.ctx(),
    );

    assert!(registry::consent_user(&consent) == USER);
    assert!(!registry::consent_revoked(&consent));

    scenario.next_tx(RESEARCHER);
    let access_grant = registry::create_access_grant(
        &request,
        &consent,
        b"step_upload_policy_identity",
        object::id(&asset),
        800,
        &clock,
        scenario.ctx(),
    );
    assert!(registry::access_grant_seal_identity(&access_grant) == b"step_upload_policy_identity");
    registry::seal_approve(
        b"step_upload_policy_identity",
        &access_grant,
        &consent,
        &asset,
        &clock,
    );
    registry::seal_approve_with_agent_workflow(
        b"step_upload_policy_identity",
        &access_grant,
        &consent,
        &asset,
        &workflow,
        &clock,
    );
    let access_log = registry::record_data_access(
        &access_grant,
        &consent,
        &asset,
        &clock,
        scenario.ctx(),
    );

    assert!(!registry::access_grant_revoked(&access_grant));

    registry::pay_reward(escrow, &request, &consent, &access_log, &clock, scenario.ctx());

    destroy(access_log);
    destroy(access_grant);
    destroy(consent);
    destroy(workflow);
    destroy(asset);
    destroy(request);
    clock.destroy_for_testing();

    scenario.next_tx(USER);
    let reward: Coin<SUI> = scenario.take_from_sender();
    assert!(reward.burn_for_testing() == 100);

    scenario.end();
}
