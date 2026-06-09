# Changes Since Last Commit

기준 커밋: `e59ece8 Add Institution dashboard`

## 기관 대시보드

- Supabase Auth 기반 로그인 게이트를 추가했습니다.
- Supabase 설정이 없을 때 안내 화면을 보여주도록 했습니다.
- 기관 대시보드가 실제 Supabase DB에서 프로젝트, 신청자, 제출 기록, 정산 데이터를 읽도록 연결했습니다.
- 프로젝트 추가하기에서 연구를 생성하면 `research_projects`와 기본 `project_data_fields`가 생성됩니다.
- 새로 생성한 연구는 사용자 앱에서 바로 보이도록 기본 상태를 `recruiting`으로 저장합니다.
- 신청자 승인/거절 버튼이 `study_applications.status`를 업데이트하도록 연결했습니다.
- 제출 기록 모달이 `participant_submissions`를 읽도록 연결했습니다.
- 정산하기 버튼이 `reward_settlements`를 `settled`로 업데이트하고 transaction link 필드를 채우도록 연결했습니다.

## 사용자 앱

- 사용자 앱에 Supabase 클라이언트를 추가했습니다.
- 프로젝트 탭이 목업 데이터 대신 Supabase의 `research_projects` 중 `status = recruiting`인 연구를 읽도록 연결했습니다.
- Supabase 조회 실패 시 기존 목업 프로젝트를 fallback으로 표시합니다.
- 모바일 프로젝트 목록에서 기관명, 보상, 데이터 범위, 연령 조건을 DB 값에서 매핑합니다.
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 예시 env 파일을 추가했습니다.

## Supabase

- 기관/프로젝트/신청/동의/제출/접근권한/정산/감사 로그 테이블을 만드는 migration을 추가했습니다.
- Row Level Security 정책을 추가했습니다.
- 기관 생성용 RPC `create_institution_for_current_user`를 추가했습니다.
- Walrus/Seal 제출 참조 컬럼을 추가했습니다.
- 모집중 연구의 기관명을 사용자 앱에서 공개 조회할 수 있도록 RLS 정책을 추가했습니다.
- 초기 확인용 seed 데이터를 추가했습니다.

## Infra / Sui / Walrus / Seal

- HealthKit/웨어러블 걸음 데이터를 첫 Walrus 업로드 단위로 정의했습니다.
- 원본 일자와 정확한 걸음 수를 제거하고 월 단위 band/count 데이터로 변환하는 `prepare_step_upload.mjs`를 추가했습니다.
- 가명처리 dataset, processing receipt, data manifest, Sui 등록 인자, 플랫폼 submission payload를 생성하도록 했습니다.
- Walrus CLI 저장 옵션을 추가하고, synthetic demo 외에는 `local-dev-fallback` 암호문 저장을 거부하도록 했습니다.
- 실제 Seal SDK/CLI를 붙일 수 있도록 `MODI_SEAL_ENCRYPT_CMD`, `sealIdentityHex`, key server, policy object 입력 구조를 마련했습니다.
- `step_activity_record`, `data_manifest`, `processing_receipt` JSON schema와 synthetic step sample을 추가했습니다.
- Sui `registry`에 `seal_identity` 기반 `AccessGrant`와 `seal_approve` policy hook을 추가했습니다.
- `create_access_grant` 이벤트에 Seal identity를 포함하고, accessor/test coverage를 추가했습니다.
- Walrus/Seal 제출 참조를 `participant_submissions`에 저장할 수 있도록 manifest와 `platform_submission.json` 형태를 맞췄습니다.
- testnet에서 Walrus blob 저장, read-back 비교, Sui `DataAsset` 등록 smoke test를 완료하고 deployment note에 기록했습니다.

## 보안 및 구성

- 클라이언트 앱에는 publishable key만 사용하도록 구성했습니다.
- `.env`, `.env.local`, Supabase CLI `.temp` 파일이 git에 포함되지 않도록 ignore 규칙을 추가했습니다.
- `apps/institution-api`는 현재 클라이언트 Supabase + RLS 구조에서 쓰지 않으므로 제거했습니다.

## 검증

- `apps/institution-dashboard`: `npm run lint && npm run build`
- `apps/user-app`: `npm run typecheck`
- 원격 Supabase에 migration을 적용하고 publishable key로 모집중 연구 조회를 확인했습니다.
- `infra/sui`: `sui move build`, `sui move test`
- `infra/walrus`: step upload script dry-run, Walrus testnet store/read-back/cmp
- Sui testnet: `registry::register_data_asset` PTB dry-run 및 실행 성공
- Supabase local lint는 현재 머신에 Docker CLI와 로컬 Postgres가 없어 실행하지 못했습니다.
