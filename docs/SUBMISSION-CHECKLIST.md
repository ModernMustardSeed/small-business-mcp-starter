# Claude directory submission checklist

Everything the directory form asks for, step by step, and where this kit already covers it. Verified against Anthropic's documentation on 2026-10-11:

- [Submit a connector to the directory](https://claude.com/docs/connectors/building/submission)
- [Connector pre-submission checklist (review criteria)](https://claude.com/docs/connectors/building/review-criteria)
- [Build an MCP server for Claude](https://claude.com/docs/connectors/building/index)
- [Test your connector](https://claude.com/docs/connectors/building/testing)
- [Troubleshoot your connector](https://claude.com/docs/connectors/building/troubleshooting)
- [IP addresses](https://platform.claude.com/docs/en/api/ip-addresses)
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy), updated April 15, 2026
- [Anthropic Software Directory Terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms)

Docs move. Before you submit, open each link and re-read it. If anything below disagrees with the live page, the live page wins; please open an issue so the kit can be corrected.

## Before you open the portal

| Requirement | Where it is in this kit | Done |
|---|---|---|
| Remote server reachable over HTTPS with a public IPv4 `A` record. Connectors are IPv4-only. | Deploy to Vercel (see README). `pnpm preflight <url>` checks HTTPS. Run `dig +short your-host` from outside your network. | [ ] |
| Streamable HTTP transport (Policy 5F). | `mcp-handler` 2.x serves it at `app/<connector>/route.ts`. | [ ] |
| The registered URL never redirects. Claude drops `Authorization` on a cross-host redirect. | One route per connector, no trailing slash. `pnpm preflight` fails on any 3xx. | [ ] |
| No WAF, bot rule or rate limiter answers Anthropic's egress range `160.79.104.0/21` with 403 or 429. | `lib/mcp/limits.ts` never keys by IP and never returns HTTP 429. Leave Vercel Attack Challenge Mode and bot rules off for the MCP paths. | [ ] |
| No strict `Origin` validation (a named cause of `initialize` timeouts). | The route does not check `Origin`. Do not add a check. | [ ] |
| Every tool has a `title` and the applicable `readOnlyHint` or `destructiveHint` (Policy 5E). | `ToolSpec.annotations` is required; `registerTools` throws at load when one is missing. | [ ] |
| Tool names 64 characters or fewer (Policy 5C). | Enforced by `conventionProblems` and `pnpm test`. | [ ] |
| Read and write split: no tool mixes safe and unsafe operations; no catch-all `api_request` tool. | One `ToolSpec` per action. A write tool must declare `destructiveHint`. | [ ] |
| Narrow, accurate descriptions with no steering: no "call X first", no "ignore", no fetching instructions, no promotion (Policy 2A to 2G, 4C). | `STEERING_PATTERNS` in `lib/mcp/tool.ts` rejects the common patterns at load. | [ ] |
| Specific errors, never "Internal Server Error" or "Bad Request" (Policy 5A). | `Outcome` failures carry a sentence; `runTool` converts exceptions into a specific message; evals assert it. | [ ] |
| Results sized to the task (Policy 5B). Claude's limits: about 150,000 characters on claude.ai and Desktop, 25,000 tokens by default in Claude Code. | `MAX_RESULT_CHARS` is 60,000; over it the tool returns a specific error. Give tools `limit` or range inputs. | [ ] |
| Calls finish well inside 240 seconds. | `maxDuration` per route; set tight deadlines on outbound fetches with `safeFetch({ timeoutMs })`. | [ ] |
| Only the data the tool needs; no conversation logging (Policy 1D). | `runTool` logs tool, latency, status, size and only the fields `logFields` returns. | [ ] |
| Calls only APIs you own or legitimately proxy; the server domain matches your service (Policy 3F). | Serve from your own domain. Declare any third-party source honestly in the Data handling step. | [ ] |
| Any tool that fetches a user-supplied URL is SSRF-safe. | `lib/mcp/safe-fetch.ts`, with `test/safe-fetch.test.ts`. | [ ] |
| Privacy policy covering collection, use and storage, third-party sharing, retention and contact (Policy 3A). | `app/privacy/page.tsx`. Rewrite every sentence for your tools. | [ ] |
| Verified support contact and security channel (Policy 3B). | `lib/site.ts`, `app/support/page.tsx`, `/.well-known/security.txt`. | [ ] |
| Public documentation: purpose, setup, tools, examples, troubleshooting (Policy 3C). Can be private during review, public by publish date. | `app/docs/holidays/page.tsx`. | [ ] |
| At least three working example prompts (Policy 3E). | `EXAMPLE_PROMPTS` in your tools module, shown on the docs page and covered by evals. | [ ] |
| Not a money mover (4A), not AI image, video or audio generation (4B), not an ad or promotional vehicle (4C). | Scope decision. Keep output to the data; one plain attribution line at most. | [ ] |
| Every tool run through MCP Inspector and as a custom connector in Claude. | `npx @modelcontextprotocol/inspector --cli <url> --transport http --method tools/list`, then Customize > Connectors > Add custom connector. | [ ] |
| Evals green against the deployed URL. | `pnpm eval <url>` | [ ] |
| A paid Claude plan (Pro, Max, Team or Enterprise; on Team and Enterprise an Owner submits). The listing belongs to the submitting organization. | Decide which account should own the listing long term before you submit. | [ ] |

## The portal, step by step

Open [claude.ai/directory/manage](https://claude.ai/directory/manage), select **Submit new**, choose **MCP connector**. Progress saves in your browser as you move between steps.

### 1. Connection
- [ ] Paste the exact `https://` URL, for example `https://your-host.example.com/holidays`. No trailing slash, no redirect.
- [ ] Leave **Users connect to different URLs** off unless each customer has their own server.

### 2. Tools
- [ ] Tools, prompts and resources sync from the live server, grouped read-only versus write.
- [ ] No tool is flagged for a missing title or annotation. If one is, fix it on the server and redeploy; the form cannot fix it.

### 3. Listing
- [ ] Server name, 100 characters or fewer.
- [ ] One-liner, 200 characters or fewer.
- [ ] Description, 2,000 characters or fewer. What it does, for whom, what it reads. No pricing, no sales pitch.
- [ ] One to five categories.
- [ ] Documentation URL: `https://your-host/docs/<connector>`.
- [ ] Privacy policy URL: `https://your-host/privacy`.
- [ ] Support contact: the monitored inbox from `lib/site.ts`.
- [ ] Icon.
- [ ] URL slug. **Permanent once published.** Choose it once.

### 4. Use cases
- [ ] Primary use cases, in the words a user would type. Reuse your example prompts.
- [ ] What users need before they can connect. For an authless connector: nothing, no account.
- [ ] Reads data, writes data, or both. Match your annotations.

### 5. Company
- [ ] Company name and website.
- [ ] Primary contact for review updates.

### 6. Authentication
- [ ] **No authentication** for public-data connectors like the example. Authless is supported by default ([Authentication for connectors](https://claude.com/docs/connectors/building/authentication)).
- [ ] OAuth 2.0 only if tools act on a user's account. DCR and CIMD are supported by default; Anthropic-held client credentials and custom connections need coordination with the review team.
- [ ] If some tools work without sign-in and others prompt on demand, flag lazy authentication here.

### 7. Data handling
- [ ] Underlying API: your own, proxied from a partner with permission, or a third party's you do not control. Be exact.
- [ ] Whether the connector handles personal health data.
- [ ] Whether it handles sponsored content.

### 8. Test & launch
- [ ] Reviewer instructions detailed enough to run every tool: every link and step. For an authless connector, say "No account needed" and list exact inputs that return real results. Paste the "For reviewers" list from your docs page.
- [ ] If your connector has accounts, credentials for a fully populated test account (Policy 3D).
- [ ] Confirm you ran every tool through MCP Inspector or as a custom connector in Claude.

### 9. Compliance: seven acknowledgments, all required
- [ ] Directory guidelines.
- [ ] First-party API usage.
- [ ] Financial transactions.
- [ ] AI media generation.
- [ ] Prompt injection.
- [ ] Conversation data collection.
- [ ] Public documentation.

Read each one against your server, not against your intentions. The kit's tests cover prompt injection in descriptions, conversation data in logs, and the documentation page; first-party API usage, financial transactions and AI media generation are scope decisions only you can make.

### 10. Review and submit
- [ ] Read the quality warnings (for example, very short answers). They are shared with the reviewers, so fix them rather than submit over them.
- [ ] Submit.

## After you submit

- Anthropic scans the submission automatically and by default lists it as a **Community** connector. Listings flagged as highly useful can be escalated to **Verified** review, where a reviewer runs each tool. There is no application for Verified.
- Status and reviewer feedback appear in the portal. Escalations: `mcp-review@anthropic.com`.
- Tool changes ship by deploying the server; no resubmission. The display name and the tool names shown on the listing change through a listing edit a reviewer approves.
- The portal shows a health badge from your error rate over 30 days: Healthy at 2% or less, Worth a look above 2%, Degraded above 5%. Tool results with `isError: true` count, so a limiter that refuses too often or a tool that errors on valid input pulls the badge down ([Manage your listing](https://claude.com/docs/connectors/building/managing-your-listing)).
