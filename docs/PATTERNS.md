# The patterns, and why each one exists

Each pattern in this kit answers a specific way connectors fail review or fail in production. They were extracted from connectors Modern Mustard Seed runs in production for Claude.

## 1. One route per connector, no redirect

`app/<connector>/route.ts` exports the `mcp-handler` handler for `POST` and `DELETE`, and a `GET` that answers a browser with a short HTML pointer to the docs instead of a protocol error. Register that exact URL.

Why: Claude drops the `Authorization` header when a registered URL redirects to another host, and the failure surfaces later as "Authorization with the MCP server failed." Apex to `www`, trailing-slash normalization and region routing are the usual culprits ([Troubleshoot your connector](https://claude.com/docs/connectors/building/troubleshooting)). `pnpm preflight` fails on any 3xx.

## 2. Tools declared as data, checked at load

Every tool is a `ToolSpec` (`lib/mcp/tool.ts`): name, title, description, zod input schema, annotations, a per-minute limit, optional global limits, optional log fields, and a `run` function that returns an `Outcome`. `registerTools` runs `assertConventions` before registering anything, so a missing title, a 65-character name, a write tool without `destructiveHint`, or a description that says "always call X first" throws during `pnpm test` and `pnpm build`, not during review.

Annotation conventions:

| Kind of tool | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
|---|---|---|---|---|
| Computes from its inputs only | `true` | `false` | `true` | `false` |
| Reads the public web or a third-party API | `true` | `false` | `true` | `true` |
| Creates something new | `false` | `false` | `false` | as applies |
| Updates or deletes | `false` | `true` | as applies | as applies |

Read-only tools run without a confirmation prompt in Claude; destructive tools always prompt ([review criteria](https://claude.com/docs/connectors/building/review-criteria)). Never put safe and unsafe operations in one tool, and never ship a catch-all `api_request` tool with a `method` parameter: both are rejected.

## 3. Descriptions describe; they never steer

A description says what the tool does and when to use it. It does not tell Claude which tool to call next, to prefer this tool over others, to fetch instructions from somewhere, to ignore anything, or to suggest a product. `STEERING_PATTERNS` catches the common forms. It is a guard rail, not a proof: read every description as a reviewer would.

## 4. Specific errors, returned as tool results

A tool validates its own inputs and returns `fail(code, sentence)` with a sentence that names the field, the value, and what to change: "date is 2026-02-30, which is not a real calendar date." Use loose zod types (`z.string()`, `z.number().int()`) and check ranges in `run`, because a raw schema rejection reads as "Bad Request" to a reviewer. `runTool` turns an unexpected exception into "`<tool>` hit an unexpected problem on the server and did not finish. Nothing was changed." and logs the real message server side.

Keep refusals rare on valid input: results with `isError: true` count toward the error rate behind your listing's health badge.

## 5. Output size caps

Claude accepts about 150,000 characters per tool result on claude.ai and Desktop and 25,000 tokens by default in Claude Code ([Build an MCP server](https://claude.com/docs/connectors/building/index)). `MAX_RESULT_CHARS` is 60,000, which fits both. Over the cap, the tool returns a specific error rather than truncated JSON. Design so you never reach it: give list tools a `limit`, give range tools a maximum span, and return summaries by default with a `detail` option.

## 6. Rate limits for a shared egress range

Every claude.ai user reaches your server from Anthropic's outbound range, `160.79.104.0/21` ([IP addresses](https://platform.claude.com/docs/en/api/ip-addresses)). A per-IP limiter therefore throttles all Claude users as one client, and a WAF, bot rule or limiter that returns 403 or 429 to that range breaks the connector before your code runs ([Troubleshooting](https://claude.com/docs/connectors/building/troubleshooting)).

`lib/mcp/limits.ts` never keys by IP:

- `allowCall(tool, perMinute)`: per tool, per server instance, in memory. Stops a runaway loop for free.
- `allowGlobal(what, rules, key)`: shared by every instance through Upstash Redis. Key by target (a domain, an account) for anything that loads someone else's server, and by `global` for anything that costs you money.
- Refusals are ordinary tool results with `isError: true` and "Try again after HH:MM UTC." Never an HTTP 429.
- If Redis is missing or slow (1.5 second timeout), each instance falls back to memory at one tenth of the global limit, so an outage tightens limits instead of lifting them.

Set a spend cap with your host as the last line.

## 7. SSRF-safe fetch

Any tool that fetches a URL a user supplied must use `safeFetch` (`lib/mcp/safe-fetch.ts`). It allows http and https on ports 80 and 443 only, refuses credentials in URLs and private network names, checks every resolved address against private, loopback, link-local (cloud metadata at `169.254.169.254`), CGNAT, multicast, reserved and documentation ranges for IPv4 and IPv6, runs that check inside the socket's own DNS lookup so a rebinding answer cannot slip through, follows at most five redirects by hand with every hop re-checked, caps the body after decompression, and enforces one deadline across all hops. `test/safe-fetch.test.ts` proves each rule, including that a listening loopback server receives zero requests.

## 8. Logging that respects Policy 1D

One JSON line per call: server, tool, latency, status, result size, plus only the fields `logFields` returns. Arguments are not logged by default. Keep logs 30 days or less and say so in the privacy policy.

## 9. Evals against the live URL

`eval/mcp-client.mjs` speaks Streamable HTTP with no dependencies. Each case pairs a real prompt with the tool call Claude makes for it and a check on the answer. Expected values come from an authority outside your code (for the example, the federal holiday schedule), not from the function under test. The runner also fails when `tools/list` breaks an annotation rule, when a call is slower than the budget, and when any advertised tool goes untested. No model is called, so evals cost nothing and need no API key; run them before and after every description or behavior change, and once more against production before you submit.

Evals prove the server answers each prompt's tool call correctly. Whether Claude picks the right tool for the prompt is checked by hand in Claude as a custom connector, which the portal's Test & launch step asks you to confirm.

## 10. Public pages reviewers open

`/docs/<connector>`, `/privacy`, `/terms`, `/support` and `/.well-known/security.txt` all read `lib/site.ts`, so the company name, support inbox and policy date are written once. The docs page carries a "For reviewers" list of exact inputs and expected results, which you paste into the Test & launch step.
