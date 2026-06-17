# Vercel Deployment

MODi is deployed as two static frontend projects. The platform services it calls are Supabase, Walrus, Sui, Slush, Enoki, and Seal key server endpoints.

## Projects

### User App

- Vercel root directory: `apps/user-app`
- Build command: `npx expo export --platform web`
- Output directory: `dist`
- Web health data behavior: Apple Health is unavailable in browsers, so the web app opens an example-data modal and loads demo healthcare data after `Refresh`.

### Institution Dashboard

- Vercel root directory: `apps/institution-dashboard`
- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: `vercel.json` rewrites all routes, including `/docs` and `/research/...`, to `index.html`.

## Required Environment Variables

Set only public frontend-safe values in Vercel. Do not add Supabase service role keys or private server secrets.

### User App

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_SUI_NETWORK`
- `EXPO_PUBLIC_ENOKI_API_KEY`
- `EXPO_PUBLIC_ZKLOGIN_GOOGLE_CLIENT_ID`
- `EXPO_PUBLIC_ZKLOGIN_SALT_FUNCTION`
- `EXPO_PUBLIC_WALRUS_PUBLISHER_URL`
- `EXPO_PUBLIC_WALRUS_AGGREGATOR_URL`
- `EXPO_PUBLIC_WALRUS_EPOCHS`
- `EXPO_PUBLIC_MODI_SEAL_PACKAGE_ID`
- `EXPO_PUBLIC_SEAL_KEY_SERVER_CONFIGS`
- `EXPO_PUBLIC_SEAL_THRESHOLD`
- `EXPO_PUBLIC_SEAL_VERIFY_KEY_SERVERS`

### Institution Dashboard

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUI_FULLNODE_URL`
- `VITE_MODI_SEAL_PACKAGE_ID`
- `VITE_MODI_REQUEST_ESCROW_MIST`
- `VITE_WALRUS_PUBLISHER_URL`
- `VITE_WALRUS_AGGREGATOR_URL`
- `VITE_WALRUS_EPOCHS`

## External Allowlist

After deployment, add the Vercel production URLs to:

- Supabase Edge Function CORS origins
- Supabase Auth site URL and redirect URLs, if auth is used from the hosted app
- Google OAuth authorized JavaScript origins and redirect URIs for zkLogin
- Any Sui/Slush wallet origin allowlist required by the wallet flow

## Recommended Vercel Setup

Create two Vercel projects from the same GitHub repository:

1. `modi-user-app` with root directory `apps/user-app`
2. `modi-institution-dashboard` with root directory `apps/institution-dashboard`

Use separate project-level environment variables so the mobile/web participant app and the institution dashboard can evolve independently.
