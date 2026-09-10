# Test-link audit

Reviewed against the implementation at `794b61d` and the catalog changes in this proposal. This is an account of inspected assertions, not a coverage percentage or a promise that every described condition is tested.

The catalog contains 36 entries linked directly to 23 descriptions. All 25 top-level unit tests concerning Stratic itself have individual catalog entries. The other top-level unit test checks the worked queue example’s command interface; it is not a test of Stratic’s CLI. The example also maintains its own description and test catalog.

The complete desktop smoke remains associated with Desktop reader. Ten focused entries select the parts of that same script which check project selection, summaries, navigation, highlights, source, paired descriptions, the tree, test evidence, formatted content, and renderer boundaries. These entries are assertion groups within one sequential integration run, not new independently executable tests. Their source links retain the surrounding file for shared setup and context. Record all their outcomes only when the complete run succeeds; an interrupted run does not establish an outcome for every group.

The two tree-layout unit tests now have separate identities, so a result can distinguish malformed-hierarchy layout from depth limits and individual folds. Existing tests also gained links for stable hierarchy identities, implementation passage resolution, exact-content check requirements, and the CLI's prepared identity response. Test explanations state what the assertions examine. The desktop description and summary no longer place Tests in View.

## Remaining gaps

- Direct CLI execution is tested for `accept` and the `ready` identity used to accept. There are no focused command-level tests for `list`, `show`, `source`, `validate`, `impact`, `snapshot`, `check record`, `check list`, `prepare`, `discard`, `ui current`, `ui open`, `version`, or `help`. Tests of model operations or desktop session requests are not evidence for these commands' argument parsing and dispatch.
- Agent workflow guidance has no automated test establishing the quality of an agent's investigation, summaries, or semantic review. That remains a review responsibility.
- Links identify exercised behavior within a description, not complete coverage of every promise. Examples of narrower coverage: source rendering checks unknown-language fallback but not the 200,000-character threshold; test-evidence rendering checks stale results but not precedence between a newer stale result and an older current one; image tests use SVG and PNG bytes rather than exercising every supported format's decoding.
- The example CLI test in `test/queue-cli.test.ts` has no matching Stratic product responsibility. It remains outside this product catalog instead of being misleadingly linked to Stratic's CLI.

Further tests should address these concrete gaps as those responsibilities are changed. Broad descriptions do not need copies of every descendant's test link merely to make a test row appear.
