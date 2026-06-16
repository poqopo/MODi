# MODi 구현 현황

현재 기준: 2026-06-14

이 문서는 `SetUp.md`의 목표 흐름을 기준으로 현재까지 된 것과 아직 안 된 것을 정리한다.

## 요약

현재 MVP 데모의 핵심 포지셔닝은 **Policy-Adaptive Healthcare MyData Privacy Agent**다.

문제 정의는 헬스케어 마이데이터 확산이다. 개인이 보험, 리워드, 건강 코칭, 연구 기업에 직접 데이터를 보낼 수 있게 되면 활용 가능성은 커지지만, 기업별 요청사항에 맞춰 데이터를 안전하게 가공하고 개인정보 유출을 막는 일이 어려워진다. 특히 정책과 요청 범위가 바뀔 때마다 앱 로직을 고정 업데이트하는 방식은 유지하기 어렵다.

MODi는 이 문제를 Walrus 기반 policy memory와 platform Privacy/Security Agent loop로 푼다. 기관은 public `policy_pack`을 Walrus에 publish하고, user-app은 그 policy를 fetch해 로컬 가명처리/암호화를 수행한다. platform Security Agent는 Walrus policy memory와 learned `security_memory`를 recall해 안전성을 한 번 더 검증하고, 검증 판단 기록을 Walrus audit trail로 남긴다.

Seal은 현재 데모의 필수 경로가 아니라 production Roadmap이다. 데모에서는 local encryption/decryption, 정책 변화에 대응 가능한 policy memory, 그리고 새로운 보안 위험을 다음 제출에서 recall하는 Security Memory를 강조한다.

현재 MVP에서 실제로 확인된 핵심 흐름은 다음과 같다.

1. 기관 대시보드에서 연구/데이터 요청을 만들면 public `policy_pack`을 생성하고 Walrus에 저장한다.
   - 랜딩의 연구 생성 버튼은 먼저 Slush 지갑 연결을 요구한다.
2. user-app은 연구 참여/제출 시 Walrus에서 기관 요청사항이 담긴 public `policy_pack`을 가져오고 hash를 검증한다.
3. user-app이 헬스케어 마이데이터 제출 payload를 로컬에서 가명처리/일반화한다.
4. platform Privacy/Security Agent는 최신 Walrus Security Memory를 먼저 recall하고, 그 다음 Walrus policy memory를 다시 읽어 payload를 수정하지 않은 채 개인정보 안전성만 검증한다.
5. 검증에서 문제가 나오면 Agent가 `securityMemoryPatch`를 반환하고, user-app이 payload를 한 번 더 안전화한 뒤 재검증한다.
6. 새 보안 위험 pattern은 user-app이 `security_memory` artifact로 Walrus에 append하고, 프로젝트 최신 memory ref를 DB에 저장한다.
7. 검증을 통과하면 user-app이 Security Agent audit artifact와 encrypted dataset을 Walrus에 업로드한다.
8. 기관 대시보드의 데이터 관리 탭에서 참가자가 올린 encrypted dataset Walrus blob을 다운로드할 수 있다.
9. 기관 대시보드의 Security Agent Audit Trail에서 제출과 연결된 Walrus audit artifact를 확인할 수 있다.
10. 기관 대시보드는 URL 라우팅을 사용하므로 새로고침해도 연구/탭 위치가 유지된다.

아직 제품 수준으로 안 된 핵심 항목은 strict local 복호화 UI, user-app의 Sui PTB 서명/실행, Seal 기반 policy-gated decryption, production 배포 라우팅 설정이다. Seal 복호화를 위한 Move 권한 경로와 기관 Slush 기반 `DataRequest` 생성 경로는 실험적으로 반영했지만, 데모 메시지에서는 Roadmap으로 둔다.

## SetUp.md 기준 진행 현황

