# MODi Security Agent Demo Flow

현재 데모의 핵심 메시지는 **Policy-Adaptive Healthcare MyData Privacy Agent**다.

의료 및 헬스케어 마이데이터가 늘어나면서 개인은 보험, 리워드, 건강 코칭, 연구 기업에 직접 데이터를 보낼 수 있게 된다. 하지만 기업마다 요구하는 데이터 범위와 정책이 다르고, 사용자가 직접 그 기준에 맞게 안전하게 가공하기는 어렵다. 원본 데이터를 서버로 모아 처리하면 개인정보 유출 위험도 커진다.

MODi는 기관 요청사항을 Walrus `policy_pack`으로 publish하고, user-app이 그 policy를 읽어 로컬에서 먼저 가명처리하게 만든다. platform Privacy/Security Agent는 같은 Walrus policy memory와 과거에 발견한 `security_memory`를 recall해 안전성 검사를 수행한다. 한 번 발견된 보안 위험은 `security_memory`로 Walrus에 append되어 다음 제출 검증 때 policy 검사보다 먼저 recall된다.

Security Agent는 payload를 업로드하거나 직접 수정하지 않고, findings와 memory patch만 반환한다. 실제 수정과 memory publish는 user-app 로컬 제출 흐름에서 일어난다.

Seal은 현재 데모 필수 경로가 아니다. 데모에서는 local encryption/decryption으로 설명하고, Seal policy-gated decryption은 Roadmap으로 둔다.

## Problem Framing

데모에서 먼저 잡아야 할 스토리는 다음이다.

1. 헬스케어 마이데이터 활용 수요가 커지고 있다.
2. 개인이 데이터를 직접 전송할 수 있게 되면 개인정보 보호 책임이 더 복잡해진다.
3. 기업별 요청사항은 목적, 보상, 데이터 범위, 보관 정책에 따라 계속 달라진다.
4. 사용자가 매번 안전한 가명처리 기준을 이해하고 적용하기는 어렵다.
5. 고정된 서버 규칙만으로는 정책 변화와 새로운 재식별 위험을 따라가기 어렵다.

MODi는 이 문제를 다음 구조로 푼다.

1. 기관 요청사항을 versioned Walrus `policy_pack`으로 공개한다.
2. user-app은 policy hash를 확인하고 로컬에서 먼저 가명처리한다.
3. platform Privacy/Security Agent는 같은 policy memory를 다시 읽어 독립적으로 검증한다.
4. 새로운 위험은 Walrus `security_memory`에 남겨 다음 제출에서 먼저 recall한다.
5. 검증 receipt와 workflow record가 남아 기관과 사용자가 어떤 기준으로 처리됐는지 확인할 수 있다.

## Demo Story

### 1. 기관이 연구 또는 데이터 요청을 생성한다

기관 대시보드에서 연구명, 활용 목적, 요청 데이터 범위를 선택한다.

결과:

- Supabase에 연구가 생성된다.
- 연구 생성 시 public `policy_pack`이 만들어진다.
- `policy_pack`이 Walrus testnet에 저장된다.
- DB에는 policy blob id, policy hash, policy version이 저장된다.

데모 포인트:

> 기업마다 다른 헬스케어 데이터 요청사항을 앱 코드에 박아두지 않고, Walrus에 올라간 versioned policy memory로 관리합니다.

### 2. 참가자가 연구를 신청하고 승인받는다

user-app에서 연구 신청을 하고, 기관 대시보드에서 승인한다.

결과:

- 승인된 참가자만 제출 흐름으로 진입한다.
- 기관 대시보드는 탭 진입/새로고침 시 DB를 다시 fetch해서 모바일 신청 상태를 반영한다.

### 3. user-app이 Walrus policy memory를 읽는다

참가자가 데이터 제출을 누르면 user-app은 연구의 `policy_pack_blob_id`로 Walrus에서 policy를 가져온다.

검증:

- Walrus에서 받은 policy text의 SHA-256 hash를 계산한다.
- DB에 저장된 policy hash와 일치하는지 확인한다.
- requested data, transform policy, forbidden fields를 읽는다.

데모 포인트:

> user-app은 서버가 임의로 내려준 규칙이 아니라 Walrus policy memory를 직접 검증하고 사용합니다.

### 4. user-app이 로컬 가명처리한다

user-app은 policy 기준으로 헬스케어 데이터를 로컬에서 가명처리한다.

