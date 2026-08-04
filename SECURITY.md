# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` | ✅ |
| Older commits | ❌ |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **please do NOT open a public GitHub issue.**

### How to report

Email: [deepukhadgi@gmail.com](mailto:deepukhadgi@gmail.com)

Or open a **private** GitHub Security Advisory:
- https://github.com/deepukhadgi/Technography/security/advisories/new

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to expect

- **Acknowledgment** within 48 hours
- **Assessment** within 7 days
- **Fix** timeline communicated based on severity
- Credit in the fix commit (unless you prefer anonymity)

## Security Measures

This project implements the following security measures:

### Application Security
- **XSS Prevention**: Server-side HTML sanitization on all user input (comments, author names)
- **SQL Injection Prevention**: Parameterized queries throughout all database operations
- **CSRF Protection**: SameSite=Lax cookies, Secure flag in production
- **Rate Limiting**: Login (10/IP/15min), signup (5/IP/hr), comments rate-limited
- **Password Hashing**: bcrypt (cost factor 10) for all stored passwords
- **Constant-time Comparison**: Timing-safe string comparison for HMAC verification and password checks
- **Session Security**: HMAC-signed httpOnly cookies, 30-day expiry, server-side session invalidation
- **Honeypot Fields**: Bot detection on signup and comment forms

### HTTP Security Headers
- `Content-Security-Policy`: Restrictive default-src with frame-ancestors 'none'
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Powered-By` header removed

### Infrastructure Security
- **TLS 1.3** enforced via Cloudflare
- **DNS Security**: SPF, DKIM, DMARC configured for email authenticity
- **Self-hosted mail server**: Postfix + OpenDKIM with SMTP2GO relay
- **Cloudflare proxy**: DDoS protection, WAF, bot mitigation
- **Environment secrets**: Never committed to repository, deployed separately to production

### Code Security
- `.env.local` and all credential files are gitignored
- No internal IP addresses or server details in committed code
- `.env.example` contains only placeholders
- CI/CD pipeline secrets never exposed in logs

## Scope

This security policy covers:
- The website at `https://deepukhadgi.com.np`
- The source code at `https://github.com/deepukhadgi/Technography`
- Associated API endpoints

This does **not** cover:
- Third-party services (Cloudflare, SMTP2GO, GitHub)
- Physical infrastructure (homelab servers, Proxmox hosts)

## Safe Harbor

We support responsible disclosure. Security researchers acting in good faith will not face legal action for vulnerabilities reported through the channels above.
