# Job lifecycle

The job lifecycle governs submission and worker operations.

Submitting work appends a job with a monotonically increasing identifier.

Claiming selects the oldest available job and grants a 30-second lease; an expired job is available again.

Acknowledgement removes a job only when the requesting worker owns its live lease; invalid requests leave state unchanged.
