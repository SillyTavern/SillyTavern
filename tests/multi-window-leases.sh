#!/bin/bash
# End-to-end lifecycle test for multi-window RW leases (Stage 1).
set -u
BASE=http://127.0.0.1:8020
DIR=$(dirname "$0")
JAR=$DIR/jar.txt
CSRF=$(curl -s -c "$JAR" $BASE/csrf-token | sed 's/.*"token":"\([^"]*\)".*/\1/')
H_COMMON=(-s -b "$JAR" -H "X-CSRF-Token: $CSRF" -H "Content-Type: application/json")
A=(-H "X-Window-Id: window-A" -H "X-Window-Epoch: 1")
B=(-H "X-Window-Id: window-B" -H "X-Window-Epoch: 1")
KEY='chat/test.png/testchat'
SAVE_BODY='{"avatar_url":"test.png","file_name":"testchat","chat":[{"user_name":"u","character_name":"test","chat_metadata":{}},{"name":"test","mes":"hello"}],"force":false}'

PASS=0; FAIL=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "pass: $1";
  else FAIL=$((FAIL+1)); echo "FAIL: $1 — expected [$2] got [$3]"; fi
}
post() { curl "${H_COMMON[@]}" "$@" ; }
code() { curl "${H_COMMON[@]}" -o /dev/null -w '%{http_code}' "$@" ; }

# 1. Register both windows
check "A registers" '{"ok":true,"poisonReason":null,"ephemeralProfiles":[]}' \
  "$(post "${A[@]}" -d '{}' $BASE/api/sessions/register)"
check "B registers" '{"ok":true,"poisonReason":null,"ephemeralProfiles":[]}' \
  "$(post "${B[@]}" -d '{}' $BASE/api/sessions/register)"

# 2. Save without any lease is rejected
check "B save without lease -> 409" "409" "$(code "${B[@]}" -d "$SAVE_BODY" $BASE/api/chats/save)"

# 3. A acquires write lease and saves
check "A acquires write" '{"ok":true,"revision":1}' \
  "$(post "${A[@]}" -d "{\"key\":\"$KEY\",\"mode\":\"write\"}" $BASE/api/sessions/lease/acquire)"
check "A save with lease -> 200" "200" "$(code "${A[@]}" -d "$SAVE_BODY" $BASE/api/chats/save)"

# 4. B cannot get write while A holds it
check "B write blocked by writer A" '{"ok":false,"status":"conflict","writer":true,"holders":1}' \
  "$(post "${B[@]}" -d "{\"key\":\"$KEY\",\"mode\":\"write\"}" $BASE/api/sessions/lease/acquire)"

# 5. B reads; revision bump visible on heartbeat (A's save bumped rev to 2)
check "B acquires read" '{"ok":true,"revision":2}' \
  "$(post "${B[@]}" -d "{\"key\":\"$KEY\",\"mode\":\"read\"}" $BASE/api/sessions/lease/acquire)"
check "B heartbeat sees stale rev" '{"status":"live","revisionBumps":[{"key":"chat/test.png/testchat","revision":2}],"drainRequests":[]}' \
  "$(post "${B[@]}" -d "{\"heldLeases\":[{\"key\":\"$KEY\",\"revision\":1}]}" $BASE/api/sessions/heartbeat)"

# 6. B force-writes -> A poisoned
check "B force-write poisons 1" '{"ok":true,"revision":2,"poisonedCount":1}' \
  "$(post "${B[@]}" -d "{\"key\":\"$KEY\"}" $BASE/api/sessions/lease/force-write)"

# 7. A is dead to the server: heartbeat and save both 410
check "A heartbeat -> 410" "410" "$(code "${A[@]}" -d '{}' $BASE/api/sessions/heartbeat)"
check "A save -> 410 (poison gate)" "410" "$(code "${A[@]}" -d "$SAVE_BODY" $BASE/api/chats/save)"
check "A unrelated endpoint -> 410" "410" "$(code "${A[@]}" -X POST -d '{}' $BASE/api/settings/get)"

# 8. A same-epoch re-register rejected; epoch+1 resurrects with reason
check "A re-register same epoch -> 410" "410" "$(code "${A[@]}" -d '{}' $BASE/api/sessions/register)"
REBIRTH=$(post -H "X-Window-Id: window-A" -H "X-Window-Epoch: 2" -d '{}' $BASE/api/sessions/register)
echo "$REBIRTH" | grep -q '"ok":true' && echo "$REBIRTH" | grep -q '"reason":"force-write"' \
  && check "A rebirth with poison reason" ok ok \
  || check "A rebirth with poison reason" ok "$REBIRTH"

# 9. B now saves fine (it holds write intent from force-write)
check "B save with forced lease -> 200" "200" "$(code "${B[@]}" -d "$SAVE_BODY" $BASE/api/chats/save)"

