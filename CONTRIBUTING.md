# Contributing to Glyphloop

Glyphloop is in public beta. Issues, reproducible bug reports, and focused
feedback are welcome.

## Before opening an issue

- Search existing issues first.
- Include the command, preset, browser, or operating system involved.
- Reduce bugs to a small preset or set of steps when possible.
- Do not include private media, credentials, or security vulnerabilities in a
  public issue.

## Pull requests during beta

External pull requests are limited during the beta while the architecture and
contribution model settle. Please open an issue before investing in a code
change. Small documentation, test, and clearly scoped bug-fix contributions may
be invited; unsolicited large features may be closed without review.

Unless separate terms are agreed in writing before submission, accepted
contributions are provided under the project's MIT licence. The contributor
must have the right to submit the work. The project does not currently use a
CLA, so substantive outside contributions will not be accepted until the
long-term contribution and relicensing posture is explicit.

## Development checks

```sh
npm ci
npm test
npm run build
npm run build:site
```

Keep source changes focused, preserve loop periodicity, and add tests for pure
core behaviour.
