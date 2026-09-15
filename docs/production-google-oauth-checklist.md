# Google OAuth Production Checklist

Last reviewed: September 15, 2026

Use this checklist before moving Deltaora's Google OAuth consent screen to production or submitting it for verification.

## App URLs

- [ ] Homepage URL points to the public Deltaora homepage on a verified domain.
- [ ] Homepage is not only a login page and describes the app's functionality.
- [ ] Privacy Policy URL points to the dedicated `/privacy` page on the same owned domain.
- [ ] Terms of Service URL points to the dedicated `/terms` page on the same owned domain.
- [ ] The homepage links to the same Privacy Policy URL configured in Google Cloud.
- [ ] Privacy and Terms links are visible inside the signed-out and signed-in app UI.

## Google Cloud OAuth Consent Screen

- [ ] App name, logo, support email, developer contact email, and app domain match the public product.
- [ ] All homepage, privacy, terms, JavaScript origin, and redirect URI domains are added under Authorized domains.
- [ ] Authorized domains are verified in Google Search Console by a project owner or editor.
- [ ] Privacy Policy URL is a responsive HTML page, not a PDF, iframe, or document embed.
- [ ] OAuth scopes are limited to the minimum needed. For Deltaora's current Google sign-in, use basic identity only.
- [ ] Test users are configured only for testing mode; production release uses the correct publishing status.
- [ ] If new sensitive or restricted scopes are added later, complete Google's verification and any required security assessment before production use.

## Privacy Policy Content

- [ ] Explains what Google user data Deltaora receives: Google account ID, verified email address, and name.
- [ ] States that Deltaora does not access Gmail, Drive, Calendar, Contacts, Photos, or other Google product content.
- [ ] Discloses how Google user data is accessed, used, stored, shared, retained, deleted, and revoked.
- [ ] Includes Google API Services User Data Policy and Limited Use commitments.
- [ ] Says Google user data is not sold, used for ads, retargeting, credit decisions, surveillance, or unrelated model training.
- [ ] Lists processors used to operate the service, including Google Identity Services, email delivery, database/cache hosting, and AI summary processing where configured.
- [ ] Gives a working privacy contact email and account deletion path.

## Product And Security

- [ ] Google sign-in buttons follow Google's branding guidance.
- [ ] Production app is served over HTTPS only.
- [ ] Production cookies use `Secure`, `HttpOnly` where appropriate, `SameSite=Strict`, and the `__Host-` prefix where supported.
- [ ] Redirect URIs and JavaScript origins exactly match the deployed origin.
- [ ] OAuth client IDs/secrets are not committed and production values are configured through environment variables.
- [ ] Account deletion, email preference changes, and Google sign-in unlink/revocation support are documented or available through support.

Official references:

- Google OAuth 2.0 Policies: https://developers.google.com/identity/protocols/oauth2/policies
- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy
- OAuth app verification requirements: https://support.google.com/cloud/answer/13464321
- OAuth app branding settings: https://support.google.com/cloud/answer/15549049
