# MODi Supabase Setup

이 폴더는 기관 대시보드와 사용자 앱이 함께 사용할 Supabase DB 스키마입니다.

## Schema 개요

| 테이블 | 역할 |
|---|---|
| `profiles` | Supabase Auth 사용자 프로필. 사용자 앱 참여자와 기관 운영자를 구분합니다. |
| `institutions`, `institution_members` | 연구를 운영하는 기관과 기관 멤버십입니다. |
| `research_projects` | 기관이 생성한 연구/모집 프로젝트입니다. 목적, 설명, 보상, 접근 기간, 데이터 범위를 저장합니다. |
| `project_age_ranges`, `project_data_fields` | 연구 참여 조건과 요청 데이터 스키마입니다. |
| `study_applications` | 사용자 앱에서 들어온 참여 신청, 승인/거절/참여 상태입니다. |
| `consent_grants` | 사용자 동의 범위와 만료/철회 상태입니다. |
| `participant_submissions` | 사용자가 제출한 데이터 기록입니다. Walrus blob, manifest hash, Seal policy id 연결 지점입니다. |
| `access_grants` | 기관이 Walrus/Seal 데이터에 접근할 수 있는 권한 이력입니다. |
| `reward_settlements` | 보상 정산 상태, Sui transaction hash/url입니다. |
| `audit_events` | 주요 변경/접근 이벤트의 감사 로그입니다. |

## 적용 방법

Supabase CLI 기준:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

로컬 개발 DB를 쓰려면:

```bash
supabase start
supabase db reset
```

`supabase db reset`은 `migrations/`를 적용한 뒤 `seed.sql`을 실행합니다.

## 기관 생성 RPC

기관 운영자가 처음 기관을 만들 때는 직접 `institution_members`에 insert하지 말고 RPC를 사용합니다.

```sql
select public.create_institution_for_current_user(
  'Sui Active Insurance',
  'sui-active-insurance',
  'https://example.com'
);
```

이 함수는 현재 로그인한 사용자를 `institution_operator` 프로필로 만들고, 생성된 기관의 `owner` 멤버로 등록합니다.

## 필요한 키

Supabase Dashboard의 `Project Settings > API Keys`에서 확인합니다.

| 키 | 어디에 사용 | 노출 가능 여부 |
|---|---|---|
| `SUPABASE_URL` | 웹/모바일/서버 공통 프로젝트 URL | 공개 가능 |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) | 웹사이트, Expo 모바일 앱 클라이언트 | 공개 가능. RLS가 반드시 필요합니다. |
| `SUPABASE_SECRET_KEY` (`sb_secret_...`) | 서버, Edge Function, 배치 작업, 관리자 API | 절대 클라이언트에 노출 금지 |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI/CI가 프로젝트에 접근할 때 | 로컬/CI secret에만 저장 |
| `SUPABASE_DB_PASSWORD` | 직접 DB 연결 또는 CLI link 시 필요할 수 있음 | 로컬/CI secret에만 저장 |

현재 Supabase 공식 문서는 브라우저/모바일 공개 코드에는 legacy `anon` key 대신 `sb_publishable_...` 키를 권장합니다. 서버에서는 legacy `service_role` 대신 `sb_secret_...` 키를 사용합니다.

## 앱 env 이름

기관 Vite 앱:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Expo 사용자 앱:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

서버/Edge Function에서만:

```bash
SUPABASE_SECRET_KEY=sb_secret_...
```

## 보안 메모

- 모든 public 테이블은 Row Level Security를 켜둔 상태입니다.
- 웹/모바일 클라이언트에는 publishable key만 넣습니다.
- Walrus에 저장되는 민감 가능 데이터는 업로드 전에 Seal 또는 별도 클라이언트 암호화를 거친다는 전제로 설계했습니다.
- Supabase에는 원본 건강 데이터가 아니라 상태, 권한, 제출 메타데이터, Walrus/Seal 참조를 저장하는 것을 기본 원칙으로 합니다.
