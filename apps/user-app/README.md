# MODi User App

Expo 기반 React Native 앱입니다. 기존 Vite React 화면의 데이터와 흐름을 모바일 앱 UI로 옮겼습니다.

## Run

```bash
npm install
npm start
```

Expo Web으로 바로 확인하려면:

```bash
npm run web
```

## Scripts

- `npm start`: Expo 개발 서버
- `npm run android`: Android 타깃 실행
- `npm run ios`: iOS 타깃 실행
- `npm run web`: Expo Web 실행
- `npm run typecheck`: TypeScript 검사

## App Structure

- `src/App.tsx`: 랜딩/대시보드 전환 상태
- `src/pages`: 랜딩, 연구 목록, 참여 현황, Agent 관리 화면
- `src/components`: React Native 공통 UI
- `src/data/mvp.ts`: MVP 샘플 데이터
