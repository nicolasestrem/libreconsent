# Vendored third-party test assets

These files are unmodified third-party artifacts used by the Playwright suite.
They are **not** shipped in any package and are excluded from lint/format.

## `gtag.js`

The real Google tag loader, used by the flagship `pre-consent-network-silence`
E2E (spec 03 §11.2, which requires "real `gtag.js`"). Playwright fulfills
`https://www.googletagmanager.com/gtag/js*` with this file, so CI executes
genuine Google code without depending on network egress to Google.

| Field | Value |
|---|---|
| Source URL | `https://www.googletagmanager.com/gtag/js?id=G-BASIC` |
| Measurement ID | `G-BASIC` (the `examples/basic-site` fixture ID) |
| Retrieved | 2026-07-26 |
| Size | 416316 bytes |
| SHA-256 | `a0e7756b2e909675eb7b81a29748ac5dfcb6e860f170a9b1cb172cd31418bfd5` |

Re-vendor with:

```sh
curl -sS -L -o tests/vendor/gtag.js "https://www.googletagmanager.com/gtag/js?id=G-BASIC"
sha256sum tests/vendor/gtag.js
```

Update the table above whenever the file is refreshed, and record the refresh
in `CHANGELOG.md` or in the pull request description, so a behavior change in
the flagship test is traceable to a loader change rather than to libreconsent.
