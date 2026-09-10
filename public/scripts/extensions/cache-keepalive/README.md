# Automatic Cache Keepalive

Opt-in background refreshes for the active SillyTavern Chat Completion conversation.

## Use

Open **Extensions → Automatic cache keepalive**, enable the switch, and send a normal chat message. The default interval is **4 minutes**; the supported range is 0.1–1440 minutes. Choose an interval shorter than your provider's cache lifetime.

The extension retains the last actual request in memory, after prompt assembly and request customization. At each deadline, including while the normal reply is still being generated, it sends a copy of that request with one appended user message:

> 这只是刷新缓存，收到后回复确认即可。

The interval starts when the request is dispatched, including generation time. A request sent at 00:00 and completed at 02:00 is first refreshed around 04:00, not 06:00. Subsequent deadlines also use the refresh dispatch time. Refreshes run concurrently with normal generation using independent abort signals. Background refreshes never overlap each other or create catch-up bursts. Normal completion preserves the current refresh deadline, count and error pause. Manual Resume waits one interval from the click.

No refresh message or reply is added to the chat. Draft text is untouched. Returned tool calls are discarded without execution. Tool definitions, tool choice, model, system prompt, history, images, thinking settings, output budget, stream setting, and routing parameters are retained. Only `n` is reduced to one and the refresh instruction is appended.

After **six completed refreshes of an unchanged context**, automatic refreshes pause. **Resume** starts another cycle. A new normal generation replaces the snapshot and starts a new cycle. Errors and requests lasting longer than 180 seconds pause refreshes; there is no automatic error retry loop.

Switching chats, editing history, changing a model/preset/connection, or changing world info invalidates the saved request. Send a normal message again to establish a new snapshot. During generation, the comparison protects the submitted input and settings while excluding the growing output slot, including an existing slot being swiped or continued. History edits and model/connection changes still invalidate the snapshot. After completion, the sent input remains the baseline; new output and background bookkeeping are excluded. Comparison is limited to message inputs, character prompt text, author notes and connection settings, alongside explicit message/card/world-info edit events. Auxiliary quiet requests are excluded. Request bodies are never written to settings or browser storage.

## Cache behavior and limits

- Comparison tracks chat content and source settings, excluding chat-save timestamps and derived prompt-preview scratch data. Previews never replace the captured final request, and parallel quiet requests cannot overwrite a normal chat snapshot.
- Concurrent refreshes can reuse only matching cache entries that already exist. On Claude, a new cache entry becomes available after the first response begins; an earlier parallel request may write a new entry instead of hitting a cache.
- This keeps the **last real request's input prefix** warm. The model's latest reply was output, not part of that cached input, and is not reconstructed or appended to the snapshot. The next normal turn supplies it through SillyTavern's usual prompt construction.
- The request is sent through the same SillyTavern backend and provider. The provider must support prompt caching; its cache configuration, minimum token threshold, routing, and cache-hit rules still apply. A successful refresh is not proof of a cache hit. Check provider usage such as `cache_read_input_tokens` or `cached_tokens`.
- SillyTavern's provider conversion and depth-based cache markers still apply. Appending a user message can affect trailing message grouping or cache breakpoints. Exact preservation is guaranteed for the original **frontend request messages**, not every provider's final wire representation. Cache hits/TTL have not been verified against a paid provider in the automated tests.
- Billing uses the original model and settings. A model may ignore the acknowledgement instruction and consume up to the original output/thinking budget. Lowering that budget can change thinking configuration and invalidate caches, so this extension does not silently lower it.
- Keep the browser tab open. Suspended tabs, sleep, network outages and browser timer throttling can let a cache expire. Resuming a tab makes at most one refresh request, never a backlog of missed requests.
- Snapshots exist only for requests made after enabling this feature. They are dropped on reload. This supports **Chat Completion** connections, not Text Completion/Kobold/NovelAI connections.
- Use either the built-in version or the standalone extension. A shared ownership guard prevents duplicate timers when both are loaded in one page.

Provider reference: [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

## Status panel and updates

The panel follows SillyTavern's current language, displaying Chinese or English separately. It shows a live countdown, request snapshot availability, consecutive refresh count, last successful refresh time and reported cache usage. A captured request is not a cache hit. Positive cache-read tokens confirm a hit for the last successful refresh; explicit zero means no hit, and missing usage means unknown. Cache writes are shown separately. These are response usage measurements, not a live cache availability probe.

Common Claude, OpenAI-compatible and Gemini usage fields are parsed from JSON and SSE responses. Version and update controls are visible in settings. The standalone version uses SillyTavern's extension updater with its discovered folder and installation scope. Built-in installations show source-branch update instructions. On older standalone versions, use **Manage extensions → Update all**, then reload; individual update icons are hidden until an update check detects a newer commit.

## Implementations

The native version is a built-in extension with a read-only `CHAT_COMPLETION_REQUEST_READY` event emitted immediately before transport. Its event payload contains `{ type, body }`, where `body` is the serialized final request. The standalone version uses the same code and a narrowly scoped `fetch` observer on stock builds without that event.

## Validation

From the repository root, run `npm run lint`. From `tests`, run `npm run test:unit -- --runInBand` and `npx playwright test cache-keepalive.e2e.js`. The browser tests use mocked model responses and cover both the native event and stock fetch observer, including both generation event orders, full-prefix equality, six-refresh pause, manual resume, custom intervals, chat switching, earlier-message edits, quiet request exclusion and disposal.

### Timing experiment history

Version 1.0.9 temporarily added reply-completion timing to investigate cache lifetime. Version 1.0.10 removes that test switch and always measures intervals from request dispatch. The experiment remains in Git history.
