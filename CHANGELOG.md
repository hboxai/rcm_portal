# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Professional GitHub workflow templates
- Pre-commit hooks with Husky and lint-staged
- Commitlint for conventional commits enforcement
- Issue and PR templates for better collaboration
- Prettier configuration for consistent formatting

### Changed
- Enhanced CI/CD pipeline with additional checks

### Fixed
- N/A

### Security
- N/A

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
