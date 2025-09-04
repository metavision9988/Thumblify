# Thumblify Pro 🖼️

> AI 기반 URL & 파일 썸네일 생성 SaaS 플랫폼

## 📋 프로젝트 개요

Thumblify Pro는 URL과 파일을 고품질 썸네일로 변환하는 엔터프라이즈급 SaaS 플랫폼입니다. TDD(Test-Driven Development) 방식으로 개발되어 높은 품질과 안정성을 보장합니다.

## 🚀 주요 기능

### ✅ 현재 구현된 기능
- **보안 인증**: JWT 기반 사용자 인증 및 권한 관리
- **URL 썸네일**: 안전한 URL 검증 및 썸네일 생성 요청
- **작업 관리**: 캡처 작업 생성, 조회, 삭제, 상태 추적
- **사용량 분석**: 실시간 사용량 추적 및 통계
- **다층 보안**: Rate Limiting, URL 검증, 입력 검증
- **페이지네이션**: 효율적인 대용량 데이터 처리

### 🔜 개발 예정 기능
- **실제 스크린샷 캡처**: Puppeteer/Playwright 기반
- **파일 업로드**: PDF, HTML 파일 처리
- **템플릿 시스템**: 커스텀 프레임, 워터마크
- **배치 처리**: 여러 URL 동시 처리
- **클라우드 스토리지**: AWS S3/CloudFlare 연동

## 🏗️ 기술 스택

```
Backend:        Node.js + Express.js
Database:       PostgreSQL (현재 In-Memory)
Authentication: JWT + bcrypt
Testing:        Jest + Supertest
Validation:     Joi
Security:       Helmet, Rate Limiting
```

## 🔧 설치 및 실행

### 환경 요구사항
- Node.js 18+
- npm 또는 yarn

### 설치 방법

```bash
# 레포지토리 클론
git clone https://github.com/metavision9988/Thumblify.git
cd Thumblify

# 백엔드 의존성 설치
cd backend
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 필요한 설정 값들을 입력하세요

# 개발 서버 실행
npm run dev

# 테스트 실행
npm test
```

### 환경변수 설정

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Security Configuration
BCRYPT_ROUNDS=12

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Database Configuration (향후 추가)
DATABASE_URL=postgresql://user:password@localhost:5432/thumblify
```

## 📚 API 문서

### 인증 API

#### 회원가입
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

#### 로그인
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

#### 토큰 검증
```bash
GET /api/v1/auth/verify
Authorization: Bearer YOUR_JWT_TOKEN
```

### 캡처 API

#### URL 썸네일 생성
```bash
POST /api/v1/capture/url
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "format": "png",
    "width": 1200,
    "height": 800,
    "quality": 90,
    "fullPage": false
  }
}
```

#### 작업 목록 조회
```bash
GET /api/v1/capture/jobs?page=1&limit=10
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 작업 상세 조회
```bash
GET /api/v1/capture/jobs/{jobId}
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 작업 삭제
```bash
DELETE /api/v1/capture/jobs/{jobId}
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 사용량 분석
```bash
GET /api/v1/capture/analytics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer YOUR_JWT_TOKEN
```

## 🧪 테스트

현재 **42개의 테스트**가 모두 통과하여 **100% 성공률**을 달성했습니다.

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 파일 실행
npm test -- auth.test.js
npm test -- capture.test.js
npm test -- security.test.js
npm test -- database.test.js

# 테스트 커버리지 확인
npm run test:coverage
```

### 테스트 구성
- **인증 시스템**: 9개 테스트
- **보안 미들웨어**: 8개 테스트  
- **데이터베이스 모델**: 12개 테스트
- **캡처 엔드포인트**: 13개 테스트

## 🔒 보안 기능

### 다층 보안 시스템
- **JWT 인증**: 안전한 토큰 기반 인증
- **패스워드 암호화**: bcrypt를 통한 강력한 해싱
- **Rate Limiting**: API별 차등 속도 제한
- **URL 검증**: 내부 네트워크 및 악성 도메인 차단
- **입력 검증**: Joi를 통한 엄격한 데이터 검증
- **CORS 설정**: 안전한 교차 출처 요청 관리

### 보안 검증 완료
- ✅ 내부 네트워크 접근 차단 (127.0.0.1, 192.168.x.x, 10.x.x.x)
- ✅ 블랙리스트 도메인 필터링
- ✅ SQL Injection 방지
- ✅ XSS 공격 방지
- ✅ CSRF 보호

## 📊 개발 현황

### Phase 1 완료 ✅
- [x] TDD 환경 구축
- [x] 보안 시스템 구현
- [x] 데이터베이스 모델링
- [x] 핵심 API 개발
- [x] 42개 테스트 작성 및 통과

### Phase 2 계획 🔄
- [ ] Puppeteer 스크린샷 엔진 구현
- [ ] 이미지 최적화 및 포맷 변환
- [ ] 파일 업로드 처리
- [ ] 클라우드 스토리지 연동

### Phase 3 계획 📋
- [ ] 템플릿 시스템
- [ ] 배치 처리 기능
- [ ] 웹훅 시스템
- [ ] API 키 인증

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이센스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 문의

- **GitHub**: [@metavision9988](https://github.com/metavision9988)
- **Email**: metavision9988@gmail.com
- **Project Link**: [https://github.com/metavision9988/Thumblify](https://github.com/metavision9988/Thumblify)

---

**Thumblify Pro** - AI 기반 썸네일 생성의 새로운 표준 🚀