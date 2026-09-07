# Verification results

Validated locally using Node.js. Google Sheets, MailApp, locks and Script Properties were mocked; no customer API writes or emails were sent.

28 backend checks passed:

1. Migration is idempotent and preserves existing users.
2. A forged client admin role is rejected.
3. Default user grants deny access; admins see enabled services.
4. Unauthenticated permission changes are rejected.
5. Selected grants apply to both catalogue and direct endpoint checks.
6. Stale permission revisions cannot overwrite newer records.
7. All-services mode includes newly registered services; selected mode does not.
8. Traversal, external URLs and script URLs are rejected.
9. Disabled services are denied, including for admins.
10. Expired sessions cannot be revived by heartbeat.
11. Passive heartbeat does not extend idle expiry.
12. Pending users cannot authenticate.
13. Reset requests return the same response for known and unknown emails.
14. Email body, subject and attachment filename do not contain the secret.
15. Mail failure retains the old password and challenge.
16. PBKDF2 output matches Node crypto for UTF-8 inputs and multiple iteration counts.
17. Incorrect reset credential does not change the account password.
18. Valid reset changes the password and revokes sessions; reset reuse is rejected.
19. New password login works; OTP is device bound and cannot be reused.
20. OTP verification stops after five failed attempts.
21. A user disabled after OTP issuance cannot authenticate.
22. Lock contention returns BUSY without a write.
23. Malformed input does not expose stack traces.
24. Unauthenticated catalogue reads are rejected.
25. Temporary credentials cannot bypass the new password length policy.
26. Expired reset credentials are rejected.
27. Approval applies selected grants and sends the initial reset email.
28. Malformed session timestamps fail closed.

Full PBKDF2 600,000 iteration reset took approximately 5.5 seconds in the local Node VM. This is not an Apps Script benchmark; verify real execution time and concurrency before rollout.

JavaScript syntax and local HTML asset references passed for 13 web files. Manifest generated for both original services. Browser rendering, mobile behavior, Google deployment and actual email notifications remain to be tested after installation.
