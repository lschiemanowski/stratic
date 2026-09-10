# Reading test evidence and project problems

The reader lets a person inspect the evidence and mechanical problems associated with a project while descriptions are still being edited. This supports review without requiring the desktop to become a test runner or to prevent all incomplete intermediate states.

Tests appear with the descriptions whose behavior they check. The existing test catalog connects a short account of each test to exact description passages and executable source passages. The reader shows only tests directly associated with the description being read; it does not infer coverage from nearby code or collect tests from every descendant. When implementation is open, that description’s tests appear beneath the source, keeping both kinds of evidence together. Otherwise they appear after the description. There is no separate Tests view.

Each test starts as a compact expandable row containing its short description and a small result disk. Expanding it reveals the linked test source, with syntax colors and the selected lines highlighted, plus links back to the claims it checks. Expanding a test keeps the current description and implementation in place. Opening it reads source at the viewed revision; it never executes the test.

A green disk means a recorded individual pass for the viewed content; a red disk means an individual failure. An inconclusive or missing result uses a neutral disk. Earlier evidence uses an outlined disk and a short label such as “Earlier pass”, so an old success cannot be mistaken for a current one. The reader prefers the newest matching result, falling back to the newest earlier result only when none matches. Expanded rows identify the recorded time, environment, method and evidence. An aggregate result supplies no individual outcome unless that test is named explicitly.

For example, a test may have passed before a description edit, but its record still names the older content tree. The reader keeps that pass visible as earlier evidence. This does not mean the test now fails, and opening the row does not rerun it. The person or agent decides what fresh verification the change requires.

The Problems view lists issues discovered while loading the project, including malformed metadata, invalid hierarchy, and broken passage links. A title-bar shortcut appears when there are problems; a zero count is not displayed. Where an issue identifies a description, it can be opened for inspection. Descriptions also expose their own connection problems, so a reader can find the affected prose directly.

Tests and problems answer different questions. A clean Problems view means the recorded structure and links resolve. A passing test reports an observed execution. Neither by itself establishes that the account of the program is complete or accurate.
