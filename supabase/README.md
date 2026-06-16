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
supabase functions deploy create-research-project --no-verify-jwt
supabase functions deploy verify-participant-payload --no-verify-jwt
supabase functions deploy submit-participant-data --no-verify-jwt
supabase functions deploy zklogin-salt --no-verify-jwt
```

사용자 앱에서 기관 웹 변경사항을 실시간 반영하려면 `20260610150000_user_app_realtime.sql` 마이그레이션도 원격 DB에 적용되어 있어야 합니다. 이 마이그레이션은 사용자 앱이 보는 프로젝트, 참여 신청, 제출 기록 테이블을 Supabase Realtime publication에 추가합니다.

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
| `SUPABASE_SECRET_KEYS` | Edge Function 기본 secret JSON. 서버 admin 클라이언트가 `default` secret key를 사용합니다. | 절대 클라이언트에 노출 금지 |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | 로컬 함수 실행 또는 legacy fallback용 서버 키 | 절대 클라이언트에 노출 금지 |
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
EXPO_PUBLIC_SUI_NETWORK=testnet
EXPO_PUBLIC_ENOKI_API_KEY=<enoki-public-api-key>
EXPO_PUBLIC_ZKLOGIN_GOOGLE_CLIENT_ID=<google-oauth-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_ZKLOGIN_SALT_FUNCTION=zklogin-salt
```

`EXPO_PUBLIC_ENOKI_API_KEY`가 있으면 사용자 앱은 Enoki zkLogin nonce/address/ZKP를 우선 사용합니다. 없거나 Enoki 요청이 실패하면 Supabase `zklogin-salt` 함수 기반 주소 계산으로 fallback합니다.

```bash
EXPO_PUBLIC_ENOKI_API_URL=https://api.enoki.mystenlabs.com
EXPO_PUBLIC_ENOKI_ADDITIONAL_EPOCHS=2
```

필요하면 플랫폼별 Google OAuth client ID를 override로 둘 수 있습니다.

```bash
EXPO_PUBLIC_ZKLOGIN_GOOGLE_IOS_CLIENT_ID=<ios-google-oauth-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_ZKLOGIN_GOOGLE_ANDROID_CLIENT_ID=<android-google-oauth-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_ZKLOGIN_GOOGLE_WEB_CLIENT_ID=<web-google-oauth-client-id>.apps.googleusercontent.com
```

서버/Edge Function에서만:

```bash
SUPABASE_SECRET_KEYS={"default":"sb_secret_..."}
ZKLOGIN_SALT_SECRET=<long-random-server-secret>
ZKLOGIN_GOOGLE_CLIENT_IDS=<ios-client-id>,<android-client-id>,<web-client-id>
```

Hosted Edge Function에는 `SUPABASE_SECRET_KEYS`가 기본 제공됩니다. 로컬 실행에서 별도 env를 쓴다면 `SUPABASE_SECRET_KEY` 또는 기존 service role key를 `SUPABASE_SERVICE_ROLE_KEY`로 넣어도 됩니다.

```bash
supabase secrets set SUPABASE_SECRET_KEY=sb_secret_...
```

zkLogin salt 함수는 Google `id_token`을 검증한 뒤 서버 secret으로 결정론적 salt를 만들고 앱에는 salt만 반환합니다. `ZKLOGIN_SALT_SECRET`이 바뀌면 같은 Google 계정의 Sui 주소도 바뀌므로 배포 후에는 rotation 계획 없이 변경하지 않습니다.

```bash
supabase secrets set \
  ZKLOGIN_SALT_SECRET="$(openssl rand -hex 32)" \
  ZKLOGIN_GOOGLE_CLIENT_IDS="<ios-client-id>,<android-client-id>,<web-client-id>"
```

Expo Go는 커스텀 URL scheme을 안정적으로 테스트할 수 없으므로 zkLogin은 development build, TestFlight, 또는 웹 빌드에서 확인합니다. iOS development build의 기본 Google OAuth redirect URI는 `com.modi.userapp:/oauthredirect`입니다.

## 사용자 데이터 제출 흐름

사용자 앱의 `submitParticipantData`는 먼저 기기 안에서 연구 범위의 가명 payload를 만듭니다. `verify-participant-payload` Edge Function은 Walrus 업로드를 하지 않고 payload를 수정하지도 않으며, user-app 가명처리 결과에 직접 식별자, 정확한 날짜/타임스탬프, 지갑 주소/연락처 패턴이 남아 있는지만 검증하고 receipt hash를 돌려줍니다. 검증에서 문제가 나오면 user-app이 payload를 한 번 더 안전화하고 재검증합니다. 검증을 통과하면 user-app은 payload를 Seal SDK encrypted dataset envelope로 암호화해 Walrus publisher에 업로드한 뒤 `submit-participant-data` Edge Function을 호출합니다. `submit-participant-data`는 서버 키로 모집중인 연구를 확인한 뒤 `study_applications`의 신청자/참여자 레코드를 만들거나 누적 제출량을 갱신하고, `participant_submissions`에 encrypted dataset Walrus blob id, encrypted dataset hash, Privacy Agent receipt hash, Seal identity, encryption provider/mode를 함께 저장합니다.

앱에서 기본으로 쓰는 Walrus publisher는 testnet public publisher이며 제출 blob은 기본 5 epoch 동안 저장합니다. 필요하면 사용자 앱 `.env`에 `EXPO_PUBLIC_WALRUS_PUBLISHER_URL`과 `EXPO_PUBLIC_WALRUS_EPOCHS`를 넣어 바꿀 수 있습니다.
기관 대시보드의 데이터 관리는 `participant_submissions.walrus_blob_id`로 Walrus aggregator에서 참가자 제출 payload blob을 내려받고, 저장된 manifest hash와 비교해 검증합니다. 필요하면 `VITE_WALRUS_AGGREGATOR_URL`을 설정합니다.

## 보안 메모

- 모든 public 테이블은 Row Level Security를 켜둔 상태입니다.
- 웹/모바일 클라이언트에는 publishable key만 넣습니다.
- Walrus에 저장되는 민감 가능 데이터는 업로드 전에 user-app에서 Seal SDK 암호화를 거친다는 전제로 설계했습니다.
- Supabase에는 원본 건강 데이터가 아니라 상태, 권한, 제출 메타데이터, Walrus/Seal 참조를 저장하는 것을 기본 원칙으로 합니다.
