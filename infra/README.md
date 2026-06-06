# MODi Infra Architecture

## 1. 목적

MODi는 블록체인 기반 헬스케어 데이터 관리 인프라이다.

핵심 목표는 다음과 같다.

- 사용자가 자신의 헬스케어 데이터 제공 여부와 접근 권한을 직접 통제한다.
- AI Agent가 원본 데이터를 로컬 또는 사용자 신뢰 환경에서 민감정보 필터링, 가명처리, 암호화 수행 결과를 검증한다.
- 플랫폼은 원본 데이터를 보유하지 않고, 메타데이터, 권한, 보상, 감사 흐름만 중개한다.
- Sui Network, Walrus, Seal을 조합해 데이터 소유권, 저장, 접근제어, 이력 추적을 분리한다.

## 2. 참고 방향

Sui Overflow 2026의 Walrus Track은 AI Agent가 현재 겪는 문제를 다음처럼 정의한다.

- Agent는 세션 간 기억을 잃는다.
- 메모리가 앱, 모델, 디바이스 단위로 파편화된다.
- 장기 워크플로우에서 상태와 산출물을 신뢰하기 어렵다.
- 여러 Agent 또는 도구가 같은 컨텍스트를 공유하기 어렵다.

MODi의 헬스케어 데이터 인프라에서도 같은 문제가 발생한다.

사용자 동의, 데이터 처리 정책, 비식별화 이력, 연구기관 접근 이력, 보상 조건이 세션마다 사라지거나 중앙 DB에만 갇히면 사용자가 실제로 데이터를 통제한다고 보기 어렵다.

따라서 Walrus는 단순 파일 저장소가 아니라 **검증 가능한 데이터 및 Agent memory layer**로 사용한다.

## 3. 전체 구조

```text
User App
  |
  | local health data
  v
AI Agent
  | 1. check filter sensitive data
  | 2. check pseudonymize
  | 3. check encrypt with Seal
  v
Walrus
  | encrypted dataset
  | manifest
  | agent memory
  | processing receipt
  v
Sui Network
  | ownership
  | consent
  | access grants
  | audit events
  | reward escrow
  v
Researcher / Company
```

## 4. 컴포넌트 역할

| 컴포넌트 | 역할 |
|---|---|
| Sui Network | 데이터 요청, 사용자 동의, 접근 권한, 보상 escrow, 감사 이벤트를 Move object와 event로 관리 |
| Walrus | 암호화된 데이터 패키지, 데이터 manifest, Agent memory, 처리 증빙, 연구 산출물을 저장 |
| Seal | Walrus에 저장된 암호화 데이터의 복호화 권한을 Sui 기반 access policy로 제어 |
| AI Agent | 사용자 데이터를 민감정보 필터링, 가명처리, 암호화한 것을 확인 |
| Platform API | 원본 데이터 없이 요청 검색, 매칭, 상태 조회, 이벤트 인덱싱 제공 |
| Indexer | Sui event와 Walrus metadata를 읽어 UI/API가 사용할 조회 모델 구성 |

## 5. Walrus의 핵심 역할

Walrus는 이 프로젝트에서 가장 중요한 데이터 기반 레이어다.

### 5.1 암호화된 데이터 저장소

헬스케어 원본 또는 처리된 대용량 데이터는 온체인에 저장하지 않는다.

AI Agent가 처리한 결과물을 Seal로 암호화한 뒤 Walrus에 업로드하고, Sui에는 다음 정보만 기록한다.

- `blob_id`
- `manifest_hash`
- `schema_version`
- `processing_policy_version`
- `owner`
- `storage_expiry`
- `consent_id`

### 5.2 검증 가능한 데이터 manifest

Walrus에는 데이터 본문 외에 manifest를 별도 저장한다.

manifest는 데이터가 어떤 조건으로 만들어졌는지 설명한다.

```json
{
  "schemaVersion": "1.0.0",
  "dataType": "pseudonymized_health_record",
  "ownerAddress": "0x...",
  "requestId": "0x...",
  "datasetBlobId": "...",
  "processingReceiptBlobId": "...",
  "encryption": {
    "provider": "seal",
    "policyObjectId": "0x..."
  },
  "metadata": {
    "ageRange": "30-39",
    "conditions": ["diabetes"],
    "region": "KR"
  }
}
```

