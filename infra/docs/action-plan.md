# MODi Infra Action Plan

## 0. 전제 정리

이번 MVP는 완전한 의료데이터 상용 인프라가 아니라, Sui, Walrus, Seal을 이용해 다음 흐름이 실제로 동작함을 보여주는 것을 목표로 한다.

- 연구기관이 데이터 요청과 보상 조건을 등록한다.
- 사용자가 참여 여부와 동의 범위를 직접 승인한다.
- 사용자 데이터는 원본 그대로 플랫폼에 저장되지 않는다.
- 데이터는 보호 처리 후 암호화되어 Walrus에 저장된다.
- Sui에는 데이터 참조, 동의, 접근, 보상, 감사 이력만 기록된다.
- Seal은 Walrus에 저장된 암호화 데이터의 복호화 권한을 제어한다.
- AI Agent는 데이터 처리 결과와 정책 준수 여부를 확인하고, 장기 memory를 통해 사용자의 선호와 이전 결정을 유지한다.

## 1. Phase 1: 요구사항과 데모 범위 고정

### 목표

해커톤 또는 MVP에서 보여줄 최소 사용자 여정을 확정한다.

### 할 일

1. 데모 시나리오를 하나로 고정한다.
   - 예시: "당뇨 관련 연구기관이 30대 사용자 대상 가명처리 건강 데이터를 요청하고, 사용자가 승인하면 데이터 접근 이력과 보상이 Sui에 기록된다."

2. 데이터 종류를 제한한다.
   - 원본 의료데이터 대신 합성 CSV 또는 JSON 사용
   - 예시 필드: `ageRange`, `gender`, `glucoseRange`, `conditionTags`, `deviceType`

3. 민감정보 정책을 단순화한다.
   - 이름, 전화번호, 주소, 주민등록번호, 상세 생년월일은 금지
   - MVP에서는 재식별 위험이 낮은 범주형 데이터만 사용

4. Agent 역할을 명확히 한다.
   - 전처리 모듈: 필터링, 가명처리, 암호화 수행
   - AI Agent: 처리 결과 검증, manifest 생성 확인, 사용자 선호 memory 반영

### 산출물

- 데모 시나리오 문서
- 샘플 데이터 schema
- 금지 필드 목록
- Agent 책임 범위 정의

## 2. Phase 2: Sui Move Contract 설계

### 목표

원본 데이터 없이도 데이터 요청, 동의, 접근, 보상 흐름을 온체인에서 추적할 수 있게 한다.

### 할 일

1. `DataRequest` 설계
   - 연구기관 주소
   - 요청 목적
   - 조건 metadata hash
   - 보상 금액
   - 만료 시간

2. `DataAsset` 설계
   - 사용자 주소
   - Walrus dataset blob id
   - Walrus manifest blob id
   - manifest hash
   - schema version
   - processing policy version

3. `ConsentGrant` 설계
   - 사용자 주소
   - request id
   - data asset id
   - 동의 목적
   - 만료 시간
   - 철회 여부

4. `AccessGrant` 설계
   - 연구기관 주소
   - consent id
   - seal policy object id
   - 접근 가능 기간

5. `RewardEscrow` 설계
   - 요청 생성 시 보상 예치
   - 접근 또는 활용 완료 시 사용자에게 지급

6. event 설계
   - `DataRequestCreated`
   - `DataAssetRegistered`
   - `ConsentGranted`
   - `ConsentRevoked`
   - `AccessGranted`
   - `DataAccessed`
   - `RewardPaid`

### 산출물

- `infra/sui/Move.toml`
- `infra/sui/sources/*.move`
- Move unit test
- event 명세

## 3. Phase 3: Walrus 저장 레이어 구축

### 목표

암호화된 데이터와 검증 가능한 manifest, 처리 증빙을 Walrus에 저장한다.

### 할 일

1. manifest schema 작성
   - 데이터 타입
   - schema version
   - owner address
   - request id
   - dataset blob id
   - processing receipt blob id
   - encryption provider
   - seal policy object id

2. processing receipt schema 작성
   - 처리 정책 버전
   - 제거된 필드 목록
   - 가명처리 방식
   - 입력 hash
   - 출력 hash
   - Agent 검증 결과

3. Walrus 업로드 스크립트 작성
   - encrypted dataset 업로드
   - manifest 업로드
   - processing receipt 업로드

4. Walrus 조회 스크립트 작성
   - blob id로 manifest 조회
   - dataset 다운로드
   - hash 검증

### 산출물

- `infra/walrus/schemas/data_manifest.schema.json`
- `infra/walrus/schemas/processing_receipt.schema.json`
- `infra/walrus/scripts/store_blob.ts`
- `infra/walrus/scripts/fetch_blob.ts`

## 4. Phase 4: Seal 접근제어 연결

### 목표

Walrus에 저장된 암호문을 Sui 동의 상태에 따라 복호화할 수 있게 한다.

### 할 일

1. 기본 접근 정책 정의
   - 데이터 소유자는 항상 접근 가능
   - 연구기관은 유효한 `ConsentGrant`와 `AccessGrant`가 있을 때만 접근 가능
   - 만료되거나 철회된 동의는 접근 불가

2. client-side encryption 흐름 구현
   - 사용자 측에서 데이터 암호화
   - 암호문만 Walrus에 업로드
   - 복호화는 Seal policy 통과 후 수행