| 번호 | 목표 흐름 | 현재 상태 | 메모 |
|---:|---|---|---|
| 1 | 기관이 연구를 생성한다 | 완료 | 기관 대시보드에서 연구 생성, Supabase 저장, 사용자 앱 모집 목록 반영까지 연결됨 |
| 2 | 기관이 필요한 데이터 범위를 policy pack으로 만든다 | 부분 완료 | `policyPack.ts`가 데이터 범위 기반으로 public policy pack을 만든다 |
| 3 | policy pack을 Walrus에 저장한다 | 완료 | 연구 생성 시 policy pack JSON을 Walrus testnet publisher에 저장하고 blob id/hash/object id를 DB에 저장 |
| 4 | 사용자가 앱에서 연구 참여를 누른다 | 완료 | user-app에서 연구 목록 조회, 참여 신청, 기관 승인, 내 프로젝트 표시 흐름 동작 |
| 5 | user-app이 policy를 Walrus에서 가져온다 | 완료 | 제출 직전 user-app이 `policy_pack_blob_id`로 public policy pack을 가져오고 저장된 hash와 비교한 뒤 로컬 가명처리를 수행 |
| 6 | HealthKit 데이터를 로컬에서 가명처리한다 | 부분 완료 | user-app에서 제출 payload를 로컬 가명처리한다. 다만 현재는 데모 Apple Health 데이터 기반이며 실제 iOS HealthKit native 권한/수집은 제품 수준 통합 전 |
| 7 | Security Agent가 payload를 검사한다 | 완료 | platform Security Agent가 최신 Walrus Security Memory를 먼저 recall하고, Walrus policy memory를 직접 fetch한 뒤 policy forbidden fields, 기본 안전성 규칙, 준식별자 위험 패턴으로 payload를 재검증한다 |
| 8 | audit trail과 processing receipt를 Walrus에 저장한다 | 부분 완료 | user-app이 `pseudonymization_plan`, `privacy_verification_receipt`, `security_memory`, `agent_workflow_manifest`를 Walrus에 저장하고 Supabase metadata에 blob/hash refs를 남긴다. Security receipt에는 policy memory ref, security memory ref/patch, 검증 attempt, safety edit, 최종 receipt hash가 남는다 |
| 9 | encrypted dataset을 Walrus에 저장한다 | 부분 완료 | 데모 메시지는 local client-side encryption이다. 현재 코드에는 Seal SDK envelope 실험 경로가 남아 있으므로 strict local encryption/decryption 데모를 위해서는 암호화 envelope 명칭과 복호화 UI를 정리해야 한다 |
| 10 | Sui에 DataAsset을 등록한다 | 부분 완료 | Move registry는 DataAsset, ConsentGrant, user-issued AccessGrant 경로를 지원한다. 현재 user-app 제출 버튼은 아직 이 PTB를 서명/실행하지 않음 |
| 11 | 다음 세션에서 Agent가 Walrus Memory를 recall한다 | 부분 완료 | project별 최신 `security_memory`를 Walrus에서 fetch하고, 과거 위험 signal pattern과 현재 payload signal이 일치하면 `security_memory_known_risk_pattern`을 먼저 반환한다. 일반적인 장기 task checkpoint recall은 아직 없음 |

## 완료된 주요 기능

### 기관 대시보드

- Supabase 기반 기관 로그인 게이트.
- 랜딩의 연구 생성 버튼에서 Slush 지갑 연결 modal을 먼저 열고, 연결된 Sui 주소를 기관 researcher 주소로 사용.
- 연구 생성 시 Slush 서명으로 Sui `DataRequest`를 만들고 shared object로 공개한 뒤 object id/tx digest를 Supabase에 저장.
- 연구 생성 시 `research_projects` 저장.
- 연구 생성 시 public `policy_pack` 생성 및 Walrus 저장.
- 참여 신청 승인/거절.
- 참여자/제출/정산 데이터 조회.
- 데이터 관리 탭에서 참가자 제출 encrypted dataset Walrus blob 다운로드.
- 데이터 관리 탭에서 Security Agent Audit Trail 표시.
  - `pseudonymization_plan`
  - `privacy_verification_receipt`
  - `agent_workflow_manifest`
