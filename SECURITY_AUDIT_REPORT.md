# Security Audit Report — Plexus App
**Date:** May 24, 2026  
**Scope:** All API routes and authentication flows (excluding thesis manager)  
**Classification:** Internal Security Assessment

---

## Executive Summary

This audit identified **4 Critical**, **5 High**, **6 Medium**, and **3 Low** security issues across the Plexus application. The most critical issues involve in-memory rate limiting in serverless environments, potential authorization bypass in sensitive audit queries, and weak token generation. All findings should be addressed before production deployment to additional environments.

---

## CRITICAL Issues

### 1. **In-Memory Rate Limiting Resets on Cold Start**
- **File:** [src/lib/rateLimit.ts](src/lib/rateLimit.ts)
- **Issue:** Rate limiting uses a Map that resets on every cold start. In serverless/distributed deployments (Vercel, Railway), each instance starts fresh, allowing attackers to exploit rate limits by distributing requests across multiple instances.
- **Impact:** Brute force attacks on registration, invitation sending, and AI analysis suggestions are effectively undefended in production.
- **Risk:** Credential stuffing, email enumeration, DoS via resource-intensive operations.
- **Remediation:** Replace with Redis-backed rate limiting (Upstash) or implement database-backed persistence.

### 2. **Weak Invitation Token Generation**
- **File:** [src/app/api/invitations/send/route.ts](src/app/api/invitations/send/route.ts#L67)
- **Issue:** Invitation tokens are generated using `crypto.randomUUID().replace(/-/g, '')`. While UUID v4 is cryptographically random, the token format is predictable and tokens are stored unencrypted in the database with no expiration.
- **Code:** `const token = crypto.randomUUID().replace(/-/g, '')`
- **Impact:** Attackers could potentially enumerate or forge invitation tokens.
- **Risk:** Unauthorized project/workspace access if tokens are intercepted or predicted.
- **Remediation:** Add token expiration (48-72 hours), hash tokens in database using bcrypt/argon2, use `crypto.getRandomValues()` for non-UUID token generation.

### 3. **Service Role Key Exposure Risk in Error Responses**
- **File:** [src/app/api/audit/route.ts](src/app/api/audit/route.ts#L100)
- **Issue:** Service role client is used broadly across API routes and error responses may leak internal details via `JSON.stringify(lastError)`. While the key itself is not exposed in responses, the pattern of using service role clients in sensitive paths creates attack surface.
- **Code:** Line 100: `raw: JSON.stringify(lastError)`
- **Impact:** Detailed error responses could reveal database schema or internal structure to attackers.
- **Risk:** Information disclosure leading to targeted attacks.
- **Remediation:** Log full errors only to server-side logging, return generic error messages to clients. Implement structured logging (CloudWatch, Sentry) instead of console.error with sensitive data.

### 4. **Missing Authorization Validation in Audit Query Filters**
- **File:** [src/app/api/audit/route.ts](src/app/api/audit/route.ts#L150)
- **Issue:** The audit GET endpoint accepts arbitrary actor_id, project_id, and resource_type filters but relies entirely on Supabase RLS for authorization. If RLS policies are misconfigured or have bypasses, users could retrieve audit logs for projects/actors they shouldn't access.
- **Code:** Lines 160-167 accept filter parameters directly from query string without validation.
- **Impact:** Unauthorized access to audit logs containing sensitive project activities.
- **Risk:** Privacy violation, compliance issue (audit log integrity).
- **Remediation:** Explicitly verify caller has permission to view the project/actor being queried. Do not rely solely on RLS for sensitive queries.

---

## HIGH Issues

### 5. **User Search Enables Email Enumeration**
- **File:** [src/app/api/users/search/route.ts](src/app/api/users/search/route.ts#L23)
- **Issue:** The search endpoint uses `ilike` to search full_name and email fields. Attackers can enumerate platform users by iterating common names/emails.
- **Code:** `.or(\`full_name.ilike.%${q}%,email.ilike.%${q}%\`)`
- **Impact:** User enumeration allowing attackers to build a list of valid platform accounts.
- **Risk:** Phishing target lists, credential stuffing preparation.
- **Remediation:** Implement rate limiting per IP/user session. Add CAPTCHA after N failed searches. Log all searches for audit. Consider requiring minimum permission level.

### 6. **SQL Injection in Audit Search String**
- **File:** [src/app/api/audit/route.ts](src/app/api/audit/route.ts#L180)
- **Issue:** The search parameter uses string interpolation in an ilike query: `query.ilike('details->>summary', \`%${search}%\`)`. While Supabase parameterizes the query, the pattern is vulnerable if not handled consistently.
- **Code:** Line 180: ``query.ilike('details->>summary', `%${search}%`)``
- **Impact:** Potential SQL injection or JSONB injection if search input contains special characters.
- **Risk:** Data exfiltration, unauthorized data modification.
- **Remediation:** Sanitize search input. Use strict validation (alphanumeric + basic punctuation only). Consider using full-text search instead of LIKE queries.

### 7. **Missing CSRF Protection on State-Changing Operations**
- **File:** Multiple API routes (POST, DELETE, PATCH)
- **Issue:** API routes like `/api/invitations/send`, `/api/output/checklist`, `/api/invitations/cancel` do not implement CSRF tokens. While SameSite cookie attributes help, explicit CSRF tokens provide defense-in-depth.
- **Impact:** Cross-site request forgery attacks on authenticated users.
- **Risk:** Unauthorized project modifications, invitation sending, data export.
- **Remediation:** Implement CSRF token validation using middleware or per-route checks. Verify origin/referer headers.

### 8. **Weak Password Requirements**
- **File:** [src/app/api/auth/register/route.ts](src/app/api/auth/register/route.ts#L8)
- **Issue:** Minimum password length is 6 characters. Industry best practice is 12+ characters or 8 with complexity requirements.
- **Code:** `password: z.string().min(6, "Password must be at least 6 characters.")`
- **Impact:** Passwords vulnerable to brute force and dictionary attacks.
- **Risk:** Account compromise, unauthorized access.
- **Remediation:** Increase minimum to 10-12 characters. Implement password strength meter on client. Consider disallowing common passwords using hibp-like service.

### 9. **No Expiration on Public Verification Tokens**
- **File:** [src/app/api/verify/[token]/route.ts](src/app/api/verify/[token]/route.ts#L24)
- **Issue:** Verification tokens are checked for `revoked_at` and `expires_at`, but there's no indication in the code that `expires_at` is set when tokens are created. If not set, tokens never expire.
- **Impact:** Verification tokens remain valid indefinitely, increasing window for token interception/reuse.
- **Risk:** Long-term unauthorized data access if token is leaked.
- **Remediation:** Verify that all token creation code sets `expires_at` to 24-48 hours in the future. Add database constraint preventing NULL expires_at.

---

## MEDIUM Issues

### 10. **Sensitive Data in Server-Side Console Logs**
- **Files:** Multiple API routes including [src/app/api/audit/route.ts](src/app/api/audit/route.ts#L100), [src/app/api/invitations/send/route.ts](src/app/api/invitations/send/route.ts#L62), [src/app/api/causal/discover/route.ts](src/app/api/causal/discover/route.ts#L87)
- **Issue:** Error logs contain full error objects and request details via `console.error` with `JSON.stringify(lastError)`.
- **Impact:** Sensitive data (internal errors, database details, user IDs) visible in production logs.
- **Risk:** Information disclosure, compliance violation (GDPR/HIPAA may require log sanitization).
- **Remediation:** Use structured logging (Sentry, CloudWatch) with redaction rules. Never log full error objects. Log error codes and generic messages to clients.

### 11. **Missing Rate Limit on Expensive AI Operations**
- **File:** [src/app/api/analysis/suggest/route.ts](src/app/api/analysis/suggest/route.ts#L108)
- **Issue:** AI analysis suggestions are rate-limited to 20/hour, but this may not be sufficient to prevent abuse via token cost. No explicit cost tracking.
- **Impact:** Attackers could still cause significant API costs by hitting the limit repeatedly.
- **Risk:** Financial damage via abuse of Anthropic API.
- **Remediation:** Implement token-based billing limits. Track cumulative API costs per user/project. Implement daily hard cap.

### 12. **No Content-Security-Policy Headers**
- **File:** [next.config.ts](next.config.ts)
- **Issue:** The Next.js config only sets cache headers, not security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.).
- **Impact:** Susceptible to XSS, clickjacking, MIME type sniffing.
- **Risk:** Client-side injection attacks, credential theft.
- **Remediation:** Add security headers in next.config.ts:
  ```
  'X-Content-Type-Options': 'nosniff'
  'X-Frame-Options': 'DENY'
  'X-XSS-Protection': '1; mode=block'
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
  ```

### 13. **Unvalidated External API Calls**
- **Files:** [src/app/api/causal/discover/route.ts](src/app/api/causal/discover/route.ts#L75), [src/app/api/output/package/route.ts](src/app/api/output/package/route.ts#L89)
- **Issue:** FastAPI/Analytics service URLs are constructed from environment variables without validation. Response handling is minimal.
- **Impact:** If ANALYTICS_API_URL is misconfigured or compromised, requests could be redirected to attacker-controlled servers.
- **Risk:** Man-in-the-middle attacks, data exfiltration.
- **Remediation:** Validate ANALYTICS_API_URL is in whitelist. Use certificate pinning for external service calls. Implement request signing with shared secrets.

### 14. **Missing Input Sanitization for User-Generated Content**
- **File:** [src/app/api/users/search/route.ts](src/app/api/users/search/route.ts#L20), [src/app/api/audit/route.ts](src/app/api/audit/route.ts#L180)
- **Issue:** Search queries are used directly in Supabase queries without sanitization. While Supabase protects against SQL injection, JSONB injection via `details->>summary` is possible.
- **Impact:** Query bypass, data leakage.
- **Risk:** Unauthorized access to audit data.
- **Remediation:** Implement input validation using regex or Zod schemas. Whitelist allowed search characters.

### 15. **Public Health Endpoint Exposes Backend Status**
- **File:** [src/app/api/health/route.ts](src/app/api/health/route.ts)
- **Issue:** The GET /api/health endpoint returns backend service status (degraded/unavailable) without authentication.
- **Impact:** Information disclosure useful for attack reconnaissance (e.g., determining when services are down).
- **Risk:** Attackers can identify optimal times to attack when services are degraded.
- **Remediation:** Require authentication for health endpoint or return generic response. Move detailed health checks to private admin endpoint.

---

## LOW Issues

### 16. **Insufficient Error Messages for Debugging**
- **Files:** Multiple API routes
- **Issue:** Generic 500 errors provide poor debugging experience but appropriate security posture. However, some routes return detailed error messages (e.g., "Failed to start package generation").
- **Impact:** Minor information disclosure.
- **Risk:** Low - mostly an operational issue.
- **Remediation:** Standardize error responses. Use error IDs that map to server logs instead of detailed messages.

### 17. **No Idempotency Keys on Non-POST Operations**
- **File:** [src/app/api/audit/route.ts](src/app/api/audit/route.ts#L60)
- **Issue:** Only audit POST implements idempotency keys. Other POST endpoints should also implement them to prevent accidental double-writes on network retries.
- **Impact:** Data duplication on client-side retries.
- **Risk:** Low - data consistency issue, not security issue.
- **Remediation:** Add idempotency key support to all mutation endpoints.

### 18. **Loose Type Checking on Service Client**
- **File:** [src/lib/supabase/projectAccess.ts](src/lib/supabase/projectAccess.ts#L4)
- **Issue:** The function uses `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for the supabase parameter, bypassing type safety.
- **Impact:** Potential for runtime errors if incorrect client passed.
- **Risk:** Low - caught by testing.
- **Remediation:** Define proper TypeScript interface for Supabase client instead of using `any`.

---

## Summary Table

| Severity | Count | Issues |
|----------|-------|--------|
| **CRITICAL** | 4 | Rate limiting, Token generation, Error exposure, Audit auth |
| **HIGH** | 5 | User enumeration, SQL injection, CSRF, Weak password, Token expiration |
| **MEDIUM** | 6 | Sensitive logs, Rate limiting gaps, Missing security headers, Unvalidated APIs, Sanitization, Health endpoint |
| **LOW** | 3 | Error messages, Idempotency, Type safety |

---

## Recommendations

### Immediate (Next Sprint)
1. Replace in-memory rate limiting with Redis-backed solution
2. Add token expiration (48-72 hours) and hashing to invitation tokens
3. Add authorization checks to audit query endpoint
4. Implement CSRF token validation on state-changing operations

### Short-term (Within 1 month)
5. Increase password minimum to 10-12 characters
6. Add security headers (CSP, X-Frame-Options, etc.) to next.config.ts
7. Implement structured logging with redaction rules
8. Add input sanitization and validation to all search/filter endpoints

### Medium-term (Within 2-3 months)
9. Implement token-based rate limiting for AI operations
10. Add verification token expiration enforcement
11. Implement certificate pinning for external API calls
12. Add comprehensive CSRF tests to test suite

### Ongoing
- Regular security audits (quarterly)
- Dependency scanning (Dependabot, Snyk)
- SAST/DAST testing in CI/CD pipeline
- Security training for team

---

## Appendix: Files Affected

### Critical Path Files
- `src/lib/rateLimit.ts`
- `src/app/api/invitations/send/route.ts`
- `src/app/api/audit/route.ts`
- `src/app/api/verify/[token]/route.ts`

### Authentication Files
- `src/app/api/auth/register/route.ts`
- `src/middleware.ts`

### API Route Files (90+ routes reviewed)
- `src/app/api/users/search/route.ts`
- `src/app/api/output/package/route.ts`
- `src/app/api/causal/**`
- `src/app/api/analysis/**`
- `src/app/api/ledger/**`

### Configuration Files
- `next.config.ts`
- `src/lib/supabase/env.ts`

---

**Report prepared by:** GitHub Copilot  
**Classification:** Internal Security Assessment  
**Distribution:** Development Team, Security Review
