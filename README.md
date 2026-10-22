# SillyTavern

LLM Frontend for Power Users

## Improvements in this fork

### Use new models without an extension

Open **API Connections**, choose a Chat Completion source, enter its exact **Model ID**, and click **Use model** (or press Enter). Models do not have to appear in the built-in dropdown or the provider's model catalog. For example, a new Vertex model can be selected as soon as your endpoint supports its ID.

The selection uses the normal model setting, so requests, presets, connection profiles, and model-dependent settings stay in sync. Custom IDs are remembered separately for each source and survive page reloads and catalog refreshes. You can still select a built-in model from the dropdown. Model capabilities and context limits continue to use the existing provider settings; entering a new ID does not discover its capabilities automatically.

The same editor is available for the Text Completion backends Mancer, Together AI, Infermatic AI, DreamGen, OpenRouter, vLLM, Aphrodite, Featherless, and llama.cpp. Generic and Text Generation WebUI retain their existing free-text model inputs. Backends that manage loaded/downloaded models retain their own controls.

Scripts can use `/model exact=true your-model-id` for an exact selection; the default `/model` command keeps its existing fuzzy search behavior. Connection profiles restore model IDs exactly.

### Performance and reliability

- Reopening unchanged chat lists reuses bounded, per-file summaries instead of reading every JSONL file again. File identity, size, and modification/change times are checked on every lookup; content reads are limited to eight at a time.
- Chat history search cancels obsolete requests and ignores late responses when the query, character, or view changes. Lists are inserted in one batch, and a disconnected search stops scanning additional files on the server.
- Concurrent template renders share one download and compilation while preserving separate data, sanitization, and localization for each render.
- Streaming reuses unchanged answer Markdown during reasoning/tool updates, while still running formatter hooks, regexes, and sanitization. Final rendering refreshes the conversion.
- Character.AI multi-history imports work correctly, and imported chats do not overwrite existing files with colliding names.
- Connection checks ignore obsolete responses after switching sources or reconnecting, preserving the current model and connection status.
- Reinitializing reasoning controls or clicking Done repeatedly no longer overwrites reasoning text with `undefined` or saves the same edit twice.

### Local verification

Install application dependencies with `npm ci` and test dependencies with `npm --prefix tests ci`. Run `npm run lint`, `npm --prefix tests run test:unit`, and `npm --prefix tests run test:native` for the static and server checks.

Browser tests require a running instance and Chromium (`cd tests && npx playwright install chromium`). Use an isolated data directory when testing, for example:

```sh
node server.js --port 18347 --dataRoot /tmp/sillytavern-tests --browserLaunchEnabled false
```

In another terminal, run `ST_BASE_URL=http://127.0.0.1:18347 npm --prefix tests run test:e2e -- --workers=1`. The existing native browser checks also use `ST_BASE_URL` when it is set.

Compare chat-summary reads with a locally available Git revision:

```sh
node tests/bench-chat-info.mjs --baseline b34249a6c --rounds 5 32 1000
```

These are also the defaults. The benchmark alternates version order, waits for every file stream to close, reports each run plus medians and ranges, and removes its temporary chats. It loads the baseline chat endpoint with the working tree's supporting modules and dependencies. Use `--help` for the options.

In the final five-round run over 32 synthetic chats containing 1,000 messages each (64.18 MiB), median repeated-read time fell from **141.10 ms to 1.00 ms**, and repeated content reads fell from 64.18 MiB to zero. First-scan time was essentially unchanged (141.73 ms versus 142.52 ms), while stream concurrency fell from 32 to 8. The system disk cache was **not cleared**, and timings fluctuate with machine load; these results describe this workload, not total application speed.

## Resources

- GitHub: <https://github.com/SillyTavern/SillyTavern>
- Docs: <https://docs.sillytavern.app/>
- Discord: <https://discord.gg/sillytavern>
- Reddit: <https://reddit.com/r/SillyTavernAI>

## License

AGPL-3.0