처리 예:

- `loginId`, `walletAddress`, `email`, `phone`, `name` 제거
- 정확 날짜와 타임스탬프 제거
- 일 단위 기록을 월 단위로 일반화
- 원본 수치를 band로 변환
- 참가자는 project-scoped pseudonym id로 표현

중요:

- raw HealthKit data는 서버로 보내지 않는다.
- 서버는 가명처리를 대신 수행하지 않는다.
- Security Agent는 검증만 수행한다.

### 5. Platform Privacy/Security Agent가 같은 policy memory로 재검증한다

user-app은 가명처리된 payload, payload hash, policy blob id, policy hash를 platform Privacy/Security Agent에 보낸다.

Security Agent 검증:

- Walrus에서 policy blob을 직접 fetch한다.
- policy hash를 재계산한다.
- user-app이 보낸 policy hash와 일치하는지 본다.
- payload hash를 재계산한다.
- policy forbidden fields와 기본 직접 식별자 규칙을 합쳐 검사한다.
- 이메일/전화번호/지갑 주소/정확 날짜/정확 타임스탬프 패턴을 검사한다.
- 준식별자 조합 위험을 검사한다.

준식별자 조합 위험 예:

- 좁은 연령대
- 세부 지역
- 희귀 건강 상태
- 상세 기기 모델
- 극단적인 건강/활동 band
- 특이한 운동 패턴

데모 포인트:

> Walrus는 단순 파일 저장소가 아니라 정책 변화와 보안 학습을 Agent가 재사용하는 durable memory입니다.

### 6. 문제가 있으면 user-app이 로컬에서 더 안전하게 수정한다

Security Agent가 finding을 반환하면 user-app은 payload를 로컬에서 더 일반화한 뒤 재검증한다.

수정 예:

- `40-44` -> `40-49`
- `Jeju-Seogwipo` -> `Jeju`
- `sleep_apnea_with_pacemaker` -> `sleep_cardiovascular`
- `Apple Watch Ultra 2` -> `wearable`
- `25k+` -> `20k+`
- `open_water_swim_5x_week` -> `high_activity`

데모 포인트:

> 승인/거절 Agent가 아니라, 기업 요청사항에 맞게 개인정보를 더 안전하게 가공하도록 돕는 Privacy/Security Agent loop입니다.

### 7. Security Memory를 업데이트하고 다음 검증에서 먼저 recall한다

Security Agent가 새로운 보안 위험을 발견하면 `securityMemoryPatch`를 반환한다.

patch에 들어가는 것:

- finding code
- 준식별자 signal code
- 권장 일반화 규칙
- policy memory ref
- 이전 security memory ref

patch에 들어가지 않는 것:

- raw payload
- 평문 헬스케어 데이터
- 직접 식별자

user-app은 patch를 `security_memory` artifact로 Walrus에 올리고, Supabase project row에는 최신 Security Memory blob/hash/version만 저장한다.

다음 제출 검증 순서:

1. Security Agent가 Walrus `security_memory`를 먼저 fetch한다.
2. 현재 payload의 준식별자 signal 조합이 과거 위험 패턴과 일치하는지 먼저 본다.
3. 일치하면 `security_memory_known_risk_pattern` finding을 반환한다.
4. 그 다음 public `policy_pack`과 기본 안전성 규칙을 적용한다.

데모 포인트:

> Agent가 한 번 발견한 보안 오류를 Walrus memory로 남기고, 다음 검증에서 그 기억을 먼저 사용합니다.

### 8. 통과 후 encrypted dataset과 audit trail을 Walrus에 올린다

검증을 통과하면 user-app이 최종 payload를 로컬 암호화하고 Walrus에 업로드한다.

Walrus에 올라가는 것:

- encrypted healthcare dataset
- Local Pseudonymization Plan
- Security Agent Verification Receipt
- Security Agent Learned Risk Memory
- Security Workflow Record

Walrus에 올라가지 않는 것:

- raw HealthKit data
- 평문 헬스케어 payload
- 직접 식별자
- 복호화된 dataset

### 9. 기관이 데이터 관리 탭에서 확인하고 다운로드한다

기관 대시보드 `데이터 관리` 탭에서 제출된 encrypted dataset과 Security Agent audit trail을 확인한다.

기관이 확인할 수 있는 것:

