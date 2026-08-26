# YA TA MVP — START HERE

이 ZIP은 소비자(학습자)와 공급자(교관)가 하나의 서비스 흐름을 테스트하기 위한 배포 전 MVP입니다.

## 1. 설치
```bash
npm install
```

## 2. Supabase 연결
`.env.example`을 복사해 `.env.local`을 만들고 아래 두 값을 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
```

실제 secret/service-role 키는 브라우저 프로젝트에 넣지 마세요.

## 3. DB 준비
Supabase SQL Editor에서 `supabase/MVP_SETUP.sql`을 1회 실행합니다.

## 4. 실행
```bash
npm run dev
```
브라우저: http://localhost:3000

## 테스트 시나리오
### 소비자
1. 회원가입에서 `운전을 배우고 싶어요` 선택
2. 로그인
3. 교관 찾기 → 교관 상세 → 예약 요청
4. 내 예약에서 상태 확인
5. 교관이 수업 완료 및 Logbook 작성 후 `/logbook`에서 기록 확인

### 교관
1. 별도 이메일로 회원가입에서 `교관으로 활동할래요` 선택
2. `/instructor/register`에서 교관 정보 등록
3. `/dashboard/instructor`에서 자기 예약만 확인
4. 예약 확정 → 수업 완료 → Logbook 작성
5. `/dashboard/instructor/profile`에서 교관 프로필 수정

## MVP 범위
포함: Auth, 역할 분리, 교관 등록/수정/검색/상세, 예약, 예약 상태, Logbook, 모바일 반응형 기본 구조

보류: 실제 결제/정산, 지도 API, 사진 업로드, 소셜 로그인, 알림, 후기, 관리자 검증 자동화

## 배포 전 주의
- `.env.local`은 Git/ZIP에 포함하지 않습니다.
- 테스트는 우선 비공개/제한된 사용자로 진행하는 것을 권장합니다.
- 실제 유상 운전교육 중개를 공개 운영하기 전에는 적용 법령과 사업구조에 대한 별도 법률 검토가 필요합니다.
- `/terms`, `/privacy`는 MVP용 임시 문구이므로 정식 공개 전 교체해야 합니다.