- 참가자 식별자는 긴 주소를 그대로 노출하지 않고 축약 표시.
- 새로고침해도 위치가 유지되는 라우팅.
  - `/research/new`
  - `/research/:projectId`
  - `/research/:projectId/participants`
  - `/research/:projectId/datasets`
  - `/research/:projectId/settlements`

### user-app

- Supabase에서 모집중 연구 조회.
- 연구 참여 신청.
- 승인된 연구를 내 프로젝트에서 표시.
- 제출 전 Walrus에서 `policy_pack` 조회.
- `policy_pack` hash 검증.
- user-app 내부에서 payload 가명처리.
  - `loginId`, `walletAddress` 제거.
  - 참가자는 project-scoped pseudonym id로 표현.
  - 날짜는 월 단위로 일반화.
- platform server 검증에서 문제가 나오면 user-app이 unsafe field/value를 제거 또는 월 단위로 일반화한 뒤 재검증.
- Security Agent가 새 위험 pattern을 반환하면 user-app이 `security_memory` artifact를 Walrus에 올리고 다음 제출에서 재사용되도록 project 최신 memory ref를 업데이트.
- local 가명처리 계획, Security Agent receipt, workflow manifest를 audit artifact로 만들어 Walrus에 저장.
  - long-term memory에는 raw payload와 평문 헬스케어 데이터가 들어가지 않는다.
  - Security receipt에는 policy memory ref, 검증 attempt별 payload hash, receipt hash, finding code/count, safety edit만 남긴다.
- platform server 검증 통과 후 user-app이 encrypted dataset envelope를 Walrus에 직접 업로드.
- 데모 포지셔닝은 local client-side encryption/decryption이다. 현재 코드의 Seal SDK envelope 경로는 Roadmap 실험 흔적으로 보고, 데모 전 strict local crypto envelope로 정리하는 것이 바람직하다.
- Walrus upload Tx를 Sui fullnode에서 확인.

### platform / Supabase

- `verify-participant-payload` Edge Function 추가.
  - payload를 수정하지 않음.
  - Walrus 업로드도 하지 않음.
  - 최신 Walrus Security Memory를 먼저 fetch하고, 과거 위험 signal pattern을 현재 payload signal과 비교.
  - Walrus public `policy_pack`을 직접 fetch하고 policy hash를 재검증.
  - policy forbidden fields를 기본 안전성 규칙과 합쳐 검사.
  - 직접 식별자 key, email, phone-like value, Sui address, 정확한 날짜/타임스탬프를 검증.
- `submit-participant-data` Edge Function 업데이트.
  - encrypted dataset Walrus blob id/object id/hash/tx 저장.
  - privacy verification receipt hash 저장.
  - Security Agent audit artifact refs를 `metadata.agent_memory`에 저장.
  - user-app이 새 `security_memory` artifact를 제출하면 `research_projects.security_memory_*` 최신 ref를 업데이트.
  - encryption provider/mode/seal identity 저장.
  - 검증 통과 제출은 `policy_passed`로 저장.
- 예전 서버 수정형 `review-participant-payload` 흐름 제거.

## 실제 확인한 E2E 결과

아래 기록은 Seal SDK envelope 실험 경로로 확인했던 historical E2E 결과다. 현재 데모 포지셔닝은 local client-side encryption/decryption이며, strict local crypto demo를 위해서는 새 제출로 다시 확인해야 한다.

테스트 사용자: `user-a2048`

최신 확인 제출:

- Supabase submission id: `772daf37-67be-448e-b48d-34a30813f1b7`
- Submitted at: `2026-06-11T13:23:53.911Z`
- Validation status: `policy_passed`
- Walrus encrypted dataset blob id: `brxkVZOR8xofVMp2ktso1ADtGlRbrfprP_yq-cCGx6M`
- Walrus object id: `0xdd089523662370d390cb40bc7c5796211ec835871494e353ee6e62e5174bfe7f`
- Walrus Tx digest: `7C6rr4vhRPPd8527XVB6qiTfnkrPwnfGNrPRjnsLXhpB`
- Encrypted dataset hash: `91cd12dc25092ebbdb9354877b2fab67413767516a48eb706606e91c5a3fbeef`
- Pseudonymized plaintext payload hash: `e6a9e84b5b153f6ddcdd21ecf27dbd59488725f7f51ffe803e83a1769fcf550a`
- Privacy verification receipt hash: `783c06c36594ea83b161cc55337e353be03f94924356bc915495c7d80e800fc4`
- Encryption provider: `seal`
- Encryption mode: `seal-sdk`
- Seal identity hex: `0a7755fb066bdcdba637d7bb43c3f4a3486d1cbfa3689fd953f706fe74c26b47`