### 5.3 AI Agent memory

Walrus 또는 MemWal은 Agent의 장기 기억 레이어로 사용한다.

저장 가능한 memory 예시는 다음과 같다.

- 사용자가 선호하는 데이터 제공 범위
- 사용자가 거절한 연구 목적
- 반복적으로 적용되는 민감정보 제거 규칙
- 이전 데이터 제공 이력
- Agent가 생성한 처리 판단 근거
- 연구기관별 신뢰/차단 상태

이 memory는 사용자 소유이며, Agent는 delegate key를 통해 제한된 범위에서 읽고 쓴다.

### 5.4 처리 증빙 저장

AI Agent가 데이터를 처리할 때 다음 증빙을 생성해 Walrus에 저장한다.

- 사용한 필터링 정책 버전
- 적용한 가명처리 방식
- 제거된 필드 목록
- 민감정보 탐지 결과 요약
- 생성된 데이터 hash
- Agent 실행 로그 요약

Sui에는 이 증빙 blob의 id와 hash만 남긴다.

### 5.5 연구 산출물 저장

연구기관이 데이터를 활용한 뒤 생성하는 산출물도 Walrus에 저장할 수 있다.

- 분석 리포트
- 모델 학습 로그
- 집계 통계
- IRB 또는 감사 제출용 활용 증빙
- 데이터 사용 완료 보고서

이를 통해 사용자는 자신의 데이터가 어떤 결과물에 쓰였는지 추적할 수 있다.

## 6. Sui Move object 설계

초기 Move package는 다음 object를 중심으로 구성한다.

| Object | 설명 |
|---|---|
| `DataRequest` | 연구기관이 등록한 데이터 요청 조건과 보상 조건 |
| `DataAsset` | 사용자가 제공 가능한 처리 데이터의 onchain reference |
| `ConsentGrant` | 사용자가 특정 요청에 대해 부여한 동의 |
| `AccessGrant` | 연구기관이 특정 Walrus blob을 복호화할 수 있는 권한 |
| `AccessLog` | 접근 시도, 접근 성공, 활용 완료 이벤트 |
| `RewardEscrow` | 연구기관이 예치한 보상과 지급 조건 |
| `PolicyRegistry` | 처리 정책, schema, consent template 버전 관리 |

Sui에는 원본 데이터나 복호화 가능한 민감정보를 저장하지 않는다.

## 7. Seal 접근제어

Seal은 Walrus에 저장된 암호문을 누가 복호화할 수 있는지 제어한다.

기본 정책은 다음과 같다.

- 사용자는 항상 자신의 데이터 복호화 권한을 가진다.
- AI Agent는 사용자가 부여한 delegate scope 안에서만 접근한다.
- 연구기관은 `ConsentGrant`와 `AccessGrant`가 유효할 때만 접근한다.
- 동의 만료, 철회, 목적 불일치 시 복호화 권한을 거부한다.

주의할 점은 Walrus blob 자체는 공개 조회 가능성을 전제로 해야 한다는 것이다. 따라서 모든 민감 데이터는 반드시 업로드 전에 암호화해야 한다.

## 8. 데이터 플로우

### 8.1 연구 요청 등록

1. 연구기관이 필요한 데이터 조건을 정의한다.
2. 보상 금액과 사용 목적을 설정한다.
3. Sui에 `DataRequest`를 생성하고 보상을 `RewardEscrow`에 예치한다.

### 8.2 사용자 참여

1. 사용자 앱이 `DataRequest` 목록을 조회한다.
2. AI Agent가 사용자의 로컬 데이터를 기준으로 참여 가능성을 판단한다.
3. 사용자가 참여 여부와 동의 범위를 승인한다.

### 8.3 데이터 처리 및 저장

1. AI Agent가 민감정보를 필터링한다.
2. 데이터를 가명처리한다.
3. 처리 결과와 manifest를 Seal로 암호화한다.
4. 암호문을 Walrus에 업로드한다.
5. Sui에 `DataAsset`과 `ConsentGrant`를 기록한다.

