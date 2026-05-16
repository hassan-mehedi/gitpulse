# Security Policy

## Supported Versions

GitPulse is in active development. Only the latest release receives security fixes.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/hassan-mehedi/gitpulse/security/advisories/new) of this repository.
2. Click **Report a vulnerability** and describe the issue, including reproduction steps and impact.

You should expect an initial response within 7 days. If the issue is confirmed, a fix will be prepared and disclosed in a release note crediting the reporter (unless anonymity is requested).

## Scope

In scope:

- Arbitrary command execution via crafted repository state, hooks, or filenames
- Path traversal or sandbox escape from the WebView
- Credential leakage (Git remotes, store, system keychain)
- Update mechanism bypass or signature verification weaknesses

Out of scope:

- Issues that require an already-compromised local machine
- Social engineering attacks
- Vulnerabilities in upstream dependencies that are already publicly tracked