3. 권한 부여/철회 helper 작성
   - grant
   - revoke
   - check access

### 산출물

- `infra/seal/policies/access_policy.md`
- `infra/seal/client/encrypt.ts`
- `infra/seal/client/decrypt.ts`
- `infra/seal/client/grant_access.ts`
- `infra/seal/client/revoke_access.ts`

## 5. Phase 5: AI Agent 검증 워크플로우

### 목표

AI Agent가 사용자 데이터 처리 결과를 검증하고, Walrus/MemWal 기반 장기 memory를 활용하게 한다.

### 할 일

1. 검증 체크리스트 작성
   - 금지 필드가 남아 있는지 확인
   - 가명처리 필드가 schema에 맞는지 확인
   - manifest와 dataset hash가 일치하는지 확인
   - consent 목적과 dataset metadata가 충돌하지 않는지 확인

2. Agent memory 항목 정의
   - 사용자가 선호하는 연구 목적
   - 사용자가 거절한 목적
   - 이전 동의 이력
   - 연구기관별 신뢰 상태
   - 반복 적용할 필터링 규칙

3. processing receipt 생성
   - Agent 검증 결과를 receipt로 저장
   - receipt hash를 Sui에 연결

4. 실패 처리 정의
   - 민감정보 발견 시 업로드 중단
   - manifest 불일치 시 재생성
   - consent 범위 불일치 시 사용자 재승인 요청

### 산출물

- `infra/agent/workflows/verify_dataset.md`
- `infra/agent/workflows/package_dataset.md`
- `infra/agent/memory/memwal-adapter.md`
- sample processing receipt

## 6. Phase 6: Indexer와 Platform API

### 목표

프론트엔드나 데모 앱이 Sui/Walrus 상태를 쉽게 조회할 수 있게 한다.

### 할 일

1. Sui event indexer 작성
   - request 목록
   - consent 상태
   - access 상태
   - reward 지급 상태

2. 조회 DB schema 작성
   - requests
   - data_assets
   - consents
   - access_logs
   - rewards

3. API endpoint 정의
   - `GET /requests`
   - `GET /requests/:id`
   - `GET /users/:address/assets`
   - `GET /users/:address/consents`
   - `GET /assets/:id/audit`

### 산출물

- `infra/indexer/schema.sql`
- `infra/indexer/event-handlers/*`
- `infra/api/openapi.yaml`

## 7. Phase 7: 데모 앱 조립

### 목표

전체 흐름을 하나의 데모로 연결한다.

### 데모 흐름

1. 연구기관이 데이터 요청을 등록한다.
2. 사용자가 요청을 확인한다.
3. 사용자가 참여를 승인한다.
4. 샘플 데이터가 전처리된다.
5. AI Agent가 처리 결과를 검증한다.
6. Seal로 암호화된 데이터가 Walrus에 저장된다.
7. Sui에 `DataAsset`과 `ConsentGrant`가 기록된다.
8. 연구기관이 접근을 요청한다.
9. Seal policy를 통과하면 복호화가 가능해진다.
10. 접근 이력과 보상이 Sui에 기록된다.

### 산출물

- end-to-end demo script
- sample dataset
- sample researcher account
- sample user account
- demo transaction log

## 8. Phase 8: FHE 확장 트랙

### 목표

기본 저장/접근 구조와 별개로, 암호문 상태 집계 계산 가능성을 보여준다.

### 적용 범위

FHE는 전체 원본 데이터가 아니라 숫자 또는 범주형 feature vector에만 적용한다.

예시:

- 조건을 만족하는 사용자 수
- 특정 glucose range count
- 간단한 risk score 합산
- cohort 통계

### 할 일

1. FHE 대상 feature 정의
2. 사용자 측 feature vector 생성
3. feature vector FHE 암호화
4. Walrus에 FHE ciphertext 저장
5. 연구기관이 암호문 집계 계산 수행
6. 결과 hash와 계산 receipt를 Sui/Walrus에 기록

### 산출물

- `infra/fhe/README.md`
- FHE feature schema
- encrypted aggregate demo

## 9. 우선순위

### Must have

- Sui Move object와 event
- Walrus encrypted dataset 저장
- manifest와 processing receipt
- Seal 기반 접근제어
- 사용자 동의와 보상 흐름

### Should have

- AI Agent 검증 체크리스트
- MemWal 또는 Walrus 기반 Agent memory
- Indexer와 조회 API
- consent revoke flow

### Nice to have

- FHE aggregate lane
- Walrus Sites 기반 데모 프론트엔드 배포
- 연구 산출물 저장 및 사용자 열람
- 정책 버전 registry

## 10. 추천 작업 순서

1. `infra/sui` contract skeleton 작성
2. `DataRequest`, `ConsentGrant`, `DataAsset` 먼저 구현
3. Walrus manifest/receipt schema 작성
4. 샘플 데이터 패키징 스크립트 작성
5. Seal 암호화/복호화 prototype 연결
6. Sui event와 Walrus blob id 연결
7. Reward escrow 추가
8. Agent 검증 receipt 추가
9. Indexer와 API 작성
10. 데모 시나리오 리허설
11. FHE aggregate lane은 시간이 남을 때 별도 확장으로 구현

