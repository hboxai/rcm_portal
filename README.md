# 🏥 RCM Portal

<div align="center">

![Version](https://img.shields.io/badge/version-0.9.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Build Status](https://img.shields.io/github/actions/workflow/status/hboxai/rcm_portal/ci.yml?branch=main&label=CI)
![Deploy Status](https://img.shields.io/github/actions/workflow/status/hboxai/rcm_portal/deploy.yml?label=Deploy)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)

**A modern Revenue Cycle Management portal for healthcare billing operations**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## ✨ Features

- 📊 **Excel Upload & Validation** - Bulk claim processing with smart validation
- 🔄 **Multi-CPT Processing** - Intelligent split-row logic for complex billing
- 🔐 **Secure Authentication** - JWT-based auth with role management
- ☁️ **AWS S3 Integration** - Scalable file storage
- 🐳 **Docker Ready** - One-command deployment
- 🚀 **CI/CD Pipeline** - Automated testing and deployment

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL |
| **Storage** | AWS S3 |
| **Deploy** | Docker, Nginx, GitHub Actions |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker (optional)

### Local Development

```bash
# Clone the repository
git clone https://github.com/hboxai/rcm_portal.git
cd rcm_portal

# Install dependencies
npm install
cd frontend && npm install
cd ../backend && npm install
cd ..

# Configure environment
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Start development servers
npm run dev:all
```

### Docker Deployment

```bash
# Build and start
docker-compose up --build

# Production (detached)
docker-compose up -d
```

Visit `http://localhost:8082` for the application.

## 📁 Project Structure

```
rcm_portal/
├── frontend/           # React + Vite frontend
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom React hooks
│   │   └── utils/      # Helper functions
│   └── public/         # Static assets
├── backend/            # Express.js backend
│   ├── src/
│   │   ├── routes/     # API routes
│   │   ├── services/   # Business logic
│   │   └── utils/      # Utilities
│   └── scripts/        # Database scripts
├── .github/            # GitHub Actions & templates
├── docker-compose.yml  # Docker orchestration
└── nginx.conf          # Reverse proxy config
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [CHANGELOG](CHANGELOG.md) | Version history and changes |
| [DEPLOY_CHECKLIST](DEPLOY_CHECKLIST.md) | Deployment guide |
| [DEPLOY_STAGING](DEPLOY_STAGING.md) | Staging environment setup |

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rcm_portal
DB_USER=postgres
DB_PASSWORD=your_password

# Auth
JWT_SECRET=your_jwt_secret

# AWS S3
S3_BUCKET=your-bucket
S3_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** using conventional commits (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user authentication
fix: resolve upload timeout issue
docs: update API documentation
style: format code with prettier
refactor: restructure file upload service
test: add unit tests for validation
chore: update dependencies
```

## 📋 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend dev server |
| `npm run dev:backend` | Start backend dev server |
| `npm run dev:all` | Start both servers |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run docker:build` | Build Docker image |
| `npm run docker:start` | Start Docker containers |

## 🔒 Security

- Report vulnerabilities via [Security Advisories](https://github.com/hboxai/rcm_portal/security/advisories)
- Never commit `.env` files or credentials
- All PRs require security review for auth-related changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [HBox AI](https://github.com/hboxai)**

⭐ Star us on GitHub — it motivates us a lot!

</div>