### 8.4 접근 및 활용

1. 연구기관이 접근 요청을 보낸다.
2. Sui contract가 동의 범위와 만료 여부를 검증한다.
3. Seal policy가 복호화 권한을 허용한다.
4. 연구기관이 Walrus에서 암호화 blob을 가져와 복호화한다.
5. 접근 이력과 활용 완료 이력이 Sui event로 기록된다.

### 8.5 보상 지급

1. 접근 또는 활용 완료 조건이 충족된다.
2. `RewardEscrow`가 사용자에게 보상을 지급한다.
3. 지급 이력은 Sui event로 남는다.

## 9. infra 폴더 제안 구조

```text
infra/
  README.md
  docs/
    architecture.md
    data-flow.md
    walrus-role.md
    threat-model.md
    compliance-notes.md
  sui/
    Move.toml
    sources/
      data_request.move
      data_asset.move
      consent.move
      access_grant.move
      reward_escrow.move
      audit.move
    tests/
  walrus/
    schemas/
      data_manifest.schema.json
      agent_memory.schema.json
      processing_receipt.schema.json
      consent_snapshot.schema.json
    scripts/
      store_blob.ts
      fetch_blob.ts
      renew_storage.ts
    publisher/
  seal/
    policies/
      access_policy.md
    client/
      encrypt.ts
      decrypt.ts
      grant_access.ts
      revoke_access.ts
  agent/
    workflows/
      pseudonymize.md
      filter_sensitive_data.md
      package_dataset.md
    memory/
      memwal-adapter.md
  indexer/
    event-handlers/
    schema.sql
  api/
    openapi.yaml
  ops/
    docker-compose.yml
    env.example
```

## 10. MVP 구현 순서

1. Sui Move contract
   - `DataRequest`
   - `ConsentGrant`
   - `DataAsset`
   - `AccessGrant`
   - `RewardEscrow`

2. Walrus 업로드/조회 스크립트
   - 암호화 blob 저장
   - manifest 저장
   - processing receipt 저장

3. Seal policy prototype
   - 사용자 소유권 기반 복호화
   - 연구기관 allowlist
   - 만료 시간 기반 접근 제한

4. AI Agent workflow
   - 샘플 헬스케어 데이터 필터링
   - 가명처리
   - manifest 생성
   - Walrus 저장

5. Indexer
   - Sui event 수집
   - request, consent, access, reward 상태 조회

## 11. 보안 및 규제 주의사항

이 구조는 헬스케어 데이터를 다루므로 MVP와 production의 경계를 명확히 해야 한다.

- MVP에서는 합성 데이터 또는 충분히 비식별화된 샘플 데이터를 사용한다.
- 원본 PHI는 Walrus에 직접 저장하지 않는다.
- Walrus에 저장되는 모든 민감 가능 데이터는 Seal 또는 별도 암호화 계층을 통해 client-side encryption 후 업로드한다.
- Sui에는 원본 데이터, 진단명 전문, 주민등록번호, 전화번호, 주소 등 재식별 가능한 정보를 기록하지 않는다.
- production에서는 HIPAA, GDPR, 개인정보보호법, 의료데이터 가이드라인, IRB 요구사항을 별도로 검토해야 한다.
- Seal은 접근제어와 암호화 기반을 제공하지만, 규제 대상 PHI 저장 전체를 자동으로 해결하는 compliance 제품으로 보면 안 된다.

## 12. 참고 링크

- Sui Overflow 2026 Handbook: https://mystenlabs.notion.site/overflow-2026-handbook
- Walrus Track Problem Statement: https://mystenlabs.notion.site/walrus-track-problem-statement
- Walrus Docs: https://docs.wal.app/
- Walrus Sites Docs: https://docs.wal.app/docs/walrus-sites/overview
- Seal Docs: https://seal-docs.wal.app/
- MemWal Docs: https://docs.memwal.ai/getting-started/what-is-memwal
- Sui Docs: https://docs.sui.io/
