# On-demand chat and vector memory: local validation

Date: 2026-11-28. Baseline commit: `82b64a45c34facbc98ff4b9f33c067d3ccab6a17`.

Environment: Apple M5 Pro, 24 GiB RAM, macOS arm64, Node 26.13.1, Chromium 156.
All tests used isolated temporary data directories. The original synthetic chat fixture and user data were preserved.

## Implementation boundaries

- A libSQL sidecar separates message metadata from bodies. The initial import streams JSONL once. Ordinary paging locates messages through a sequence index before reading the required bodies; it does not load the full file and slice it.
- The browser retains a window of messages, normally 100. Generation fetches recent history to cover its prompt token budget; summarization reads forward from the last processed message.
- Local DiskANN retrieves bounded candidate references. Current revisions, hidden status and the protected tail are checked before fetching only the message bodies selected for injection.
- Vector synchronization uses stable message IDs, revisions and swipes. Ordinary synchronization handles loaded or explicitly changed IDs; explicit Vectorize All walks metadata pages to find missing versions.
- Saves check the chat revision, original window IDs and message versions, preserving unloaded prefixes and suffixes. JSONL remains a streamed compatibility projection, so bytes written still grow with the complete file size.
- An explicit full-history compatibility option downloads the complete chat for extensions that require every message in `context.chat`. It is off by default.

## Chat measurements

The existing `bench-heavy-9000rounds.jsonl.gz` fixture decompresses to **254,328,387 bytes**, containing 9,000 rounds / 18,000 messages. Message bodies and reasoning are retained. Both versions display the latest 100 messages and run the actual `getChat()` function, without replacing application source to skip behavior.

Each version was measured five times with a new browser context per trial. The operating system file cache was not flushed. First-view latency runs from the `getChat()` call through two animation frames after its return. Retained heap is CDP `JSHeapUsedSize` after garbage collection.

| Metric | Baseline | Optimized | Change |
| --- | ---: | ---: | ---: |
| Median first-view latency | 1,248.8 ms | 179.5 ms | 85.6% lower |
| Median retained browser JS heap | 214.09 MiB | 20.51 MiB | 90.4% lower |
| Messages retained in the browser | 18,000 | 100 | Bounded window |
| Decoded chat response bytes | 254,328,389 | 1,424,374 | 99.44% lower |
| Median longest main-thread task | 149 ms | 118 ms | Rendering still has long tasks |

**The first open without a sidecar** was measured separately once: 1,787.9 ms, including a 1,608.2 ms `/api/chats/page` request. That request imports the complete JSONL sequentially; subsequent reads do not repeat the import. This is not a cold-disk measurement.

The actual backend ChatStore was also measured in a separate process:

| Operation | Latency | Read boundary |
| --- | ---: | --- |
| Initial indexing and 100 bodies | 1,616.95 ms | Streams the 254 MB source once |
| 100-message pages at random positions, 20 trials | Median 4.44 ms / P95 4.97 ms | 100 body rows and zero JSONL import bytes per trial |
| Bodies for 10 stable IDs | 0.31 ms | 10 body rows |
| Edit one message and update compatibility JSONL | 777.26 ms | Streams a complete JSONL rewrite |

The chat sidecar occupies 262,742,016 bytes. Its WAL may retain additional space at the import high-water mark while open. Peak process RSS across import, paging and writing was 204.91 MiB; this is not a paging-only peak. The write measurement excludes HTTP and endpoint backup overhead.

## Vector retrieval measurements

The same synthetic chat supplies text for 18,000 deterministic 768-dimensional vectors: 64 noisy clusters and 20 fixed perturbed queries. The old Vectra file occupies 363,259,594 bytes. Both versions retrieve the cosine top 10. The baseline opens a LocalIndex and performs an exact scan for each query; the optimized version retrieves 40 ANN candidates, recalculates their distances and reads only the top 10 bodies.

Timing includes opening storage, searching, reading bodies and closing storage. It excludes embedding services and LLM calls. Before each timed operation, the event loop and GC can finish cleaning up the previous native handles, matching the worker lifecycle between separate requests.

Final parameters: `search_l=512`, `compress_neighbors=float8`, `insert_l=70`, `alpha=1.2`. Base vectors remain float32.

| Metric | Vectra exact scan | DiskANN |
| --- | ---: | ---: |
| Median query latency | 405.51 ms | 19.07 ms |
| P95 | 422.35 ms | 21.94 ms |
| Peak query-process RSS | 1,216.63 MiB | 66.84 MiB |
| Recall@10 against the exact top 10 | 100% | 100% |

