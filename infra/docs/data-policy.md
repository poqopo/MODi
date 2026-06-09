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
| 걸음 수 | 월 단위 `dailyStepBandCounts`, `averageStepBand`, `activeDaysBand`, `goalHitDaysBand` |
| 거리, 운동 시간, 활동 에너지 | 활동 구간: `low`, `moderate`, `high` |
| 수면 분석, 마음챙김 세션 | 회복 구간: `low`, `stable`, `high`, `irregular` |
| 심박, 안정시 심박, HRV, 산소포화도, 혈압, 호흡수 | 활력징후 구간: `normal`, `watch`, `elevated` |
| 인슐린 투여량 | 투여 구간: `none`, `low`, `medium`, `high` |

## 업로드 전 검증 체크리스트

AI Agent는 업로드 전에 다음을 확인한다.

- 금지 필드가 남아 있지 않다.
- 허용 필드만 schema에 맞게 존재한다.
- 데이터와 manifest의 hash가 일치한다.
- 데이터 목적이 사용자의 동의 범위와 충돌하지 않는다.
- Walrus에 올라가는 payload가 암호화되어 있다.

## 걸음 데이터 MVP 업로드 단위

가장 쉬운 첫 업로드 단위는 HealthKit 또는 웨어러블에서 가져온 일별 걸음 수다.

업로드 전에 다음 값은 제거한다.

- 정확한 일자
- 정확한 걸음 수
- 디바이스 고유 식별자
- 앱 계정 식별자

Walrus에 저장되는 암호화 payload는 다음 범주형 데이터만 포함한다.

- `recordedMonth`
- `dailyStepBandCounts`
- `averageStepBand`
- `activeDaysBand`
- `goalHitDaysBand`
- `consistencyBand`

`infra/walrus/scripts/prepare_step_upload.mjs`가 이 변환, receipt 생성, Seal 암호화 준비, Walrus 저장, Sui 등록 인자 생성을 담당한다.

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
