# MODi Demo Flow

현재 데모 포지셔닝: **Policy-Adaptive Healthcare MyData Privacy Agent**.

최근 의료 및 헬스케어 마이데이터가 빠르게 늘고 있다. 이 데이터는 wearable/Apple Health 데이터에만 그치지 않고 sleep/recovery 데이터, activity 데이터, medical records까지 포함한다. precision medicine 기업은 개인화 치료와 위험 모델링을 위해 이런 데이터가 필요하고, insurance wellness 기업은 리워드와 예방 관리 프로그램을 위해 필요로 한다. 문제는 데이터 전송 권한이 개인에게 열릴수록, 각 기업의 요청사항에 맞게 데이터를 안전하게 가공하고 개인정보 유출을 막는 일이 어려워진다는 점이다.

MODi는 이 지점을 AI Agent workflow로 해결한다. 기관은 연구나 서비스 목적에 맞는 `policy_pack`을 Walrus에 publish하고, user-app은 그 정책을 읽어 로컬에서 먼저 가명처리한다. platform Privacy/Security Agent는 같은 Walrus policy memory와 과거에 학습한 `security_memory`를 다시 읽어, 사용자가 보낸 payload가 최신 정책과 안전 기준을 만족하는지 검증한다.

핵심은 정책과 기관 요청사항이 바뀌어도 새 policy memory를 publish하고 Agent가 그 기준을 재사용할 수 있다는 점이다. Walrus는 데이터 저장소이면서, Agent가 정책과 보안 학습을 지속적으로 recall하는 verifiable memory layer가 된다.

Seal은 production Roadmap이다. 데모에서는 local encryption/decryption과 Security Agent audit trail을 보여준다.

구체적인 데모 시나리오와 실제 원격 검증 결과는 [`SECURITY_AGENT_DEMO_FLOW.md`](./SECURITY_AGENT_DEMO_FLOW.md)에 정리했다.

## Live Demo Priority

라이브 데모에서는 모든 기술 요소를 같은 비중으로 설명하지 않는다.

심사위원이 기억해야 할 흐름은 단순해야 한다.

1. Institution creates a healthcare data request.
2. MODi turns the request into a Walrus policy memory.
3. User submits health data from the user app.
4. User app pseudonymizes locally.
5. Privacy Agent verifies and asks for safer edits if needed.
6. Walrus stores the encrypted dataset and audit trail.
7. Security Memory lets the agent remember previous privacy risks.

데모 중 `Slush`, `Sui`, `Seal`, `DataRequest`, `AccessGrant`는 핵심 흐름이 아니다. 질문이 들어오면 production roadmap 또는 technical backup으로만 설명한다.

## Core Message

MODi는 헬스케어 마이데이터를 단순 업로드하는 앱이 아니다.

개인이 직접 데이터를 전송하는 시대에는 "동의했다"만으로 충분하지 않다. 같은 걸음 수 데이터라도 보험 리워드, 수면 코칭, 심혈관 연구가 요구하는 범위와 위험이 다르다. MODi는 기관별 요청을 public `policy_pack`으로 만들고, 사용자의 기기에서 그 정책에 맞게 데이터를 먼저 안전화한다. 그 다음 platform Privacy/Security Agent가 같은 Walrus policy memory를 다시 읽고, payload가 최신 정책과 보안 기준을 지켰는지 한 번 더 검사한다.

즉 Walrus는 단순 파일 저장소가 아니라:

- 기관 요청사항과 개인정보 처리 기준을 담은 public policy memory
- Privacy/Security Agent가 학습한 보안 위험 memory
- 정책 변경 이후에도 Agent가 재사용하는 검증 기준
- 제출 provenance와 audit trail 저장소

로 쓰인다.

## Narrative Focus

데모의 문제 정의는 다음이다.

1. 헬스케어 마이데이터가 확산되면서 개인이 wearable data와 medical records를 기업에 직접 보낼 수 있게 된다.
2. precision medicine, insurance wellness 같은 기업마다 필요한 데이터 범위와 처리 정책이 다르다.
3. 사용자가 매번 그 차이를 이해하고 안전하게 가공하기는 어렵다.
4. 서버가 원본 데이터를 받아서 처리하면 개인정보 유출 위험이 커진다.
5. 정책과 요청사항은 계속 바뀌므로, 고정된 앱 로직만으로는 유지하기 어렵다.

MODi의 해결 방식은 다음이다.

1. 기관 요청사항을 Walrus `policy_pack`으로 versioned publish한다.
2. user-app은 최신 policy를 직접 읽고 hash를 확인한 뒤 로컬에서 가명처리한다.
3. platform Privacy/Security Agent는 같은 Walrus policy memory와 learned Security Memory를 recall해 검증한다.
4. 위험이 발견되면 user-app이 데이터를 더 안전하게 수정하고 Agent가 재검증한다.
5. 검증 receipt와 learned risk memory는 Walrus에 남아 다음 제출에서 재사용된다.