The baseline ran 20 queries. The optimized version repeated those queries for five rounds, totaling 100 searches; both mean and worst individual Recall@10 were 100%. **This measures approximate-index recall on this synthetic vector dataset, not semantic memory quality or a guarantee for other distributions.** The faster default-parameter result with approximately 74% recall was not selected.

After VACUUM, the final index occupies 1,449,701,376 bytes (approximately 1.35 GiB). Formally rebuilding this graph from stored vectors took 101.7 seconds; initial embedding and incremental ingestion depend on the model and chunk count. Query peak memory excludes rebuilding and VACUUM. Disk usage and initial construction are material costs of this approach.

## Correctness and compatibility

Actual Chromium checks cover single/group chat paging, deletion on an older page, editing, swipes, appending, branch cutoffs, summary writes outside the UI window, global prompt-cache IDs, unsubmitted editor drafts and compatibility-mode changes. The checks independently inspect the final JSONL prefixes, suffixes and message counts. No browser page errors occurred.

Regression coverage includes revision conflicts, concurrent saving and chat changes, stale requests, page byte budgets, legacy group imports, tool-call boundaries, reasoning-aware context budgets, global message commands, index isolation, incremental synchronization, worker backpressure and event-loop responsiveness.

Final local validation: all 480 tests in 26 Jest suites and 30 Node frontend/integration tests passed. ESLint on changed files and `git diff --check` passed.

Before opening the upstream PR, integration with staging `c96a1d0c6` was checked again: all 593 tests in 31 Jest suites, the same 30 Node tests, full `npm run lint`, and the Chromium functional harness passed. On macOS, Jest used the canonical temporary directory path (`/private/var/...` instead of its `/var/...` symlink), which lets the upstream character-edit tests intercept the same path that atomic writes resolve. The performance measurements above were recorded before this staging integration.

Explicit change/deletion queues retry during subsequent synchronization but do not survive browser reloads. Vectorize All can scan metadata to repair missing vectors after a reload or interruption. Retrieval filters deleted and stale revisions before injection. External JSONL changes rebuild the sidecar and replace stable IDs, so that chat's vectors need synchronization again. Older extensions requiring the complete history should use compatibility mode.

## Reproduction entry points

`chat-loading.mjs` measures actual browser loading against a running baseline or modified server. `--mode baseline` verifies the complete array is loaded; `--mode optimized` verifies the array is bounded. Record the first index build separately from repeated indexed loads.

```sh
node tests/performance/chat-loading.mjs --url http://127.0.0.1:18767 --mode optimized --fixture bench-heavy-9000rounds --messages 18000 --page 100 --repeats 5 --output /tmp/chat-results.json --executable /absolute/path/to/chromium
node tests/performance/chat-functional.mjs --url http://127.0.0.1:18767 --data-root /absolute/path/to/isolated-data --output /tmp/chat-functional.json --executable /absolute/path/to/chromium
node --expose-gc tests/performance/chat-storage.mjs --fixture /absolute/path/to/synthetic.jsonl --scratch /tmp/new-storage-benchmark --output /tmp/storage-results.json
```

`chat-functional.mjs` requires an isolated data directory containing the default Seraphina character and `bench-heavy-100rounds.jsonl` (200 messages). Each run creates new test chats. Do not run this harness against real user data.

The `prepare`, `build`, `baseline` and `optimized` phases of `vector-retrieval.mjs` create and compare deterministic vectors. `vector-tuning.mjs` uses a separate copy of an existing database, performs formal DROP/CREATE INDEX and VACUUM, and supports `--reuse` for query-only measurements. It does not modify the source index. Tune copies of the production directory layout, and do not copy an active WAL database.

```sh
node --expose-gc tests/performance/vector-retrieval.mjs --phase prepare --root /tmp/new-vector-benchmark --fixture /absolute/path/to/synthetic.jsonl --output /tmp/vector-fixture.json
node --expose-gc tests/performance/vector-retrieval.mjs --phase build --root /tmp/new-vector-benchmark --fixture /absolute/path/to/synthetic.jsonl --output /tmp/vector-build.json
node --expose-gc tests/performance/vector-retrieval.mjs --phase baseline --root /tmp/new-vector-benchmark --output /tmp/vector-baseline.json
node --expose-gc tests/performance/vector-retrieval.mjs --phase optimized --root /tmp/new-vector-benchmark --output /tmp/vector-optimized.json
node --test tests/chat-store.test.mjs tests/group-chat-window.test.mjs tests/chat-window-editor.test.mjs
npm --prefix tests run test:unit -- --runInBand
```

Final measurements are retained in `measurements.json` in this directory. Complete raw JSON, screenshots and rejected tuning results remain in the local session's `on-demand-memory` artifact directory. Large fixtures and temporary databases are excluded from Git.
