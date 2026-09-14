# 🥤 스포츠 스태킹 1vs1 토너먼트 매니저

스포츠 스태킹 1vs1 대회의 **참가자 등록 → 브래킷 생성 → 토너먼트 진행 → 최종 결과/PNG 저장** 전 과정을 지원하는 단일 페이지 웹 앱이다. React 19 + Tailwind CSS 4 + Vite로 개발되며, 빌드하면 외부 JS 의존성 없는 단일 HTML 파일로 패키징된다.

## 기능

| 단계 | 내용 |
|------|------|
| 1단계 참가자 등록 | 개별 입력(자동 채번·Enter 지원) / 일괄 붙여넣기(탭·콤마·공백 구분, 헤더 자동 스킵, 줄 단위 오류 리포트, 덮어쓰기·추가 모드) / 22명 샘플 데이터 / 남녀 통계·개별 삭제·전체 삭제 |
| 2단계 브래킷 설정 | 참가자 N명 → 2^k강·부전승 수·총 라운드·총 경기 자동 계산 미리보기 / 시드 3종(순서 유지·랜덤·성별 교차) / 부전승 2종(상위 시드·랜덤) |
| 3단계 토너먼트 진행 | 라운드별 브래킷, 매치 카드 클릭 승자 선택 모달, 부전승 자동 진출, 승자 변경 시 하위 결과 자동 무효화, 진행률, 우승 셀레브레이션 |
| 4단계 최종 결과 | 우승·준우승·공동 3위, 전체 매치 결과표, **브래킷 PNG 이미지 저장**(Canvas 직접 렌더링, 2x 해상도) |
| 공통 | localStorage 자동 저장·복원, 단계 이동 가드, 큰 글자 모드(우하단 토글), 반응형·인쇄·모션 민감 대응 |

## 저장소 구조

```text
index.html          배포용 단일 파일 산출물 (루트에서 바로 서빙 가능)
before.html         패치 이전 원본 보존본 (비교용)
compare.html        전/후 비교 페이지 (before ↔ index 동시 표시)
src/                앱 소스 (Vite 루트)
  index.html        개발 진입점
  main.jsx          React 진입점
  App.jsx           앱 셸 (상태·저장·단계 가드)
  index.css         Tailwind + 커스텀 스타일 + 가독성 패치
  lib/              tournament.js(순수 로직) · pngExport.js · storage.js · sampleData.js
  components/       GenderBadge · PlayerRow · MatchCard · OptionCard · Confetti · BigTextToggle
  steps/            PlayerStep · SettingsStep · BracketStep · ResultStep
scripts/            verify-logic.mjs (순수 로직 동작 동등성 테스트)
package.json        의존성·스크립트
vite.config.js      빌드 설정 (root: src, 단일 파일 출력)
```

> 루트 `index.html`은 Vite 개발 진입점이 아니라 **배포 산출물**이다. 소스를 수정한 뒤에는 `npm run build`로 `dist/index.html`을 생성하고, 배포 시 루트 파일로 교체한다.

## 빠른 시작

```bash
npm install        # 의존성 설치
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # dist/index.html 단일 파일 빌드
npm run preview    # 빌드 결과 미리보기
npm run verify:logic  # 순수 로직 테스트 (11개)
```

배포 산출물만 바로 확인하려면 빌드 없이 정적 서빙하면 된다.

```bash
python3 -m http.server 8137
# http://localhost:8137/index.html  (배포본)
# http://localhost:8137/compare.html (전/후 비교)
```

## 핵심 로직

- **시드 순서**: 표준 스네이크 시딩. 8슬롯 → `[1,8,4,5,2,7,3,6]`
- **부전승**: 상위 시드 우선 귀속(스네이크 구조상 자동 귀속). 1라운드에서 한쪽이 비면 자동 진출(`auto` 플래그)하며 집계에서 제외
- **결과 저장**: `{ matchId: winnerId }` 맵. 승자 변경·취소 시 하위 브래킷 결과만 정밀 무효화
- **상태 저장**: `localStorage` 키 `stacking-tournament-v1`에 전체 상태 직렬화 (이전 버전 저장 데이터와 호환)

## 가독성·접근성 반영 내역

- 본문 최소 대비율 WCAG AA(4.5:1) 충족, 최소 글자 13px, 한글 행간 1.7
- 매치 카드 `aria-label` 완전문("8강 3경기: 김철수 대 이영희, 승자 미정"), 잘린 이름 `title` 툴팁
- 결과 테이블 지브라·호버·고정 헤더·승자 악센트, 숫자 `tabular-nums`
- 큰 글자 모드(루트 18px + 카드 확대, 설정 유지), 인쇄 최적화, `prefers-reduced-motion` 대응
- PNG 저장물 고해상도화(카드 224×64·16px·2px 연결선) 및 `roundRect` 폴백 내장

## 라이선스

미정. 공개 배포·재사용 전 라이선스 확정이 필요하다.
