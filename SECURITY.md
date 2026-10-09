# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | âœ?        |

## Reporting a vulnerability

If you find a security issue, please **do not** open a public issue.

Send an email to the maintainer (see `package.json` `author`) with a clear
description and reproduction steps. We aim to respond within 7 days.

## Threat model

mdview is a local-only file viewer:

- It binds to `127.0.0.1` by default. Use `--host` with care.
- It only reads files inside the currently-mounted directory and rejects any
  traversal attempt.
- It caps file reads at 5 MB and runs all rendered HTML through DOMPurify.

Anything beyond that (e.g. exposing the server on a public network) is your
responsibility â€?mdview is not designed for hostile environments.