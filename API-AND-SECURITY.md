# API contract and security boundaries

All requests POST JSON with Content-Type text/plain to the configured Apps Script /exec endpoint. Responses use `{success:boolean,error?:string}`; Apps Script can return HTTP 200 for application errors. No response exposes stack traces, password digests or session tables. The frontend does not automatically retry mutations after timeout: read state first to resolve uncertain outcomes.

| Action | Required inputs | Authorization |
|---|---|---|
| login | username, password, deviceId | Active user/password; legacy passwords require reset |
| verifyOTP | username, otp, deviceId, challengeId | Matching unexpired challenge; 5 attempts; single use |
| resendOTP | username, deviceId, challengeId | Prior password-verified challenge; cooldown and quota |
| forgotPassword | email | Generic response; per-email and global mail limits |
| resetPassword | email, temporaryPassword, newPassword | Valid single-use reset challenge; revokes sessions |
| checkSession | sessionToken | Valid active account, idle and absolute expiry |
| heartbeat | sessionToken, active:boolean | Same checks; only explicit activity updates last_active |
| logout | sessionToken | Revokes the authenticated user's current session |
| getPortal | sessionToken | Returns server-filtered services and current user |
| checkService | sessionToken, serviceId | Enabled service + current per-user grant |
| checkServicePath | sessionToken, path | Same, resolved by registered relative path |
| adminData | sessionToken | Current database role must equal admin |
| saveService | sessionToken, service:{id,name,description,path,icon,enabled,sort_order,version} | Admin; expected revision; relative HTML path validation |
| saveAccess | sessionToken,targetUsername,mode,serviceIds,version | Admin; expected revision; cannot change admin role |
| approveRequest | sessionToken,targetUsername,mode,serviceIds,version | Admin; pending account; grants first, activates, sends initial reset |
| rejectRequest | sessionToken,targetUsername | Admin; pending account only |
| requestAccess | fullName,email,position,purpose | Pending registration, duplicate prevention |
| checkStatus | email | Generic guidance; no public email/account enumeration response |

## Adding an actual protected service endpoint

Do not trust a previous checkService response as an authorization ticket. Add the authorization inside each new server action BEFORE reading or changing data:

```js
// Inside route_(b), using the permanent service ID registered by the admin:
case 'readMediaRecords': {
  const { user } = requireService_(b, 'media');
  // Perform any additional row-level ownership check using user.username here.
  // Read only the records this user should be allowed to access.
  return { success: true, records: [] }; // Replace with actual authorized data access.
}
```

No real media/survey record APIs existed in the attachments. The included service pages retain their sample functions and explicit sample-data labels. They are not production analytics implementations.

## Credentials and consistency

- PORTAL_SECRET must be generated with Node crypto.randomBytes(32) or equivalent secure OS CSPRNG and stored only in Script Properties. New tokens are derived using server HMAC with this key and a monotonic persistent counter, time and UUID. UUID/Math.random alone is not relied upon for token security.
- Passwords use PBKDF2-HMAC-SHA256 600,000 iterations, 16-byte salt, 32-byte output, then HMAC with the server secret. No plaintext persistent passwords. The vendored SHA/HMAC implementation is checked against Node's crypto with UTF-8 test inputs. Secret loss requires email resets.
- Legacy SHA256(password+salt) values remain in existing rows until reset; legacy authentication does not issue sessions in this release. Complete the reset rollout and restrict access to the Users sheet. Restore access by resetting, not by adding a default password.
- Temporary reset credentials expire in 15 minutes, are used only at resetPassword, and do not replace the normal password on request. OTP expires in 5 minutes. Both store digests and enforce maximum attempts. Reset success requires signing in normally with another OTP.
- Login failure budget is 5 attempts / 30 min per normalized username; reset sending is 3 / hour / email and 30 / hour globally; OTP mail is 3 / 15 min / account with 60s resend cooldown. Global endpoint abuse and timing side channels are not fully mitigated by Apps Script; there is no reverse-proxy IP control or CAPTCHA in this package.
- Sessions use single-session enforcement, 15-minute server idle expiry and 8-hour absolute expiry. Passive heartbeat does not extend idle expiry. A transient network failure blocks protected UI; it does not treat an unknown result as authorized.
- Mutations and session changes use a script lock; concurrent requests return BUSY after one second. This serializes writes but is not a multi-sheet transaction. Approval saves permissions before activating. Reset consumes the challenge and revokes sessions before updating password. If Sheets fails mid-operation, a user may need another reset; access fails closed where possible.
- Version checks protect service and access edits from stale concurrent writes. API timeout can mean a mutation completed: reload state before retrying.
- Cleanup removes expired challenges/rate limits/sessions and audit older than 90 days. Configure the hourly trigger; without it table size will increase.

## Known limits and operational checklist

GitHub Pages serves static source publicly even when UI is gated. Do not put secrets or private records there. Future HTML must be trusted code; same-origin JavaScript has access to sessionStorage. Scripts supplied by other admins need code review. The manifest presence check is not an HTML sanitizer or proof of endpoint authorization.

The public reset endpoint returns the same message for known and unknown users, but processing times can differ due to mail delivery. MailApp has account quotas and no transactional delivery confirmation. A successful send call is not proof of inbox arrival. Rate limits can intentionally limit legitimate requests too; monitor quota failures and use cleanup. Do not clear security counters automatically on a failed login.

Code attachments reduce conventional notification previews but do not prevent mail clients, device summaries or people with inbox access from reading them. The attachment is plaintext. Mail has no universal command to hide recipient lock-screen content. Prefer a standard identity provider/password reset link in a future migration if the requirement becomes stronger than this compatibility implementation.

Existing service pages retain Tailwind CDN and Google Fonts; new portal styling is local CSS with an optional Google Font and system fallback. Third-party resource failure can affect the older service-page styling. No browser/mobile/email delivery/load testing has been performed here. Verify on a staging Sheet and deployment before rollout.

Test evidence: see tests/backend.test.cjs and TEST-RESULTS.md. No live customer API request or email was sent by these tests.
