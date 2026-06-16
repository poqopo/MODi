1. 기관이 연구를 생성한다.
2. Researcher Agent가 필요한 데이터 범위를 policy pack으로 만든다.
3. policy pack을 Walrus에 저장한다.
4. 사용자가 앱에서 연구 참여를 누른다.
5. User Privacy Agent가 policy를 Walrus에서 가져온다.
6. HealthKit 데이터를 로컬에서 가명처리한다.
7. Compliance Agent가 payload를 감사한다.
8. audit memory와 processing receipt를 Walrus에 저장한다.
9. encrypted dataset을 Walrus에 저장한다.
10. Sui에 DataAsset을 등록한다.
11. 다음 세션에서 Agent가 Walrus Memory를 recall해서 “이 연구는 이미 업로드 완료, consent 대기 중”이라고 이어서 처리한다.