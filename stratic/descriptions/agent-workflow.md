# Description-led changes

The bundled agent skill describes a way of changing software while keeping its descriptions useful. The agent starts from the request and existing intent, follows the relevant explanations into implementation, and leaves a proposal whose effects and check evidence can be inspected before committing.

For a behavior change, the skill asks the agent to investigate existing intent and clarify consequential uncertainty, then refine the affected descriptions before implementing the change. For code-led work, it asks the agent to reconcile the descriptions while preserving intentional unfinished behavior. This prevents a missing implementation from being “fixed” merely by deleting its stated intent.

Investigation follows the changed responsibilities and records why nearby promises changed or stayed valid. For example, adding early lease release to a queue may change command and lifecycle descriptions while leaving the storage representation valid. The unchanged storage decision should explain that fact; it should not be a generic assertion that everything else looks fine. Evidence may warrant investigating effects beyond the declared links.

The agent runs appropriate checks, captures the content examined, and records what was actually observed. It prepares a review only after the descriptions, links, evidence, and impact decisions agree. The user authorizes acceptance of that concrete proposal; navigation requests and a prior test pass are not permission to commit.

The skill identifies the installed executable with its version response, while respecting a repository-specific checkout command. It is guidance for agent behavior, not an automated proof that the agent followed the workflow. Its own instructions remain reviewable as a file in the checkout.

Whenever the agent creates or changes a description or its metadata, it creates a nonempty summary if one is missing and reviews existing bullets against the full account. Changes to promises, conditions, or limitations must be reflected in both; accurate existing bullets can remain unchanged. The summary condenses the responsibility’s behavior rather than listing its children or introducing separate implementation links. Older content and drafts can still be read without summaries, but the workflow supplies them as descriptions are created or maintained.

The core workflow leaves the implementation method open. Project instructions supply conventions, check commands and the executable location. Installed skills use the stratic command; work on Stratic itself can use its checkout CLI as directed by repository instructions. Optional skills can add a chosen approach while retaining the shared description, evidence and acceptance responsibilities. Installing the TDD skill alone does not select test-first development; the user or project must choose it.
