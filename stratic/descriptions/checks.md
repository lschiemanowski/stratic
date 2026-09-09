# Checks and test results

Checks provide evidence about a particular project snapshot. Stratic keeps that evidence close to the descriptions it concerns while using the project’s existing test and analysis tools. There is no separate Stratic test runner that decides what every change must execute.

A result records the examined Git tree, the method used, the environment, the observed evidence, and an overall pass, fail, or inconclusive outcome. It may name individual test identities and outcomes when the execution establishes them. Each test appears at most once in that record; an empty individual list is appropriate for a typecheck or manual review without cataloged test outcomes.

Results can be recorded before a review exists. Preparation selects passing records whose tree exactly matches the proposed content and copies them into the review. This preserves the evidence with the accepted change instead of depending on local check storage remaining available forever.

The test catalog is separate from execution results. A catalog entry says which executable passage is a test and which description passages it checks. A result says what happened when a check was performed. For example, a cataloged ownership test can exist before its first run, and one recorded test run can report several catalog entries without redefining them.

The desktop compares result content identities with the viewed project and labels evidence as current or earlier. It recognizes an accepted review’s content tree when the only added file is that review itself. This accounts for the review containing its own check evidence without treating arbitrary later edits as tested.

A passing test remains distinct from a judgment about the descriptions’ accuracy. An earlier result may still inform the agent, but exact matching means it cannot simply be relabeled as a pass for changed content. The agent decides which checks are appropriate, runs or performs them, and records the actual observation.
