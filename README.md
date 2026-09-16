# YA TA 운영형 MVP v1.0

운전연수 학습자와 교관을 연결하고, 예약부터 수업 기록·후기까지 관리하는 Next.js + Supabase 웹앱입니다.

## 실제 동작 범위

- 학습자/교관 이메일 회원가입·로그인
- 교관 프로필 등록 및 관리자 승인/반려
- 승인된 교관 검색·상세 조회
- 중복 시간 방지 예약 요청
- 교관의 예약 확정·거절·수업 완료
- 학습자의 예약 취소
- 교관 Logbook 작성 및 학습자 조회
- 완료 수업에 대한 1회 후기·평점 등록
- 실데이터 기반 관리자 통계와 교관 심사
- Supabase RLS 및 역할 상승 방지

결제는 PG 계약 전 단계이므로 앱 밖에서 처리하며, 화면의 금액은 예약 거래액으로만 집계합니다.

## 설치

1. Supabase 프로젝트의 SQL Editor에서 `supabase/MVP_SETUP.sql` 전체를 실행합니다.
2. `.env.example`을 `.env.local`로 복사하고 Project URL과 anon key를 입력합니다.
3. `npm ci`, `npm run dev` 순서로 실행합니다.

## 최초 관리자 지정

관리자 계정으로 한 번 가입한 다음, Supabase SQL Editor에서 해당 이메일의 역할을 변경합니다.

```sql
update public.profiles p set role='admin'
from auth.users u
where p.id=u.id and u.email='ADMIN_EMAIL';
```

관리자 로그인 후 `/dashboard/admin`에서 교관을 승인해야 공개 목록과 예약 화면에 표시됩니다.

## 배포

Vercel에 저장소를 연결하고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 Production 환경 변수로 등록합니다. Supabase Authentication의 Site URL과 Redirect URLs에도 실제 Vercel 도메인을 추가합니다.

운영 전 반드시 사업자 정보가 반영된 이용약관·개인정보처리방침, 교관 검증 기준, 보험 확인 절차, 취소·환불 정책과 PG 결제를 별도로 확정하세요.
