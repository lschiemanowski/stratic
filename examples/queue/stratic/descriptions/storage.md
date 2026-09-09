# Persistent storage

Persistent storage preserves the queue between short-lived commands. A successful operation writes the complete state to a temporary file and atomically replaces the queue file. An operation that throws does not write the changed state. Concurrent writers are outside this example’s scope.
