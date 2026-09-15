# Working on Stratic

Use the repository-local core skill at `.agents/skills/stratic/SKILL.md` when changing this project. The CLI is `node src/cli.ts` from this checkout; do not substitute an installed v1 or v2 executable.

The optional `.agents/skills/stratic-tdd/SKILL.md` workflow is available when the user selects TDD. Its presence does not make test-first development the default. Task-specific workflow choices take precedence over project defaults.

Available checks are `npm run typecheck`, `npm test`, `npm run test:desktop`, and `node src/cli.ts validate`. Choose checks appropriate to the change and record what actually ran.

Bundled skill sources live in `skills/`. After changing them, inspect `skill status` and explicitly update the repository-local copies with `node src/cli.ts skill update`. Preserve local customizations; these copies and their installation record are versioned with the project.
