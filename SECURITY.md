# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.9.x   | :white_check_mark: |
| < 0.9   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **DO NOT** open a public issue for security vulnerabilities
2. Email details to: security@hboxai.com (or create a private security advisory)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next release cycle

### Disclosure Policy

- We follow responsible disclosure
- Credit will be given to reporters (unless anonymity is requested)
- We will coordinate disclosure timing with you

## Security Best Practices

When contributing, please ensure:

1. **Never** commit secrets, API keys, or credentials
2. **Always** use environment variables for sensitive data
3. **Validate** all user inputs
4. **Sanitize** data before database operations
5. **Use** parameterized queries to prevent SQL injection
6. **Keep** dependencies updated
7. **Review** code for security implications

## Known Security Configurations

- JWT tokens expire after 24 hours
- Passwords are hashed with bcrypt
- CORS is configured per environment
- HTTPS is enforced in production

Thank you for helping keep RCM Portal secure! 🔒