- dataset Walrus blob
- policy memory blob/hash
- Security Agent receipt hash
- finding code/count
- safety edit 여부
- latest Security Memory blob
- workflow record

데모 포인트:

> 기관은 파일만 받는 것이 아니라, 어떤 Walrus policy memory를 기준으로 어떤 검증이 있었는지도 함께 확인합니다.

### 10. 기관 브라우저에서 local decryption한다

데모 기준 복호화는 기관 브라우저에서 local decryption으로 설명한다.

현재 데모 메시지:

- 복호화 순간에 Sui transaction은 나가지 않는다.
- 서버와 DB에는 plaintext를 저장하지 않는다.
- Seal 기반 권한 복호화는 Roadmap이다.

## Example 1: Clean Pass

목표: 정상적으로 가명처리된 payload가 Security Agent 검증을 통과하는 흐름.

입력 payload 요약:

```json
{
  "participant": {
    "pseudonymId": "project-scoped:8f91c2",
    "ageRange": "40-49",
    "region": "Jeju"
  },
  "period": {
    "recordedMonth": "2026-06"
  },
  "health": {
    "sleepDurationBand": "6-7h",
    "restingHeartRateBand": "50-59",
    "stepCountBand": "10k-15k",
    "vo2MaxBand": "high",
    "conditionTag": "sleep_cardiovascular"
  },
  "device": {
    "deviceType": "wearable"
  },
  "activity": {
    "workoutPattern": "regular_activity"
  }
}
```

예상 결과:

- `verified: true`
- `findingCodes: []`
- `policyMemoryUsed: true`
- `policyMemoryHashMatched: true`

## Example 2: Quasi-Identifier Risk

목표: 직접 식별자는 제거했지만 조합하면 참가자가 좁혀지는 payload를 Security Agent가 탐지하는 흐름.

위험 payload 요약:

```json
{
  "participant": {
    "pseudonymId": "project-scoped:8f91c2",
    "ageRange": "40-44",
    "region": "Jeju-Seogwipo"
  },
  "period": {
    "recordedMonth": "2026-06"
  },
  "health": {
    "sleepDurationBand": "6-7h",
    "restingHeartRateBand": "40-44",
    "stepCountBand": "25k+",
    "vo2MaxBand": "superior",
    "conditionTag": "sleep_apnea_with_pacemaker"
  },
  "device": {
    "deviceType": "Apple Watch Ultra 2"
  },
  "activity": {
    "workoutPattern": "open_water_swim_5x_week"
  }
}
```

Security Agent 예상 finding:

- `quasi_identifier_combination_risk`
- `small_cohort_reidentification_risk`

user-app local safety edit 후 payload 요약:

```json
{
  "participant": {
    "pseudonymId": "project-scoped:8f91c2",
    "ageRange": "40-49",
    "region": "Jeju"
  },
  "period": {
    "recordedMonth": "2026-06"
  },
  "health": {
    "sleepDurationBand": "6-7h",
    "restingHeartRateBand": "under_50",
    "stepCountBand": "20k+",
    "vo2MaxBand": "high",
    "conditionTag": "sleep_cardiovascular"
  },
  "device": {
    "deviceType": "wearable"
  },
  "activity": {
    "workoutPattern": "high_activity"
  }
}
```

재검증 예상 결과:

- `verified: true`
- `findingCodes: []`

## Actual Test Result

테스트 시각: `2026-06-14 01:12 KST`

테스트 방식:

- Walrus testnet publisher에 demo `policy_pack` 업로드
- Walrus aggregator에서 policy blob read-back 및 hash 확인
- 배포된 Supabase Edge Function `verify-participant-payload` 직접 호출
- clean payload, risky payload, fixed payload 3개 케이스 검증

테스트 policy memory:

- Walrus policy blob id: `WvzB1pXeKZyxmhP3afSb7e30FAKEA8Mu3TTgJQG0v8U`
- Walrus policy object id: `0xcf44f6349713fd473c6f755c53d56892fb415545ae2f537181720c0ccd231f57`
- Policy hash: `36b8d1b6c241e5a51c277466a1a64c205f0240d8e8a1ff93e4e007eec72f622a`

결과:

| Case | Result | Finding codes | Policy memory |
|---|---|---|---|
| `clean-pass` | `verified: true` | 없음 | 사용됨, hash 일치 |
| `quasi-risk-detected` | `verified: false` | `quasi_identifier_combination_risk`, `small_cohort_reidentification_risk` | 사용됨, hash 일치 |
| `fixed-pass` | `verified: true` | 없음 | 사용됨, hash 일치 |

