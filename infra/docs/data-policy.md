# MVP Data Policy

## 원칙

MODi MVP는 원본 헬스케어 데이터를 플랫폼이나 Walrus에 그대로 저장하지 않는다.

모든 데이터는 다음 순서를 거친다.

1. 금지 필드 제거
2. 범주화 또는 가명처리
3. AI Agent 검증
4. client-side encryption
5. Walrus 업로드
6. Sui에 참조값과 감사 이력만 기록

## 금지 필드

다음 값은 MVP 데이터셋, manifest, processing receipt, Sui event에 포함하면 안 된다.

| 유형 | 예시 |
|---|---|
| 직접 식별자 | 이름, 주민등록번호, 여권번호, 운전면허번호 |
| 연락처 | 전화번호, 이메일, 메신저 ID |
| 상세 위치 | 상세 주소, GPS 좌표, 병원 방문 상세 위치 |
| 정밀 시간 | 정확한 진료 일시, 초 단위 wearable timestamp |
| 원문 의료기록 | 의사 소견 전문, 처방전 원문, 검사 결과 PDF |
| 원본 생체정보 | 원본 ECG stream, 원본 이미지, 음성, 영상 |
| 지갑 외 계정 식별자 | 병원 환자번호, 보험번호, 사내 직원번호 |

## 허용 변환

| 원본 | MVP 변환 |
|---|---|
| 생년월일 | 연령대: `30-39` |
| 상세 주소 | 지역 코드: `KR-SEOUL` |
| 혈당 수치 | 구간: `140-179` |
| 진단명 | 연구용 태그: `diabetes` |
| 측정 일시 | 월 단위: `2026-05` |

## 업로드 전 검증 체크리스트

AI Agent는 업로드 전에 다음을 확인한다.

- 금지 필드가 남아 있지 않다.
- 허용 필드만 schema에 맞게 존재한다.
- 데이터와 manifest의 hash가 일치한다.
- 데이터 목적이 사용자의 동의 범위와 충돌하지 않는다.
- Walrus에 올라가는 payload가 암호화되어 있다.

## Sui 기록 제한

Sui에는 다음만 기록한다.

- object id
- wallet address
- Walrus blob id
- manifest hash
- schema version
- policy version
- 동의 상태
- 접근 상태
- 보상 상태

Sui에는 다음을 기록하지 않는다.

- 원본 의료값
- 진단 상세 내용
- 복호화 가능한 민감정보
- 직접 식별자