Walrus에서 blob을 다시 내려받아 확인한 내용:

- SHA-256이 Supabase `walrus_manifest_hash`와 일치.
- `schemaVersion`은 `modi.encrypted-health-dataset.v1`.
- `encryption.provider`는 `seal`.
- `encryption.mode`는 `seal-sdk`.
- `encryption.packageId`는 `0x63021cfa4e4d4e110352e0ea9d9f0a321c9f355ba57acf3de84494079b6290f2`.
- `cipher.encryptedObjectBase64`는 1579 byte Seal encrypted object로 복원됨.
- JSON 내부에 `loginId`, `walletAddress`, `user-a2048`, 참가자 pseudonym id가 없음.
- 실제 가명처리 payload는 Seal encrypted object 안에만 존재.

주의: 위 E2E 제출은 user-issued AccessGrant package publish 전의 제출이다. 2026-06-11에 user-app 기본 Seal package를 `0xc5be8a456d0ba7d33fbcff12e92d73181a3817872f6598f5cea65a5326ab3e21`로 갱신했으므로 새 제출은 이 package ID로 암호화된다.

## Local Encryption Demo Flow

현재 데모에서 보여줄 복호화 흐름은 Seal이 아니라 local browser decryption이다.

1. user-app은 최종 가명처리 payload를 로컬에서 암호화한다.
2. encrypted dataset만 Walrus에 업로드한다.
3. Security Agent 검증 결과와 safety edit 이력은 Walrus audit trail로 저장한다.
4. 기관 대시보드는 Security Agent audit artifact와 encrypted dataset을 Walrus에서 다운로드한다.
5. 기관 브라우저에서 로컬 복호화를 수행한다.
6. 복호화된 plaintext는 서버와 DB에 저장하지 않는다.

데모에서 강조할 점은 다음이다.

- Walrus에는 평문 헬스케어 데이터가 올라가지 않는다.
- Agent Memory에는 raw payload가 아니라 hash, receipt, finding code/count, safety edit만 남는다.
- 복호화 순간에 Sui transaction은 나가지 않는다.
- 데모 key management는 production-grade access control이 아니다.

## Seal Roadmap

Seal을 도입하면 Walrus blob을 받는 것만으로는 복호화할 수 없다. Seal key server가 key share를 내주려면 기관 지갑이 `registry::seal_approve`를 통과하는 transaction bytes를 만들어야 하고, 그 transaction이 다음 객체들을 참조해야 한다.

- `DataRequest`: 기관이 연구 생성 시 만든 요청 객체. researcher 주소가 기관 지갑이어야 한다.
- `DataAsset`: 사용자가 Walrus encrypted dataset blob을 가리키도록 등록한 객체.
- `ConsentGrant`: 사용자가 해당 `DataRequest`와 `DataAsset`에 대해 생성한 동의 객체.
- `AccessGrant`: 사용자가 제출 시 `grant_access_to_request_researcher`로 생성하고 기관 지갑에 transfer한 복호화 권한 객체.

Roadmap 제품 흐름은 다음과 같다.

