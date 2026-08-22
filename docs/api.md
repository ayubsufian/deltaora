# Deltaora API Documentation

Base URL: `/api/v1`

---

## Authentication

All endpoints (except registration, login, and password reset) require a valid access token cookie.
Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require a valid CSRF token in the `x-csrf-token` header.

### CSRF

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/auth/csrf` | Issue a CSRF token (returned in body and set as cookie) |

### Register & Login

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Register a new user (auto-provisions workspace) |
| `POST` | `/auth/login` | Login with email + password (supports MFA challenge) |
| `POST` | `/auth/refresh` | Refresh access token using refresh cookie |
| `POST` | `/auth/logout` | Logout and clear auth cookies |
| `POST` | `/auth/google` | Login or register with a Google ID token |

### MFA (Multi-Factor Authentication)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/mfa/setup` | ✅ + Step-up | Generate TOTP secret and QR code |
| `POST` | `/auth/mfa/verify` | ✅ + Step-up | Verify TOTP code and enable MFA |
| `POST` | `/auth/step-up` | ✅ | Re-authenticate with password or MFA |

### Passkeys (WebAuthn)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/passkeys/register/options` | ✅ + Step-up | Generate passkey registration options |
| `POST` | `/auth/passkeys/register/verify` | ✅ + Step-up | Verify and store passkey credential |
| `POST` | `/auth/passkeys/authenticate/options` | ❌ | Generate passkey authentication options |
| `POST` | `/auth/passkeys/authenticate/verify` | ❌ | Verify passkey and issue tokens |

### Password Recovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/forgot-password` | Send password reset email |
| `POST` | `/auth/reset-password` | Reset password using token |

### Email Verification

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/send-verification` | ✅ | Resend verification email |
| `POST` | `/auth/verify-email` | ❌ | Verify email using token |

---

## Pages (Monitored URLs)

All endpoints require `requireAuth`, `requireVerifiedEmail`, and `resolveAbility`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/pages` | List monitored pages — `?category=&status=&importance=&search=&startDate=&endDate=` |
| `POST` | `/pages` | Add a new URL to monitor (with optional crawler config & site discovery) |
| `GET` | `/pages/:id` | Get page details + latest snapshot + latest diff |
| `PUT` | `/pages/:id` | Update page config |
| `DELETE` | `/pages/:id` | Delete page and cascade-delete related data |
| `PATCH` | `/pages/:id/status` | Toggle monitoring status (`active` / `paused`) |

### Site Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pages/discover` | Discover URLs from a seed URL (sitemap, links, feeds) |

### Crawler Auth Sessions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/pages/auth-sessions` | ✅ | List crawler auth sessions for workspace |
| `POST` | `/pages/auth-sessions` | ✅ + Step-up | Create encrypted crawler auth session |
| `DELETE` | `/pages/auth-sessions/:sessionId` | ✅ + Step-up | Delete crawler auth session |

---

## History

All endpoints require `requireAuth`, `requireVerifiedEmail`, and `resolveAbility`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/pages/:pageId/snapshots` | Get snapshot version history |
| `GET` | `/pages/:pageId/diffs` | Get diff history |
| `GET` | `/pages/:pageId/summaries` | Get AI summary history |

---

## Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/dashboard` | Dashboard stats (cached 10 min) + latest 5 user notifications |

---

## Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q=` | Full-text search across URLs, titles, and AI summaries (cached 5 min) |

---

## Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/stats` | Weekly and monthly change/summary timeseries data |

---

## Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notifications` | List notifications — `?isRead=&limit=&page=` |
| `PATCH` | `/notifications/:id/read` | Mark notification as read |
| `PATCH` | `/notifications/read-all` | Mark all notifications as read |
| `DELETE` | `/notifications/:id` | Delete notification |

---

## User Management

All endpoints require `requireAuth` and `requireVerifiedEmail`.

