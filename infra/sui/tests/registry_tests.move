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
        object::id(&asset),
        800,
        &clock,
        scenario.ctx(),
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
    destroy(asset);
    destroy(request);
    clock.destroy_for_testing();

    scenario.next_tx(USER);
    let reward: Coin<SUI> = scenario.take_from_sender();
    assert!(reward.burn_for_testing() == 100);

    scenario.end();
}