1. 기관이 연구를 만들 때 Sui에서 `DataRequest`를 생성하고 DB에 `sui_data_request_id`, `researcher_sui_address`, Seal package ID를 저장한다.
2. user-app은 가명처리와 platform 안전성 검증을 통과한 payload만 Seal policy 기반으로 암호화하고 Walrus에 업로드한다.
3. user-app은 같은 제출 PTB에서 `register_data_asset`, `grant_consent`, `grant_access_to_request_researcher`를 실행한다.
4. user-app은 `DataAsset`과 `ConsentGrant`를 shared object로 만들고, 반환된 `AccessGrant`를 기관 researcher 지갑으로 transfer한다.
5. user-app은 DB에 `sui_data_asset_id`, `sui_consent_grant_id`, `sui_access_grant_id`, registry tx digest를 저장한다.
6. 기관 대시보드는 다운로드 시 Walrus envelope를 받은 뒤, 기관 지갑 session key로 `registry::seal_approve` approval transaction bytes를 만들고 Seal SDK `decrypt`를 호출한다.
7. 복호화된 JSON만 브라우저 다운로드로 제공한다. 서버와 DB에는 복호화 plaintext를 저장하지 않는다.

## 아직 안 된 것

### 보안/프라이버시

- 기관 대시보드 다운로드는 현재 Walrus encrypted envelope를 직접 다운로드한다. 데모용 local browser decryption UI는 아직 정리 전이다.
- Seal session key로 `AccessGrant`, `ConsentGrant`, `DataAsset`를 참조해 복호화하는 UI는 Roadmap이다.
- 현재 가명처리 검증은 규칙 기반이다. 직접 식별자와 policy forbidden field 검증에 더해 좁은 연령대, 세부 지역, 희귀 건강 상태, 상세 기기 모델, outlier 활동 band 조합에 대한 준식별자 재식별 위험 탐지를 추가했다. 다만 k-anonymity나 실제 cohort size 기반 위험도 계산은 아직 없다.

### Security Agent / Audit Trail

- user-app은 제출마다 다음 Security Agent audit artifact를 Walrus에 저장한다.
  - `Local Pseudonymization Plan`
  - `Security Agent Verification Receipt`
  - `MODi Agent Workflow Memory`
- `Security Agent Verification Receipt`는 Walrus policy memory ref, 초기 검증, 재검증 기록을 `longTermVerificationTrace`로 남긴다.
- `Security Agent Learned Risk Memory`는 과거 finding code, 준식별자 signal code, 권장 일반화 규칙만 저장한다. raw payload와 평문 헬스케어 데이터는 포함하지 않는다.
- `MODi Agent Workflow Memory`는 public policy pack, local pseudonymization plan, Security receipt, Security Memory, encrypted dataset blob을 hash/blob ref로 연결한다.
- 기관 대시보드는 제출 metadata의 audit refs를 읽어 데이터 관리 탭에서 보여준다.
- Compliance Agent 감사라는 승인/거절 절차는 현재 요구사항에서 제외했다. 현재는 platform Security Agent가 개인정보를 더 안전하게 만들기 위해 검증/안전화 루프를 수행하는 흐름이다.
- 다음 제출에서 Security Agent가 project 최신 Security Memory를 recall해 이전에 발견된 위험 pattern을 먼저 확인하는 기능을 추가했다.

### Blockchain / Sui

- Walrus 업로드 Tx 확인은 한다.
- Seal-compatible MODi Move package를 testnet에 새로 publish했다. 다만 데모 메시지에서는 Seal을 Roadmap으로 둔다.
- 최신 package `0xc5be8a456d0ba7d33fbcff12e92d73181a3817872f6598f5cea65a5326ab3e21`는 사용자가 제출 시 `DataRequest` researcher에게 `AccessGrant`를 발급할 수 있는 실험 경로다.
- 기관 대시보드는 Slush 연결 주소를 `researcher_sui_address`로 저장한다.
- 연구 생성 시 실제 Sui `DataRequest`를 만드는 PTB가 연결됐다. `DataRequest`는 shared object가 되고, `RewardEscrow`는 기관 지갑 소유로 남는다.
- 현재 `DataRequest` 생성용 escrow는 MVP 안전값인 1 MIST 기본값을 사용한다. 실제 보상 금액은 Supabase 정산 필드에 유지된다.
- MODi Move registry의 `DataAsset`, `ConsentGrant`, `AccessGrant` 생성을 user-app 제출 버튼과 아직 연결하지 않았다.
- `AgentWorkflowAnchor`를 실제 앱 플로우에서 만들지 않는다.
- 보상/정산 UI는 Supabase 상태 업데이트 중심이며 실제 on-chain reward escrow 지급은 아직 아니다.