# 10. Drain protocol: A2 takes read, B releases write then A2... (B wants write while A2 reads)
A2=(-H "X-Window-Id: window-A" -H "X-Window-Epoch: 2")
post "${A2[@]}" -d "{\"key\":\"$KEY\",\"mode\":\"read\"}" $BASE/api/sessions/lease/acquire > /dev/null
post "${B[@]}"  -d "{\"key\":\"$KEY\"}" $BASE/api/sessions/lease/release > /dev/null
check "B write drains against reader A2" '{"ok":false,"status":"draining","holders":1}' \
  "$(post "${B[@]}" -d "{\"key\":\"$KEY\",\"mode\":\"write\"}" $BASE/api/sessions/lease/acquire)"
check "A2 heartbeat receives drain request" '{"status":"live","revisionBumps":[{"key":"chat/test.png/testchat","revision":3}],"drainRequests":["chat/test.png/testchat"]}' \
  "$(post "${A2[@]}" -d "{\"heldLeases\":[{\"key\":\"$KEY\",\"revision\":1}]}" $BASE/api/sessions/heartbeat)"
post "${A2[@]}" -d "{\"key\":\"$KEY\"}" $BASE/api/sessions/lease/release > /dev/null
check "B write after drain" '{"ok":true,"revision":3}' \
  "$(post "${B[@]}" -d "{\"key\":\"$KEY\",\"mode\":\"write\"}" $BASE/api/sessions/lease/acquire)"

# --- Connection profiles (Stage 2 server) ---
C=(-H "X-Window-Id: window-C" -H "X-Window-Epoch: 1")
P1="test-profile-1"
PROFILE_BODY="{\"profile\":{\"id\":\"$P1\",\"name\":\"Test Profile\",\"settings\":{\"main_api\":\"openai\",\"temp\":0.7}}}"

post "${C[@]}" -d '{}' $BASE/api/sessions/register > /dev/null
check "C creates new profile (no lease needed)" '{"ok":true,"revision":2}' \
  "$(post "${C[@]}" -d "$PROFILE_BODY" $BASE/api/connection-profiles/save)"
check "C re-save existing without lease -> 409" "409" \
  "$(code "${C[@]}" -d "$PROFILE_BODY" $BASE/api/connection-profiles/save)"
post "${C[@]}" -d "{\"key\":\"profile/$P1\",\"mode\":\"write\"}" $BASE/api/sessions/lease/acquire > /dev/null
check "C re-save with lease" '{"ok":true,"revision":3}' \
  "$(post "${C[@]}" -d "$PROFILE_BODY" $BASE/api/connection-profiles/save)"

LIST=$(post "${C[@]}" -d '{}' $BASE/api/connection-profiles/list)
echo "$LIST" | grep -q "\"id\":\"$P1\"" && check "list contains profile" ok ok || check "list contains profile" ok "$LIST"
post "${C[@]}" -d "{\"id\":\"$P1\"}" $BASE/api/connection-profiles/set-default > /dev/null
LIST=$(post "${C[@]}" -d '{}' $BASE/api/connection-profiles/list)
echo "$LIST" | grep -q "\"defaultId\":\"$P1\"" && check "set-default reflected" ok ok || check "set-default reflected" ok "$LIST"

# Ephemeral profile: survives re-register (same windowId, new epoch)
EPH="{\"profile\":{\"id\":\"eph-1\",\"name\":\"Default (edited, window C)\",\"parentId\":\"$P1\",\"settings\":{\"temp\":1.2}}}"
check "C upserts ephemeral" '{"ok":true}' \
  "$(post "${C[@]}" -d "$EPH" $BASE/api/connection-profiles/ephemeral)"
C2=(-H "X-Window-Id: window-C" -H "X-Window-Epoch: 2")
REG=$(post "${C2[@]}" -d '{}' $BASE/api/sessions/register)
echo "$REG" | grep -q '"id":"eph-1"' && check "re-register returns ephemeral" ok ok || check "re-register returns ephemeral" ok "$REG"

# Saving the ephemeral persistently clears it from the session
EPH_SAVE="{\"profile\":{\"id\":\"eph-1\",\"name\":\"Promoted\",\"settings\":{\"temp\":1.2}}}"
post "${C2[@]}" -d "$EPH_SAVE" $BASE/api/connection-profiles/save > /dev/null
C3=(-H "X-Window-Id: window-C" -H "X-Window-Epoch: 3")
REG=$(post "${C3[@]}" -d '{}' $BASE/api/sessions/register)
echo "$REG" | grep -q '"ephemeralProfiles":\[\]' && check "saved ephemeral cleared from session" ok ok || check "saved ephemeral cleared from session" ok "$REG"

# Re-registration drops all previous leases; deleting needs a fresh one
check "C delete after re-register (leases dropped) -> 409" "409" \
  "$(code "${C3[@]}" -d "{\"id\":\"$P1\"}" $BASE/api/connection-profiles/delete)"
post "${C3[@]}" -d "{\"key\":\"profile/$P1\",\"mode\":\"write\"}" $BASE/api/sessions/lease/acquire > /dev/null
check "C deletes profile with lease" '{"ok":true}' \
  "$(post "${C3[@]}" -d "{\"id\":\"$P1\"}" $BASE/api/connection-profiles/delete)"
LIST=$(post "${C3[@]}" -d '{}' $BASE/api/connection-profiles/list)
echo "$LIST" | grep -q "\"id\":\"$P1\"" && check "deleted profile gone from list" ok "$LIST" || check "deleted profile gone from list" ok ok

