# CrossMath

오프라인에서 동작하는 크로스 수학 퍼즐 PWA입니다. 단계별 문제, 15개 언어, 기기 안에만 저장되는 학습 분석을 지원합니다.

- React 19 + Vite + Tailwind CSS 4
- vite-plugin-pwa로 오프라인 캐시 (폰트 포함, 외부 요청 없음)
- 진행 기록은 IndexedDB(없으면 localStorage)에 저장
- 지원 언어: 한국어, English, 日本語, 简体中文, 繁體中文, Español, Français, Deutsch, Português, Italiano, Русский, Tiếng Việt, ภาษาไทย, Bahasa Indonesia, हिन्दी

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # 타입 검사
npm run build    # dist/ 생성
npm run preview  # 빌드 결과 확인
```

## 배포 (Vercel)

GitHub 저장소를 Vercel에 연결하면 `vercel.json` 설정대로 `npm run build` 후 `dist/`를 배포합니다. 환경 변수는 필요 없습니다.

## 번역 추가·수정

`src/i18n/translations.ts`의 `TranslationStrings`에 키를 추가하면, 15개 언어 중 하나라도 빠졌을 때 `npm run lint`가 실패합니다.
