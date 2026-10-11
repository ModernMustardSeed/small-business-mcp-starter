# Contributing

Thank you for helping. Before you open a pull request:

1. `pnpm install`
2. `pnpm typecheck && pnpm lint && pnpm test && pnpm check:prose`
3. `pnpm build && pnpm start`, then in another terminal `pnpm evals http://localhost:3000`

All four must pass. CI runs the same steps.

House rules for this repository:

- **Cite the rule.** A change to the checklist or to a convention links the Anthropic page or policy section it comes from.
- **No em or en dashes** in code, comments, docs or commit messages. Use a comma, a colon or a period.
- **Errors are sentences.** A new failure path returns a message that names the field, the value and what to change.
- **Evals use outside truth.** Expected values come from an authority, not from the code under test.
- **No secrets, ever.** Nothing in this repository needs an API key. Do not add one, even to CI.

By contributing, you agree that your contribution is licensed under the MIT License in this repository.