### 제품화/운영

- 실제 iOS HealthKit native 권한 요청과 실데이터 수집은 제품 수준으로 완성되지 않았다.
- 기관 대시보드 production 배포 시 `/research/...` 직접 접근/새로고침을 위해 SPA fallback 설정이 필요하다.
- Edge Function 배포는 되어 있지만, 로컬 개발에서 검증 API를 직접 띄우려면 `supabase functions serve verify-participant-payload --no-verify-jwt`를 사용해야 한다.
- 자동화된 E2E 테스트 파일은 아직 없다. 현재는 수동 Playwright 확인과 CLI 검증 중심이다.

## 검증한 명령

- `apps/institution-dashboard`: `npm run lint`
- `apps/institution-dashboard`: `npm run build`
- `apps/user-app`: `npm run typecheck`
- `verify-participant-payload` remote test
  - Walrus testnet에 demo public `policy_pack` 업로드.
  - 배포된 Supabase Edge Function이 같은 Walrus policy memory를 fetch/hash 검증하는지 확인.
  - clean payload는 통과.
  - 직접 식별자는 없지만 준식별자 조합 위험이 있는 payload는 `quasi_identifier_combination_risk`, `small_cohort_reidentification_risk`로 실패.
  - local safety edit 후 fixed payload는 재검증 통과.
- `verify-participant-payload` Security Memory recall remote test
  - 첫 위험 payload 검증에서 `securityMemoryPatch` 생성 확인.
  - patch 기반 `security_memory` artifact를 Walrus에 업로드.
  - 같은 위험 payload를 Security Memory ref와 함께 재검증했을 때 `security_memory_known_risk_pattern`이 먼저 반환됨.
  - 안전화된 payload는 Security Memory를 recall해도 통과.
- 기관 대시보드 Playwright 확인
  - `/research` 데모 기관 진입.
  - `/research/:projectId/datasets` 데이터 관리 탭 렌더링.
  - Security Agent Audit Trail과 Walrus 다운로드 테이블 표시.
- `infra/sui`: `sui move build`
- `infra/sui`: `sui move test`
- Sui testnet publish: `8eeJc1ZXJv3KkFP8PKwB24t539FGdh74Ny4Mh9yZE5wK`
- Sui testnet publish, user-issued AccessGrant package: `Rbre8UbUJ69RpLTxCM1QG1A5tSd3n9sy6TjVg4n85BH`
- Seal SDK encrypt smoke test
- Edge Functions: esbuild bundle check
- Supabase Edge Functions deploy
  - `create-research-project`
  - `verify-participant-payload`
  - `submit-participant-data`
- Supabase DB migration: `20260611184500_researcher_slush_wallet_refs`
- Supabase DB migration: `20260611190500_research_reward_escrow_ref`
- Playwright 수동 확인
  - 랜딩 `연구 생성` 버튼 클릭 시 Slush 전용 지갑 연결 modal 표시.
  - `/research/new` 직접 진입.
  - `/research/:projectId/datasets` 새로고침 후 데이터 관리 화면 유지.
  - user-app 제출 후 Walrus encrypted dataset blob read-back/hash 확인.

## Agent 검증 서버에 대한 결정

별도 상시 서버를 새로 띄울 필요는 없다.

현재 구조에서는 Supabase Edge Function `verify-participant-payload`가 Agent 검증 서버 역할을 한다. 이 함수는 user-app이 만든 가명처리 payload를 받아서 안전성만 확인하고, payload를 수정하거나 Walrus에 업로드하지 않는다. 문제가 있으면 user-app이 payload를 안전화한 뒤 재검증하고, 그래도 실패하면 업로드를 중단한다.

로컬에서 함수만 테스트해야 할 때는 다음처럼 띄우면 된다.

```bash
supabase functions serve verify-participant-payload --no-verify-jwt
```
