# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately, not in a public issue. Use GitHub's **Report a vulnerability** button on the Security tab of this repository, or write to sarah@modernmustardseed.com.

Include what you found, how to reproduce it, and the impact you expect. We acknowledge reports and work with you on a fix before anything is disclosed.

## Scope

- The kit's code in this repository, especially `lib/mcp/safe-fetch.ts` (SSRF guard), `lib/mcp/limits.ts` and `lib/mcp/tool.ts`.
- A bypass of the SSRF guard is the most important class of report: any way to make `safeFetch` connect to a private, loopback, link-local or reserved address.

Connectors other people build from this kit are theirs to secure; report issues in those to their operators.