### Profile & Preferences

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `PATCH` | `/users/me` | ✅ + Step-up | Update name and/or email |
| `GET` | `/users/me/preferences` | ✅ | Get email/notification preferences |
| `PATCH` | `/users/me/preferences` | ✅ | Update email/notification preferences |
| `POST` | `/users/me/password` | ✅ | Change password (requires current password) |

### MFA Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/users/me/mfa/disable` | ✅ + MFA Step-up | Disable MFA |
| `POST` | `/users/me/mfa/recovery-codes` | ✅ + MFA Step-up | Regenerate MFA recovery codes |

### Sessions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users/me/sessions` | ✅ | List active sessions |
| `DELETE` | `/users/me/sessions/others` | ✅ + Step-up | Revoke all other sessions |
| `DELETE` | `/users/me/sessions/:sessionId` | ✅ + Step-up | Revoke specific session |

### Passkeys

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users/me/passkeys` | ✅ | List registered passkeys |
| `PATCH` | `/users/me/passkeys/:passkeyId` | ✅ + Step-up | Rename a passkey |
| `DELETE` | `/users/me/passkeys/:passkeyId` | ✅ + Step-up | Delete a passkey |

### Account

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users/me/export` | ✅ | Export account data (GDPR) |
| `DELETE` | `/users/me` | ✅ + Step-up | Soft-delete account |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `PATCH` | `/users/:userId/status` | ✅ Admin + MFA Step-up | Suspend or reactivate a user |

---

## Workspaces

All endpoints require `requireAuth` and `requireVerifiedEmail`.

### Join

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/workspaces/join` | Accept a workspace invite token |

### Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/workspaces/:id/settings` | ✅ + Ability | Get workspace settings + page count |
| `PATCH` | `/workspaces/:id/settings` | ✅ + Step-up | Update workspace name, crawler defaults, notification defaults |

### Members

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/workspaces/:id/members` | ✅ + Ability | List workspace members |
| `PATCH` | `/workspaces/:id/members/:userId` | ✅ + Step-up | Change member role |
| `DELETE` | `/workspaces/:id/members/:userId` | ✅ + Step-up | Remove member (or leave workspace) |
| `POST` | `/workspaces/:id/invites` | ✅ + Step-up | Generate invite link (optionally email it) |

### Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/workspaces/:id/webhooks` | ✅ + Ability | List webhooks |
| `POST` | `/workspaces/:id/webhooks` | ✅ + Step-up | Create webhook |
| `PATCH` | `/workspaces/:id/webhooks/:webhookId` | ✅ + Step-up | Update webhook |
| `DELETE` | `/workspaces/:id/webhooks/:webhookId` | ✅ + Step-up | Delete webhook |

### API Keys

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/workspaces/:id/api-keys` | ✅ + Ability | List API keys |
| `POST` | `/workspaces/:id/api-keys` | ✅ + Step-up | Create API key (returns raw token once) |
| `DELETE` | `/workspaces/:id/api-keys/:keyId` | ✅ + Step-up | Revoke API key |

### Audit Logs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/workspaces/:id/audit-logs` | ✅ + Ability (owner) | Paginated audit logs — `?page=&limit=&action=&actor=&export=csv` |

---

## Error Responses

All errors follow this shape:

```json
{
  "error": "Short error message",
  "message": "Detailed description (optional)",
  "details": [],
  "code": "MACHINE_READABLE_CODE (optional)"
}
```

Common error codes:
- `CSRF_REQUIRED` — Missing or invalid CSRF token
- `MFA_REQUIRED` — Login requires MFA code
- `INVALID_MFA` — MFA code is incorrect
- `STEP_UP_REQUIRED` — Recent re-authentication required
- `MFA_STEP_UP_REQUIRED` — Recent MFA verification required
- `EMAIL_UNVERIFIED` — Email verification required
- `ADMIN_STRONG_AUTH_REQUIRED` — Admin must enable MFA or passkey
