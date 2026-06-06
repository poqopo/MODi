# AI Agent Responsibilities

## 역할 정의

MODi MVP에서 AI Agent는 원본 데이터를 무제한으로 처리하는 중앙 실행자가 아니다.

Agent의 역할은 다음에 가깝다.

- 사용자 의사결정을 돕는 검증자
- 데이터 처리 결과의 정책 준수 여부를 확인하는 reviewer
- manifest와 processing receipt의 일관성을 확인하는 auditor
- 사용자의 이전 선택과 선호를 기억하는 memory client

## 책임 범위

### 1. 요청 해석

Agent는 연구기관의 `DataRequest`를 읽고 사용자에게 다음 내용을 설명할 수 있어야 한다.

- 요청 목적
- 필요한 데이터 범위
- 보상 조건
- 접근 기간
- 동의 철회 가능 여부

### 2. 데이터 검증

Agent는 업로드 전 데이터셋을 검사한다.

- 금지 필드 탐지
- schema 위반 탐지
- 지나치게 세밀한 값 탐지
- manifest와 데이터 hash 일치 여부 확인
- consent 목적과 데이터 metadata 비교

### 3. 처리 증빙 확인

Agent는 processing receipt에 다음 항목이 포함되어 있는지 확인한다.

- 처리 정책 버전
- 제거된 필드 목록
- 가명처리 방식
- 입력 hash
- 출력 hash
- 검증 결과

### 4. 사용자 memory 유지

Walrus 또는 MemWal에 저장할 memory 항목은 다음과 같다.

- 사용자가 선호하는 연구 목적
- 사용자가 거절한 연구 목적
- 자주 허용하는 데이터 범위
- 연구기관별 신뢰 상태
- 이전 동의 및 철회 이력 요약

## Agent가 하면 안 되는 것

- 원본 PHI를 플랫폼 서버로 전송
- 사용자 승인 없이 동의 생성
- 사용자 승인 없이 복호화 권한 위임
- 금지 필드가 남아 있는 데이터 업로드 승인
- 연구기관 목적과 맞지 않는 데이터 제공 권장

## MVP 검증 결과 포맷

```json
{
  "agentVersion": "0.1.0",
  "policyVersion": "mvp-health-v1",
  "passed": true,
  "checks": [
    {
      "name": "forbidden_fields",
      "passed": true,
      "details": "No direct identifiers found"
    },
    {
      "name": "schema",
      "passed": true,
      "details": "Dataset matches sample_health_record.schema.json"
    },
    {
      "name": "consent_alignment",
      "passed": true,
      "details": "Dataset metadata matches the request purpose"
    }
  ]
}
```

