# Test-first changes

The TDD skill adds an optional test-first approach to Stratic’s description-led work. It applies when the user selects TDD for a task or the project’s instructions choose it as the applicable default. Installation alone does not select it. A task-specific choice can use another approach without changing the project default or Stratic’s acceptance rules.

The agent first understands a coherent behavior and refines its description, then writes tests for its important outcomes and conditions. The tests must fail against the incomplete implementation for the intended reason. Broken imports, fixture errors, or unrelated failures do not establish that the desired behavior is absent. Useful failure output identifies the content examined and remains distinguishable from later passing evidence.

Implementation and refactoring proceed with the relevant tests, followed by additional checks appropriate to the affected responsibilities and boundaries. The workflow allows a coherent set of tests before implementation; it does not require artificial one-test microcycles or every available check on every task. Tests link to the description claims they actually check, and implementation links identify the code supporting those claims.

The core skill still governs description and summary accuracy, affected-responsibility review, evidence recording, preparation, and separately authorized acceptance. The test-first supplement changes how a behavior is developed, not who may accept it. An earlier meaningful failure is useful history, not passing evidence for the final proposal.
