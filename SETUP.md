# 의료심의 관리 시스템 - 설치 가이드

## 1단계: Supabase 설정 (5분)

1. https://supabase.com 접속 → 무료 계정 생성
2. "New Project" 클릭 → 프로젝트 이름 입력 (예: medical-review)
3. 프로젝트 생성 완료 후 좌측 메뉴 **SQL Editor** 클릭
4. 아래 SQL을 붙여넣고 실행 (Run 버튼):

```sql
create table reviews (
  id uuid default gen_random_uuid() primary key,
  hospital_name text not null,
  review_number text not null,
  approved_at date not null,
  expires_at date not null,
  material_types text[] default '{}',
  memo text,
  created_at timestamptz default now()
);

-- 전체 접근 허용 (팀 내부 도구용)
alter table reviews enable row level security;
create policy "allow_all" on reviews for all using (true) with check (true);
```

5. 좌측 메뉴 **Settings > API** 클릭
   - `Project URL` 복사
   - `anon public` 키 복사

## 2단계: 코드 설정

`.env.local` 파일을 열고 복사한 값 입력:

```
NEXT_PUBLIC_SUPABASE_URL=복사한_Project_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=복사한_anon_키
```

## 3단계: GitHub에 올리기

1. https://github.com 계정 생성
2. "New repository" → 이름 입력 → Create
3. 이 폴더 전체를 GitHub Desktop 앱으로 올리기 (추천)
   - https://desktop.github.com 설치 후 사용

## 4단계: Vercel 배포

1. https://vercel.com 접속 → GitHub 계정으로 로그인
2. "New Project" → GitHub 저장소 선택
3. Environment Variables에 아래 두 값 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy 클릭 → 2분 후 URL 발급

## 5단계: Vercel Basic Auth (팀 접근 제한)

1. Vercel 대시보드 → 프로젝트 → Settings → Password Protection
2. Enable → 비밀번호 설정 → Save
3. 이 URL과 비밀번호를 팀원들에게 공유

---

문제 발생 시 `.env.local` 파일의 URL/키 값을 먼저 확인하세요.
