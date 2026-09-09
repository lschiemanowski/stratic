# check record: Preserve an observed result

Check record imports an observed check result into worktree-local evidence storage. It separates the lifetime of check evidence from the lifetime of a prepared review, so results can be retained before any proposal is ready.

The request supplies a JSON record naming the examined tree, method, environment, evidence, overall outcome, and an explicit list of individual test outcomes. Pass, fail, and inconclusive are recordable outcomes. An empty individual list represents a check for which no cataloged test outcomes were established.

The record is validated for its required fields, an existing Git tree, and unique individual test identities. The operation assigns a result identity and timestamp, appends it to local storage, and returns the saved record. Preparation can later select passing records for matching content.

The imported account remains supplied evidence. This command does not execute the named method or verify that the observation was reported truthfully. In particular, an overall suite outcome does not cause it to infer individual results for every registered test.
