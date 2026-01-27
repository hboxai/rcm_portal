# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CSRF protection middleware with token generation and validation (Issue #8)
- JWT refresh token rotation with secure httpOnly cookies (Issue #9)
- In-memory database caching service with TTL and LRU eviction (Issue #13)
- Cache statistics endpoint at `/api/health/cache`
- Dark mode support with system preference detection (Issue #14)
- Password complexity requirements with real-time validation (Issue #3, #30)
- Comprehensive health check endpoints at `/api/health/*` (Issue #21)
- Swagger/OpenAPI documentation at `/api/docs` (Issue #20)
- Structured logging with Winston and request correlation IDs (Issue #22)
- Audit logging for sensitive operations - login, logout, password changes (Issue #7)
- Input sanitization for file uploads with virus scanning hooks (Issue #6)
- Professional GitHub workflow templates
- Pre-commit hooks with Husky and lint-staged
- Commitlint for conventional commits enforcement
- Issue and PR templates for better collaboration
- Prettier configuration for consistent formatting

### Changed
- Refactored UploadPage into reusable components (Issue #19):
  - Created `useUpload` custom hook for upload state/logic
  - Created `FileDropZone` component for drag-drop uploads
  - Created `UploadPreviewPanel` for validation preview
  - Created `UploadHistoryTable` for upload history display
- Extracted API base URL to centralized config (Issue #18)
- Enhanced CI/CD pipeline with additional checks
- Auth tokens now use 15-minute access + 7-day refresh pattern

### Fixed
- Fixed copyright year in LoginPage footer (Issue #1)
- Removed console.log statements from production code (Issue #2)
- Resolved ESLint and TypeScript errors failing CI (Issue #25)

### Security
- CSRF tokens protect against cross-site request forgery attacks
- Refresh token rotation prevents token replay attacks
- httpOnly cookies prevent XSS token theft
- File upload sanitization prevents malicious file injection

---

## [0.9.0] - 2026-01-27

### Added
- Complete RCM (Revenue Cycle Management) portal implementation
- Excel file upload and validation system
- Multi-CPT line processing with split row logic
- JWT-based authentication system
- AWS S3 integration for file storage
- PostgreSQL database integration
- Docker containerization support
- Automated deployment scripts (PowerShell & Bash)
- GitHub Actions CI/CD pipeline
- Nginx reverse proxy configuration

### Changed
- Database schema optimized for claim processing
- Improved error handling in file uploads

### Fixed
- Upload timeout issues resolved
- Database connection pooling improvements

### Security
- JWT token validation enhanced
- CORS configuration hardened

---

## [0.8.0] - 2026-01-15

### Added
- Initial portal structure
- Basic authentication flow
- File upload functionality
- Database schema design

### Changed
- Frontend migrated to React + Vite + TypeScript
- Backend refactored to Express.js

---

## Version History Legend

- `Added` - New features
- `Changed` - Changes in existing functionality
- `Deprecated` - Soon-to-be removed features
- `Removed` - Now removed features
- `Fixed` - Bug fixes
- `Security` - Vulnerability fixes

---

[Unreleased]: https://github.com/hboxai/rcm_portal/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/hboxai/rcm_portal/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/hboxai/rcm_portal/releases/tag/v0.8.0
