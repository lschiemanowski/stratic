# Local work queue

The local work queue is a command-line application for producers and workers on one machine. Each invocation submits work or performs one worker operation and exits.

The command interface exposes the queue operations. The queue engine keeps jobs available across invocations and manages temporary ownership.

A producer can submit a report job, and a worker can claim and complete it later. Jobs survive process restarts. This example supports one writer at a time.
