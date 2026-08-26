# 테스트 배포 체크리스트

## 권장: Vercel + Supabase
1. 이 폴더를 GitHub private repository에 업로드합니다. `.env.local`은 절대 커밋하지 않습니다.
2. Vercel에서 repository를 Import합니다.
3. Vercel Project Settings → Environment Variables에 아래 두 값을 등록합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Supabase SQL Editor에서 `supabase/MVP_SETUP.sql`을 실행합니다.
5. Supabase Authentication 설정에서 테스트 배포 도메인을 Site URL / Redirect URL에 등록합니다.
6. Vercel Deploy 후 소비자 계정과 교관 계정을 서로 다른 이메일로 하나씩 만들어 전체 시나리오를 테스트합니다.

## 출시 전 필수 테스트
- 소비자 A가 소비자 B의 예약/Logbook을 볼 수 없는지
- 교관 A가 교관 B의 예약을 볼/수정할 수 없는지
- 로그아웃 상태에서 보호 데이터가 노출되지 않는지
- 모바일 화면(360~430px)에서 예약/대시보드 사용이 가능한지
- 예약 중복, 취소/환불, 실제 결제는 아직 MVP 범위 밖임을 테스터에게 명확히 표시

## 공개 베타 전 보류 권장
실제 결제/정산, 사진/문서 업로드, 지도, 소셜 로그인, 자동 알림은 핵심 흐름 검증 후 추가합니다.
