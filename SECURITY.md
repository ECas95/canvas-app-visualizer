# Security Policy

The application is designed to inspect Canvas source locally.

## Data handling

The MVP has no upload API. Selected files are read by browser APIs and processed in memory.

Do not assume that this alone makes every third-party deployment trustworthy. Review the deployed build and hosting configuration before opening confidential application packages.

## File safety

The importer applies limits to:

- uploaded package size;
- number of Canvas source files;
- individual extracted source size;
- total extracted Canvas source text.

These limits reduce accidental or malicious resource exhaustion but do not make arbitrary archives inherently safe.

## Reporting vulnerabilities

Do not include real Canvas source, tenant information, secrets, or customer data in a public issue.

Describe security problems with a synthetic reproduction whenever possible.
