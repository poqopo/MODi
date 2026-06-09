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

## 보안 및 구성

- 클라이언트 앱에는 publishable key만 사용하도록 구성했습니다.
- `.env`, `.env.local`, Supabase CLI `.temp` 파일이 git에 포함되지 않도록 ignore 규칙을 추가했습니다.
- `apps/institution-api`는 현재 클라이언트 Supabase + RLS 구조에서 쓰지 않으므로 제거했습니다.

## 검증

- `apps/institution-dashboard`: `npm run lint && npm run build`
- `apps/user-app`: `npm run typecheck`
- 원격 Supabase에 migration을 적용하고 publishable key로 모집중 연구 조회를 확인했습니다.
