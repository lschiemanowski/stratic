# Description-led changes

The bundled agent skill describes a way of changing software while keeping its descriptions useful. The agent starts from the request and existing intent, follows the relevant explanations into implementation, and leaves a proposal whose effects and check evidence can be inspected before committing.

For a behavior change, the skill asks the agent to investigate existing intent and clarify consequential uncertainty, then refine the affected descriptions before implementing the change. For code-led work, it asks the agent to reconcile the descriptions while preserving intentional unfinished behavior. This prevents a missing implementation from being “fixed” merely by deleting its stated intent.

Investigation follows the changed responsibilities and records why nearby promises changed or stayed valid. For example, adding early lease release to a queue may change command and lifecycle descriptions while leaving the storage representation valid. The unchanged storage decision should explain that fact; it should not be a generic assertion that everything else looks fine. Evidence may warrant investigating effects beyond the declared links.

The agent runs appropriate checks, captures the content examined, and records what was actually observed. It prepares a review only after the descriptions, links, evidence, and impact decisions agree. The user authorizes acceptance of that concrete proposal; navigation requests and a prior test pass are not permission to commit.

The skill also asks for an explicit v3 executable path when several Stratic versions are available. It is guidance for agent behavior, not an automated proof that the agent followed the workflow. Its own instructions remain reviewable as a file in the checkout.

When a description has a summary, the agent checks its bullets against the full account during the same investigation. Changes to promises, conditions, or limitations must be reflected in both. A useful new summary can be added as optional metadata, but the workflow does not require summaries for every description. The summary condenses the responsibility’s behavior rather than listing its children or introducing separate implementation links.