Receipt hashes:

- `clean-pass`: `f76e407b09aedafccddd9b53a6c21d66561cf17a67c791ca0182c6a983535ada`
- `quasi-risk-detected`: `5069f2bd3d334fb6cf1db61666ca402ff8dda1fafb952d47cd3f1aa24c1537b5`
- `fixed-pass`: `30a367fe1c981703b55308b5684dec58aba3e8f128f6c02f1f342b99ca85c204`

## Actual Security Memory Recall Test

테스트 시각: `2026-06-14 01:30 KST`

테스트 방식:

- Walrus testnet에 demo `policy_pack` 업로드
- 위험 payload를 Security Memory 없이 검증
- Security Agent가 반환한 `securityMemoryPatch`로 `security_memory` artifact 생성
- `security_memory`를 Walrus에 업로드
- 같은 위험 payload를 Security Memory ref와 함께 재검증
- 수정 payload를 Security Memory ref와 함께 재검증

테스트 memory:

- Walrus policy blob id: `-8lUrg1XOnO7nstnzV4x-U-0MxTqAxV5O-BL045mCk8`
- Policy hash: `1a69d081d1e4bb23de87cc272949fe27d579939cfbfe2a4e19681a10b57f3677`
- Walrus Security Memory blob id: `kpGdaYgHtBvTGTjGlkr5Wbed0sG3TpRngVuXnKvF9Fs`
- Security Memory hash: `8909794fa305aa0bae4a7177f8101aaff5096f35c650d31814a921082320aaf4`

결과:

| Case | Result | Finding codes | Memory behavior |
|---|---|---|---|
| `first-risk-without-memory` | `verified: false` | `quasi_identifier_combination_risk`, `small_cohort_reidentification_risk` | 새 `securityMemoryPatch` 생성 |
| `second-risk-with-memory` | `verified: false` | `security_memory_known_risk_pattern`, `quasi_identifier_combination_risk`, `small_cohort_reidentification_risk` | 기존 Security Memory recall 성공 |
| `fixed-with-memory` | `verified: true` | 없음 | Security Memory는 recall됐지만 위험 패턴 불일치 |

## Demo Talk Track

1. 헬스케어 마이데이터가 늘면서 개인이 기업에 직접 건강 데이터를 보낼 수 있게 됐습니다.
2. 하지만 기업마다 필요한 범위와 개인정보 처리 기준이 달라, 사용자가 매번 안전하게 가공하기 어렵습니다.
3. MODi는 기관 요청사항을 Walrus public `policy_pack`으로 publish합니다.
4. 참가자는 승인 후 user-app에서 이 policy memory를 직접 읽고 hash를 확인합니다.
5. user-app은 raw health data를 서버로 보내지 않고 로컬에서 먼저 가명처리합니다.
6. platform Privacy/Security Agent는 최신 Walrus Security Memory와 policy memory를 recall해 두 번째 안전성 검사를 수행합니다.
7. 직접 식별자가 없어도 좁은 연령대, 세부 지역, 희귀 상태, 상세 기기 모델이 합쳐지면 재식별 위험으로 잡습니다.
8. 한 번 발견된 위험 패턴은 Security Memory로 Walrus에 append되고 다음 제출에서 먼저 탐지됩니다.
9. user-app은 finding을 바탕으로 payload를 더 일반화하고 재검증합니다.
10. 통과 후 encrypted dataset과 Security Agent receipt/workflow record가 Walrus에 남습니다.
11. 정책이나 기관 요청사항이 바뀌면 새 policy pack을 publish하고, Agent는 다음 제출부터 그 기준을 사용합니다.
12. 기관은 데이터 관리 탭에서 encrypted dataset과 audit trail을 다운로드하고, local decryption으로 확인합니다.

## Verified Commands

```bash
npm run typecheck
npm run build
supabase db push --linked --yes
supabase --debug functions deploy verify-participant-payload --project-ref tlwlatppyfhacvdjhnxb
supabase --debug functions deploy submit-participant-data --project-ref tlwlatppyfhacvdjhnxb
```

추가로 Node 기반 원격 호출로 Walrus upload/read-back, Security Memory upload/read-back, Supabase Edge Function memory recall 케이스를 직접 검증했다.
