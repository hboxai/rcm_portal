# Contributing to RCM Portal

First off, thank you for considering contributing to RCM Portal! 🎉

## 📜 Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. Please be respectful in all interactions.

## 🚀 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When creating a bug report, include:**
- Clear and descriptive title
- Steps to reproduce the behavior
- Expected behavior
- Screenshots if applicable
- Environment details (OS, browser, version)

### Suggesting Enhancements

Feature requests are welcome! Please provide:
- Clear use case description
- Proposed solution
- Alternative solutions considered

### Pull Requests

1. **Fork** the repo and create your branch from `main`
2. **Follow** the coding style of the project
3. **Write** clear commit messages using conventional commits
4. **Test** your changes thoroughly
5. **Update** documentation if needed
6. **Submit** the pull request

## 🔧 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/rcm_portal.git
cd rcm_portal

# Install dependencies
npm install
cd frontend && npm install
cd ../backend && npm install

# Setup pre-commit hooks
npm run prepare

# Start development
npm run dev:all
```

## 📝 Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Examples:

```
feat: add user authentication
fix: resolve file upload timeout
docs: update API documentation
style: format code with prettier
refactor: restructure upload service
test: add validation unit tests
chore: upgrade dependencies
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `build` | Build system changes |
| `ci` | CI configuration |
| `chore` | Other changes |
| `revert` | Revert commit |

## 🌿 Branch Naming

```
feature/add-user-auth
fix/upload-timeout
docs/api-documentation
refactor/upload-service
```

## 🧪 Testing

```bash
# Run linting
npm run lint

# Run type checking
cd frontend && npx tsc --noEmit
cd ../backend && npx tsc --noEmit
```

## 📋 Pull Request Process

1. Update the README.md if needed
2. Update CHANGELOG.md with your changes
3. The PR will be merged once you have sign-off from a maintainer

## 🏷️ Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature request |
| `documentation` | Documentation improvements |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `priority/high` | High priority |
| `priority/low` | Low priority |

## 💬 Questions?

Feel free to open an issue with the `question` label or start a discussion.

---

Thank you for contributing! 🙏
