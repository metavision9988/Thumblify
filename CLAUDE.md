# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Thumblify Pro** is a SaaS platform that converts URLs and files into high-quality thumbnails. The service provides both a web interface and RESTful API for generating screenshots, processing documents, and applying branding templates.

### Core Value Proposition
- **URL Screenshot Capture**: Convert any website URL into high-quality thumbnails in under 5 seconds
- **Document Processing**: Transform PDF, DOC, PPT, and MD files into image thumbnails
- **Multi-Device Support**: Desktop, mobile, and tablet viewport options
- **Branding Templates**: Apply logos, watermarks, and custom styling
- **Batch Processing**: Handle multiple URLs or files simultaneously
- **API-First Design**: RESTful API with SDK support for developers

## Architecture Overview

This is a **planned microservices architecture** with the following key components:

### System Architecture
```
Frontend (React + TypeScript)
    ↓ (REST API)
API Gateway (Express.js + Node.js)
    ↓
Microservices:
├── Auth Service (JWT + OAuth)
├── Capture Service (Puppeteer + Sharp)
├── Image Service (Sharp + Canvas)
├── Template Service (Branding)
├── Analytics Service (Usage tracking)
└── Notification Service (Webhooks)
    ↓
Data Layer:
├── PostgreSQL (Primary database)
├── Redis (Caching + Queue)
└── S3 (Image storage + CDN)
```

### Technology Stack
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis + Bull Queue
- **Storage**: AWS S3 + CloudFront CDN
- **Capture Engine**: Puppeteer + Sharp (image processing)
- **Authentication**: JWT + OAuth 2.0 (Google, GitHub)
- **Infrastructure**: Docker + AWS ECS
- **Monitoring**: Prometheus + Grafana + Sentry

## Development Commands

### Initial Setup
```bash
# Clone and setup development environment
git clone <repo-url>
cd thumblify

# Start development environment (when docker-compose.yml exists)
docker-compose up -d

# Backend development
cd backend
npm install
npm run dev

# Frontend development  
cd frontend
npm install
npm run dev
```

### Testing Commands
```bash
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
npm run test:e2e          # End-to-end tests

# Frontend tests
cd frontend  
npm test                   # React Testing Library tests
npm run test:coverage     # Coverage report
```

### Code Quality
```bash
# Linting and formatting
npm run lint              # ESLint check
npm run lint:fix         # Auto-fix linting issues
npm run format           # Prettier formatting
npm run type-check       # TypeScript type checking

# Pre-commit checks (runs automatically with husky)
npm run pre-commit       # Lint + test + type-check
```

### Build & Deployment
```bash
# Production builds
cd backend && npm run build
cd frontend && npm run build

# Docker builds
docker build -t thumblify-backend ./backend
docker build -t thumblify-frontend ./frontend

# Database management
npm run db:migrate        # Run database migrations
npm run db:seed          # Seed test data
npm run db:reset         # Reset database
```

## Key Business Logic

### Core Processing Flow
1. **Input Validation**: URL safety checks, file type validation, quota limits
2. **Queue Management**: Jobs queued via Redis/Bull for processing
3. **Capture Processing**: 
   - URLs: Puppeteer with device emulation and wait strategies
   - Files: LibreOffice headless conversion + Pandoc for markdown
4. **Image Optimization**: Sharp processing for compression and format conversion
5. **Template Application**: Canvas-based watermarking and branding
6. **Storage & CDN**: S3 upload with CloudFront distribution

### Security Architecture
- **Input Sanitization**: URL validation, file type restrictions, malware scanning
- **Rate Limiting**: User-based quotas, IP-based limits, API key throttling
- **Authentication**: JWT + refresh tokens, OAuth 2.0 social login
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: AES-256 encryption at rest, TLS 1.3 in transit

### Pricing Model
- **Free Tier**: 100 captures/month
- **Pro Tier**: $19/month, 2,000 captures, advanced features
- **Business Tier**: $99/month, 10,000 captures, API access, webhooks
- **Enterprise**: Custom pricing, unlimited usage, SLA

## Important Implementation Details

### Performance Requirements
- **Capture Speed**: Target <5 seconds per URL capture
- **Concurrency**: Max 5 Puppeteer instances, queue-based scaling
- **Availability**: 99.9% uptime target
- **API Response Time**: <200ms for non-capture endpoints

### Database Schema (Key Tables)
```sql
-- Users with subscription management
users: id, email, plan_type, monthly_quota, used_quota, api_key

-- Capture jobs with processing status
capture_jobs: id, user_id, source_type, source_url, options, status, 
              result_url, processing_time_ms, error_message

-- Branding templates
templates: id, user_id, name, config (JSONB), is_public, usage_count

-- API usage tracking
api_usage: id, user_id, endpoint, timestamp, processing_time, status
```

### File Structure Conventions
```
thumblify/
├── backend/
│   ├── src/
│   │   ├── controllers/     # API route handlers
│   │   ├── services/        # Business logic (CaptureService, ImageService)
│   │   ├── models/          # Database models (Prisma)
│   │   ├── middleware/      # Auth, rate limiting, validation
│   │   ├── utils/           # Helpers (urlValidator, imageOptimizer)
│   │   └── config/          # Environment and service config
│   └── tests/               # Jest + Supertest
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── utils/           # Frontend utilities
│   │   └── stores/          # Zustand state management
│   └── tests/               # React Testing Library
└── docs/                    # Project documentation
```

## Development Guidelines

### Code Patterns
- Use **dependency injection** for services (CaptureService, StripeService)
- Implement **graceful error handling** with proper HTTP status codes
- Follow **REST API conventions** with standardized response formats
- Use **TypeScript strictly** with proper type definitions
- Implement **comprehensive logging** for debugging and monitoring

### Security Practices
- Never log sensitive data (API keys, user passwords, file contents)
- Validate and sanitize all inputs (URLs, file uploads, user data)
- Use environment variables for all configuration
- Implement proper CORS policies for API access
- Regular security audits and dependency updates

### Testing Strategy
- **Unit Tests**: Services and utilities (Jest)
- **Integration Tests**: API endpoints (Supertest)
- **E2E Tests**: User workflows (Playwright)
- **Load Tests**: Performance under scale (Artillery)
- Target: 80%+ code coverage

## API Reference

### Core Endpoints
```
POST /api/v1/capture/url      # Capture URL screenshot
POST /api/v1/capture/file     # Process file to image
POST /api/v1/capture/batch    # Batch URL processing
GET  /api/v1/capture/:id      # Get capture status/result

POST /api/v1/templates        # Create branding template
GET  /api/v1/templates        # List user templates
PUT  /api/v1/templates/:id    # Update template

GET  /api/v1/usage            # Usage statistics
POST /api/v1/auth/register    # User registration
POST /api/v1/auth/login       # User authentication
```

### Authentication
- **Web UI**: JWT tokens with refresh mechanism
- **API**: API key authentication (X-API-Key header)
- **Rate Limits**: 100 requests/hour free tier, scaled by plan

This project prioritizes **security**, **performance**, and **developer experience**. The architecture is designed to scale from MVP to enterprise-level usage while maintaining code quality and system reliability.