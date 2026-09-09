# Lease transitions

Queue transitions implement the lifecycle using an ordered list of jobs with nullable lease fields.

Submission uses the next identifier, advances it, and appends an unleased job to the stored list.

Claiming scans the list in insertion order for an unleased job or a lease whose expiry is at or before the supplied time. It records the worker and an expiry 30 seconds later.

Acknowledgement locates the job, checks its worker and strictly future expiry, and removes it from the stored list. A failed check throws before storage is written.