## Agent Roles

### Institution Policy Publisher

기관 대시보드가 연구 생성 시 수행하는 역할이다.

- 요청 데이터 범위 선택
- public `policy_pack` 생성
- transform policy 정의
- forbidden fields 정의
- policy version/hash 생성
- policy를 Walrus public blob으로 publish

이 역할은 별도 분석 Agent로 강조하지 않는다. 기관이 만든 public policy memory라고 설명한다.

### User-App Local Pseudonymization

user-app은 Agent라고 부르지 않는다.

- Walrus에서 public `policy_pack` fetch
- policy hash 검증
- policy transform rule 기준으로 로컬 가명처리
- 직접 식별자 제거
- 날짜/타임스탬프 일반화
- 최종 payload 로컬 암호화
- encrypted dataset Walrus 업로드

### Platform Privacy/Security Agent

데모에서 가장 강조할 Agent다.

- Walrus에서 public `policy_pack`을 다시 fetch
- policy hash 재검증
- policy forbidden fields와 기본 보안 규칙을 합쳐 검사
- user-app payload hash 재계산
- 직접 식별자/정확 날짜/연락처/지갑 주소 패턴 탐지
- 기관 요청 범위 밖의 데이터와 준식별자 조합 위험 탐지
- finding code 반환
- user-app safety edit 이후 재검증
- Security Agent receipt와 workflow record를 Walrus audit trail로 남김

Agent는 payload를 직접 수정하지 않는다. 판단과 권고를 반환하고, 실제 수정은 user-app 로컬에서 수행된다.

## Step-by-Step Demo Flow

### 1. Institution Creates Public Policy Memory

기관 대시보드에서 연구를 만든다.

결과:

- 연구 기본 정보 저장
- 요청 데이터 카테고리 저장
- public `policy_pack` 생성
- `policy_pack` Walrus 업로드
- policy blob id/hash/version 저장
- 연구가 진행 프로젝트에 표시

Talk track:

> 기관은 연구 요청을 public privacy policy memory로 publish합니다. 이 policy는 user-app과 platform Security Agent가 같은 기준으로 읽는 Walrus record입니다.

### 2. Participant Applies And Gets Approved

user-app에서 연구 신청을 한다.

기관 대시보드에서 신청자를 승인한다.

Talk track:

> 승인된 사용자만 데이터 제출 흐름으로 들어갑니다.

### 3. User-App Fetches Policy From Walrus

사용자가 제출을 누르면 user-app이 Walrus에서 `policy_pack`을 가져온다.

확인:

- policy blob id
- policy hash
- policy version
- requested data scope
- transform policy
- forbidden fields

Talk track:

> user-app은 서버가 임의로 내려준 설정이 아니라 Walrus에 올라간 public policy memory를 직접 읽고 hash를 확인합니다.

### 4. User-App Pseudonymizes Locally

user-app이 policy 기준으로 로컬 가명처리한다.

처리:

- `loginId`, `walletAddress`, 연락처형 값 제거
- participant는 project-scoped pseudonym id로 표현
- 정확 날짜/타임스탬프를 월 단위로 일반화
- policy가 요청한 데이터 범위만 포함

Talk track:

> 개인정보 안전화는 서버에서 하지 않습니다. user-app이 public policy를 기준으로 로컬에서 먼저 처리합니다.

### 5. Platform Security Agent Reuses Walrus Policy Memory

user-app은 가명처리 payload와 policy ref를 platform Security Agent에 보낸다.

Security Agent는 다시 Walrus에서 policy blob을 fetch한다.

검사:

- Walrus policy hash가 DB의 policy hash와 일치하는지
- payload hash가 user-app이 보낸 hash와 일치하는지
- policy forbidden fields가 payload에 남아 있는지
- 직접 식별자 key가 남아 있는지
- 이메일/전화번호/지갑 주소 패턴이 있는지
- 정확 날짜/타임스탬프가 있는지

Talk track:

> 여기서 Walrus policy record가 MemWal처럼 쓰입니다. Security Agent는 user-app을 신뢰만 하지 않고, 같은 Walrus memory를 다시 읽어서 안전성 검사를 한 번 더 수행합니다.

### 6. Safety Edit And Re-Verification

Security Agent가 문제를 찾으면 finding code를 반환한다.

user-app은 로컬에서 safety edit을 적용한다.

예:

- policy forbidden field 제거
- 직접 식별자 제거
- 정확 날짜를 월 단위로 축소
- 식별 가능한 문자열 제거 표시로 대체

그 다음 Security Agent가 재검증한다.

Talk track:

> Security Agent는 수정자가 아니라 검증자입니다. 수정은 user-app 로컬에서 일어나고, Security Agent는 재검증 receipt를 남깁니다.

