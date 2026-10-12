# Small Business MCP Starter Kit by Modern Mustard Seed

Ship a remote MCP connector for Claude that is built to pass Anthropic's directory review on the first try.

This kit is the set of patterns Modern Mustard Seed uses for the connectors it runs in production, pulled out into a clean Next.js project you can fork:

- **A route template** on Next.js App Router and [`mcp-handler`](https://www.npmjs.com/package/mcp-handler), serving Streamable HTTP at one URL per connector, with no redirect.
- **Tool conventions enforced at load time**: a title, `readOnlyHint` or `destructiveHint` on every tool, snake_case names of 64 characters or fewer, and descriptions that describe instead of steer. Break a rule and `pnpm test` fails, long before a reviewer sees it.
- **Specific error messages** instead of "Bad Request", and **output size caps** under Claude's limits.
- **Rate limiting built for Claude's shared egress range.** Every claude.ai user arrives from `160.79.104.0/21`, so nothing is keyed by IP and nothing returns HTTP 429.
- **An SSRF-safe fetch** for any tool that reads a URL a user supplied, with tests that prove a listening loopback server receives zero requests.
- **An eval harness** that runs real prompts against your live URL, with no model and no API key.
- **Docs, privacy, terms and support page templates** plus `/.well-known/security.txt`, all driven by one config file.
- **A submission checklist** mapped to the directory form's 10 steps and its seven policy acknowledgments, with every rule linked to Anthropic's documentation.
- **A worked example**: a U.S. federal holiday and business-day calendar with five read-only tools that passes all 35 of its own evals.

MIT licensed. Built by [Modern Mustard Seed](https://modernmustardseed.com).

## Working demo

The example connector runs live, deployed from this repository with no changes:

- Connector URL: `https://starter.modernmustardseed.com/holidays` (add it in Claude under **Customize > Connectors > Add custom connector**)
- Docs page reviewers read: https://starter.modernmustardseed.com/docs/holidays
- Privacy, terms and support: https://starter.modernmustardseed.com/privacy, [/terms](https://starter.modernmustardseed.com/terms), [/support](https://starter.modernmustardseed.com/support)
- Official MCP Registry entry: `com.modernmustardseed/holiday-calendar`

Run the evals against it yourself: `node eval/holidays.eval.mjs https://starter.modernmustardseed.com`

## Quickstart: 10 minutes

You need Node 22.6 or later, pnpm, and a Vercel account (any host that runs Next.js works).

**1. Make your copy.** (1 minute)

```sh
gh repo create my-connector --template ModernMustardSeed/small-business-mcp-starter --public --clone
cd my-connector
pnpm install
```

Or select **Use this template** on GitHub.

**2. Run it and prove it works.** (2 minutes)

```sh
pnpm dev
```

In a second terminal:

```sh
pnpm test
pnpm evals http://localhost:3000
```

You should see `32 pass` from the unit tests and `35 of 35 passed` from the evals. Open http://localhost:3000/docs/holidays to see the docs page reviewers read.

**3. Make it yours.** (2 minutes)

Edit `lib/site.ts`: company name, location, website, support inbox, security inbox, and the policy date. Every public page and `security.txt` read from it. Replace `app/icon.svg` and `app/apple-icon.png` with your own mark; the directory listing asks for an icon.

**4. Deploy.** (3 minutes)

Import the repository at [vercel.com/new](https://vercel.com/new), or from the terminal:

```sh
vercel deploy --prod
```

Vercel sets `VERCEL_PROJECT_PRODUCTION_URL`, which the pages use for their links. Leave Attack Challenge Mode and any bot-protection rule off for your MCP paths: they answer Claude with a challenge page.

**5. Check the deployment.** (1 minute)

```sh
pnpm preflight https://your-project.vercel.app
pnpm evals https://your-project.vercel.app
npx @modelcontextprotocol/inspector --cli https://your-project.vercel.app/holidays --transport http --method tools/list
```

Preflight checks HTTPS, no redirect, no 403 or 429, every public page returning 200, the MCP handshake and the annotation rules.

**6. Try it in Claude.** (1 minute)

In Claude, open **Customize > Connectors > Add custom connector** and paste `https://your-project.vercel.app/holidays`. Ask: "An invoice dated 2026-11-20 is due in 10 business days. What date is that?" In Claude Code:

```sh
claude mcp add --transport http holidays https://your-project.vercel.app/holidays
```

## Build your own connector

1. Copy `lib/holidays/tools.ts` to `lib/<yours>/tools.ts`. Declare each tool as a `ToolSpec`: name, title, description, zod input schema, annotations, a per-minute limit, optional global limits, the fields that are safe to log, and a `run` function that returns `ok(data)` or `fail(code, sentence)`.
2. Copy `app/holidays/route.ts` to `app/<yours>/route.ts` and point it at your tools.
3. Copy `app/docs/holidays/page.tsx` to `app/docs/<yours>/page.tsx`. Keep the "For reviewers" section: you paste it into the form.
4. Rewrite `app/privacy/page.tsx` so every sentence is true of your tools: what they receive, what they read, what you keep and for how long, who else touches it.
5. Copy `eval/holidays.eval.mjs`. Write 20 to 50 cases from prompts real users type, with expected values from an authority outside your code. Include the error cases.
6. If a tool fetches a URL a user gave you, use `safeFetch` from `lib/mcp/safe-fetch.ts`. Never `fetch` a user-supplied URL directly.
7. Deploy, run `pnpm preflight` and `pnpm evals` against production, test every tool in Claude, then work through [docs/SUBMISSION-CHECKLIST.md](docs/SUBMISSION-CHECKLIST.md).

Why each pattern exists, with the rule it answers: [docs/PATTERNS.md](docs/PATTERNS.md).

## What is in the box

| Path | What it does |
|---|---|
| `app/holidays/route.ts` | The connector endpoint. One file per connector. |
| `lib/mcp/tool.ts` | `ToolSpec`, `registerTools`, `runTool`: conventions, limits, errors, size cap, logging. |
| `lib/mcp/limits.ts` | Per-instance and global limits, never by IP; Redis with an in-memory fallback; a small cache. |
| `lib/mcp/safe-fetch.ts` | SSRF-safe fetch: public addresses only, guarded DNS lookup, five checked redirects, byte cap, deadline. |
| `lib/holidays/` | The example connector: the holiday engine and its five tools. |
| `lib/site.ts` | Company, support and security contacts, policy date. Edit first. |
| `app/docs`, `app/privacy`, `app/terms`, `app/support` | The pages reviewers and users open. |
| `app/.well-known/security.txt` | RFC 9116 security contact. |
| `eval/` | Dependency-free MCP client and the example's 35 checks against a live URL. |
| `scripts/preflight.mjs` | Pre-submission checks against a deployed URL. |
| `scripts/check-prose.mjs` | Fails on em and en dashes in tracked files. |
| `test/` | Unit tests for conventions, limits, SSRF guard and the example engine. |
| `docs/` | The submission checklist and the pattern notes. |

## Environment

The example runs with no environment variables. Optional:

| Variable | Purpose |
|---|---|
| `SITE_URL` | Public origin, if you are not on Vercel or want a custom domain in page links. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Global rate limits and cache shared across instances. The Vercel Marketplace integration sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` instead; both are read. Without Redis, each instance limits itself in memory at one tenth of the global numbers. |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local server on port 3000. |
| `pnpm test` | Unit tests (Node's built-in runner). |
| `pnpm evals <url>` | The example's evals against a running server. |
| `pnpm preflight <url>` | Pre-submission checks against a deployed URL. |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | The usual. |
| `pnpm check:prose` | No em or en dashes in tracked files. |

## About the example

The Holiday Calendar computes the eleven U.S. federal holidays from 5 U.S.C. 6103, a public-domain statute, with the observance rule federal offices follow: Saturday holidays move to the Friday before, Sunday holidays to the Monday after. It covers 2021 through 2100. Its tools list a year of holidays, find the next ones, check whether a date is a business day, add business days to a date, and count business days in a span. It makes no network calls and stores nothing. The evals check its answers against the Office of Personnel Management's published schedules.

## Contributing and security

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

This kit is not affiliated with or endorsed by Anthropic. "Claude" is a trademark of Anthropic, PBC. Directory rules change; the checklist links every rule to Anthropic's documentation so you can confirm it before you submit.

## Built by Modern Mustard Seed

This kit comes from [Modern Mustard Seed](https://modernmustardseed.com), an AI studio in Kalispell, Montana that builds websites, AI voice agents and custom software for small businesses, managed for you, end to end.

- [Live demo of the example connector](https://starter.modernmustardseed.com)
- [How we build connectors, and why each rule exists](https://modernmustardseed.com/how-we-build)
- [Every connector we have built for Claude](https://modernmustardseed.com/built-for-claude)
- [Docs for our production connectors](https://mcp.modernmustardseed.com)

## License

[MIT](LICENSE), Copyright (c) 2026 Modern Mustard Seed LLC.