# --- Connection presets (peer leased entities) ---
PRESET_BODY='{"preset":{"id":"test-preset-1","name":"Test Preset","settings":{"temp":0.9}}}'
check "C creates preset (no lease)" '{"ok":true,"revision":2}' \
  "$(post "${C3[@]}" -d "$PRESET_BODY" $BASE/api/connection-presets/save)"
check "C re-save preset without lease -> 409" "409" \
  "$(code "${C3[@]}" -d "$PRESET_BODY" $BASE/api/connection-presets/save)"
post "${C3[@]}" -d '{"key":"preset/test-preset-1","mode":"write"}' $BASE/api/sessions/lease/acquire > /dev/null
check "C re-save preset with lease" '{"ok":true,"revision":3}' \
  "$(post "${C3[@]}" -d "$PRESET_BODY" $BASE/api/connection-presets/save)"
check "C deletes preset" '{"ok":true}' \
  "$(post "${C3[@]}" -d '{"id":"test-preset-1"}' $BASE/api/connection-presets/delete)"

# Cleanup: delete the promoted ephemeral so re-runs start from a clean data dir
post "${C3[@]}" -d '{"key":"profile/eph-1","mode":"write"}' $BASE/api/sessions/lease/acquire > /dev/null
check "cleanup: promoted ephemeral deleted" '{"ok":true}' \
  "$(post "${C3[@]}" -d '{"id":"eph-1"}' $BASE/api/connection-profiles/delete)"

# --- Stage 3: characters, themes, Quick Reply sets (transient write leases) ---
D=(-H "X-Window-Id: window-D" -H "X-Window-Epoch: 1")
post "${D[@]}" -d '{}' $BASE/api/sessions/register > /dev/null

# Character: lifecycle on a throwaway copy of the stock card
CHAR_DIR=$DIR/../data/default-user/characters
cp "$CHAR_DIR/default_Seraphina.png" "$CHAR_DIR/mw-test-char.png"
EDIT_BODY='{"avatar_url":"mw-test-char.png","ch_name":"Seraphina","field":"personality","value":"lease test"}'
check "D edit character without lease -> 409" "409" \
  "$(code "${D[@]}" -d "$EDIT_BODY" $BASE/api/characters/edit-attribute)"
post "${D[@]}" -d '{"key":"character/mw-test-char.png","mode":"write"}' $BASE/api/sessions/lease/acquire > /dev/null
check "D edit character with lease -> 200" "200" \
  "$(code "${D[@]}" -d "$EDIT_BODY" $BASE/api/characters/edit-attribute)"
E=(-H "X-Window-Id: window-E" -H "X-Window-Epoch: 1")
post "${E[@]}" -d '{}' $BASE/api/sessions/register > /dev/null
check "E edit same character (no lease) -> 409" "409" \
  "$(code "${E[@]}" -d "$EDIT_BODY" $BASE/api/characters/edit-attribute)"
check "D delete character with lease -> 200" "200" \
  "$(code "${D[@]}" -d '{"avatar_url":"mw-test-char.png","delete_chats":false}' $BASE/api/characters/delete)"
post "${D[@]}" -d '{"key":"character/mw-test-char.png"}' $BASE/api/sessions/lease/release > /dev/null

# Theme: create exempt, overwrite/delete gated
THEME_BODY='{"name":"MW Test Theme","main_text_color":"#fff"}'
check "D create theme (no lease) -> 200" "200" "$(code "${D[@]}" -d "$THEME_BODY" $BASE/api/themes/save)"
check "D re-save theme without lease -> 409" "409" "$(code "${D[@]}" -d "$THEME_BODY" $BASE/api/themes/save)"
post "${D[@]}" -d '{"key":"theme/MW Test Theme","mode":"write"}' $BASE/api/sessions/lease/acquire > /dev/null
check "D re-save theme with lease -> 200" "200" "$(code "${D[@]}" -d "$THEME_BODY" $BASE/api/themes/save)"
check "D delete theme with lease -> 200" "200" "$(code "${D[@]}" -d '{"name":"MW Test Theme"}' $BASE/api/themes/delete)"

# Quick Reply set: same semantics
QR_BODY='{"name":"MWTestQR","qrList":[]}'
check "D create QR set (no lease) -> 200" "200" "$(code "${D[@]}" -d "$QR_BODY" $BASE/api/quick-replies/save)"
check "D re-save QR set without lease -> 409" "409" "$(code "${D[@]}" -d "$QR_BODY" $BASE/api/quick-replies/save)"
post "${D[@]}" -d '{"key":"qr/MWTestQR","mode":"write"}' $BASE/api/sessions/lease/acquire > /dev/null
check "D re-save QR set with lease -> 200" "200" "$(code "${D[@]}" -d "$QR_BODY" $BASE/api/quick-replies/save)"
check "D delete QR set with lease -> 200" "200" "$(code "${D[@]}" -d '{"name":"MWTestQR"}' $BASE/api/quick-replies/delete)"

echo "----"
echo "passed: $PASS failed: $FAIL"
exit $FAIL