### 7. Upload Encrypted Dataset And Audit Trail

검증을 통과하면 user-app이 최종 payload를 로컬 암호화하고 Walrus에 업로드한다.

Walrus에 올라가는 것:

- encrypted healthcare dataset
- `pseudonymization_plan` (`Local Pseudonymization Plan`)
- `privacy_verification_receipt` (`Security Agent Verification Receipt`)
- `agent_workflow_manifest` (`Security Workflow Record`)

Walrus에 올라가지 않는 것:

- raw HealthKit data
- 평문 제출 payload
- 직접 식별자
- 복호화된 dataset

Talk track:

> Walrus에는 encrypted dataset과 Security Agent audit trail이 남습니다. audit trail은 원문이 아니라 policy ref, payload hash, receipt hash, finding code, safety edit, dataset blob ref를 담습니다.

### 8. Institution Reviews Security Agent Audit Trail

기관 대시보드 `데이터 관리` 탭에서 확인한다.

- Security trail count
- workflow manifest count
- policy memory hash
- Security Agent receipt hash
- safety edit count
- encrypted dataset blob
- audit record JSON 다운로드
- encrypted dataset 다운로드

Talk track:

> 기관은 파일만 받는 것이 아니라 Security Agent가 어떤 Walrus policy memory를 기준으로 검증했는지 확인할 수 있습니다.

### 9. Local Decryption

기관은 encrypted dataset을 다운로드한 뒤 브라우저에서 로컬 복호화한다.

데모 기준:

- 복호화는 기관 브라우저에서 일어난다.
- 서버와 DB에는 복호화 plaintext를 저장하지 않는다.
- 복호화 순간에 Sui transaction은 나가지 않는다.
- Seal policy-gated decryption은 Roadmap이다.

## Security Agent Audit Artifacts

### Public Policy Pack

작성자:

- Institution dashboard

소비자:

- user-app local pseudonymization
- platform Security Agent

역할:

- Security Agent가 재사용하는 Walrus policy memory
- local pseudonymization 기준
- 제출 provenance 기준

포함:

- requested data scope
- transform policy
- forbidden fields
- policy lifecycle
- policy version/hash

### Local Pseudonymization Plan

작성자:

- user-app local runtime

역할:

- public policy pack 기준으로 어떤 로컬 가명처리를 적용했는지 기록

포함하지 않음:

- raw payload
- 평문 헬스케어 값
- 직접 식별자

### Security Agent Verification Receipt

작성자:

- Platform Security Agent

역할:

- Walrus policy memory를 다시 읽어 수행한 안전성 검사 기록
- 초기 검증과 재검증 attempt 기록
- safety edit 이력 기록

포함:

- policy memory blob/hash/version
- verification attempts
- finding code/count
- payload hash
- receipt hash
- final verified status
- safety edit actions

포함하지 않음:

- raw finding value
- 평문 payload
- HealthKit 원문

### Security Workflow Record

작성자:

- user-app submission workflow

소비자:

- Institution dashboard
- 향후 분석/리포트 Agent

역할:

- public policy, local pseudonymization plan, Security Agent receipt, encrypted dataset을 하나의 provenance chain으로 연결

포함:

- policy pack ref
- local pseudonymization plan ref
- Security Agent receipt ref
- encrypted dataset Walrus blob/hash
- final verification state

## Seal Roadmap

Seal은 데모 핵심이 아니라 다음 단계 확장이다.

Roadmap에서 Seal이 담당할 것:

- user가 기관 지갑에 복호화 권한 부여
- `DataRequest`, `DataAsset`, `ConsentGrant`, `AccessGrant` 기반 access policy
- 기관 Slush 지갑의 SessionKey 승인
- Seal key server가 policy를 검증하고 key share 반환
- 기관 브라우저에서 복호화

Seal 도입 후에도 변하지 않는 것:

- public policy pack은 Walrus에 저장된다.
- Security Agent는 Walrus policy memory를 재사용한다.
- encrypted dataset은 Walrus에 저장된다.
- Security Agent receipt에는 raw payload가 들어가지 않는다.

## What Not To Claim In Demo

- 별도 분석 Agent workspace가 완성됐다고 말하지 않는다.
- user-app을 독립 Agent로 포장하지 않는다.
- Seal policy-gated decryption이 완성됐다고 말하지 않는다.
- production-grade key management가 완성됐다고 말하지 않는다.
- 실제 HealthKit native integration이 완성됐다고 말하지 않는다.

대신 이렇게 말한다.

> MODi helps people send healthcare MyData to institutions safely, even when each institution asks for different data under changing privacy rules. Institutions publish versioned policy packs on Walrus, the user-app pseudonymizes locally, and the platform Privacy/Security Agent recalls Walrus policy and security memory to verify the payload before encrypted upload.
