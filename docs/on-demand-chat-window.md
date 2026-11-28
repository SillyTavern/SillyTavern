# On-demand chat windows

Normal single-character and group chat opening requests only `/api/chats/page`.
The configured `chat_truncation` is the requested page size, capped at 500;
zero uses 100 in the indexed mode. A server body-byte budget can return fewer
messages. Opening never downloads an entire chat in the background.

The **Load complete chat for extension compatibility** checkbox in User Settings
under Chat/Message Handling explicitly selects the original full-file mode for
single and group chats. It saves the current window before reloading. Full mode
uses `/get` and the original full-array save path; disabling it returns to
on-demand pages. This is the fallback for extensions that require every message
in `context.chat`. It is off by default and persists as a user preference.

Show more messages and an upward wheel gesture at the top request the preceding
page. Show newer messages returns toward the latest page. Navigation saves edits
first, replaces the displayed page, and keeps its body/DOM window bounded.
Generation saves the current page, returns to recent history, and fetches older
pages only until its context token budget is covered. Message overhead and tool
invocations count toward this budget. Already-saved excess bodies are evicted on
the next generation. A tool-result group immediately before the context boundary
is retained with the assistant message that follows it.

`getContext().chat` remains a mutable array for extensions, containing the loaded
window. Its array indices, DOM `mesid` attributes, and message event arguments
are local to that window. `getContext().chatWindow` supplies `start`, `total`,
`revision`, `ids`, `hasEarlier`, `hasLater`, and the chat scope. Use
`getChatMessageRef(message)` for a stable `{id, revision, seq}` and
`readChatMessages(ids)` to read selected bodies. Never infer a deletion from a
message absent from this partial array. Prompt copies include `chatStoreRef`.

Visible message numbers, `/chat-jump`, `/messages`, and the `at=` parameters of
message role/name and manual-send commands use global sequence numbers. Commands
that target an unloaded message load one bounded page around it. `/messages`
reads only its explicitly requested range. The explicit `/delname` command walks
bounded pages and saves each page's removals. The chat range and displayed-message
macros report global sequence numbers. Third-party commands that directly index
`context.chat` continue to operate on local window indices and must use the
window offset or stable refs when addressing the complete chat.

Branch/checkpoint slash commands also accept global sequence numbers; their
button handlers and public JavaScript functions retain local array indices.
The explicit `/checkpoint-list` command streams bounded pages, retaining only
checkpoint IDs or links, and leaves the active UI window unchanged. Converting
an entire single-character chat into a group requires selecting complete-chat
compatibility mode first; the paged view cannot be submitted as a full group.

Edits, stored swipes, individual deletions, and inserted replies save through
`/api/chats/window`. The request retains the original stable IDs, allowing the
server to preserve every unloaded prefix/suffix. A conflicting revision fails;
there is no fallback to a full-array overwrite. The transient
`__chatStoreWindow` metadata marker also lets the server reject legacy saves of
partial arrays. The marker is removed before storing the JSONL header.

Older pages can select existing swipes. New swipe generation uses recent context;
overswiping an older page loops its stored alternatives. Deleting a message and
all following messages, or trimming the current chat, requires the latest page
so an unloaded continuation cannot be silently retained or removed. Single
message deletion on older pages preserves that continuation.

Branch and checkpoint creation use `/api/chats/fork` with the selected stable
message ID. The server copies its complete prefix; the browser never needs that
prefix's bodies. Selected-swipe branches pass just the selected final body.
The most recent summary before the last message is returned from the server's
summary index. The memory extension can restore a summary outside the body
window. New summarization reads forward from the message after that summary,
stopping at the source model's token budget. It saves the resulting summary on
the last stable message ID actually included, even if it lies outside the UI
window. A later summary continues from that point, preserving any unprocessed
gap before recent messages. The final chat message remains excluded. In paged
mode the default summary builder uses this bounded raw prompt as well.

Vector synchronization consumes explicit saved message IDs, including a summary
saved outside the current body window. It checks those IDs against chat metadata
and the selected vector profile's recorded revisions before reading only the
changed bodies. A successful vector write acknowledges that queued change;
failed writes retain it for retry. This in-memory queue is scoped to the chat.
After a browser restart, **Vectorize All** can repair any outstanding revisions:
it scans small metadata pages and skips already indexed message versions.

Local vector stores use DiskANN with float32 base vectors, float8 neighbor
compression, `search_l=512`, `insert_l=70`, and cosine distance. The storage worker
checks both the index DDL and settings version 2. An old graph is rebuilt once
from its saved vectors in an atomic transaction, preserving message IDs,
revisions, and bodies without another embedding request. This one-time local
upgrade can take minutes for a large store; other server work remains responsive.
It does not run `VACUUM` automatically, so an upgraded database can retain free
pages until offline maintenance. Fresh stores use the compressed graph directly.
Offline benchmark callers opt into upgrades explicitly; copied baseline indexes
remain unchanged when measured.

Itemized prompt caches retain their original global `mesId` values. Rendering,
generation, edits, deletion, message movement, and manual insertion translate
local window indices at the cache boundary. Insertion/deletion also shifts
cached prompt indices in the unloaded suffix; switching pages never truncates
the persistent prompt cache.

Chat switches abort pending reads and discard late responses by generation.
Queued saves retain their source scope, and stale queued saves cannot serialize
another chat's array. Edits made while a save is pending remain in memory for
the following save. Navigation detects edits during its read and leaves them in
place instead of replacing them with another page.

Run the frontend data-safety checks with:

```sh
node --test tests/chat-store.test.mjs
```
