#!/usr/bin/env bash
# Safety spine, layer 3. These responses are hand-written, NOT model output —
# the point is to prove the validator rejects them before a user sees one.
#
# The case that matters most is FAKE-ID: a hallucinated guideline reference
# looks exactly like a real one to someone glancing at a receipt.
#
#   ./scripts/check-validator.sh [base-url]

set -uo pipefail
BASE="${1:-http://localhost:3000}"
FAILED=0

# Default item is deli turkey, so the rule floor is AVOID.
expect () { # label | want_accepted(true/false) | want_reason | json
  local label="$1" want_ok="$2" want_reason="$3" json="$4" out ok reason
  out=$(curl -sS --max-time 15 -X POST "$BASE/api/scratch" \
        -H 'content-type: application/json' -d "$json")
  ok=$(python3 -c "import sys,json; print(str(json.loads(sys.argv[1])['accepted']).lower())" "$out" 2>/dev/null)
  reason=$(python3 -c "import sys,json; print(json.loads(sys.argv[1])['reason'] or '-')" "$out" 2>/dev/null)

  if [ "$ok" = "$want_ok" ] && [ "$reason" = "$want_reason" ]; then
    printf "  ok    %-22s accepted=%-5s reason=%s\n" "$label" "$ok" "$reason"
  else
    printf "  FAIL  %-22s accepted=%-5s reason=%s   (wanted %s / %s)\n" \
      "$label" "$ok" "$reason" "$want_ok" "$want_reason"
    FAILED=$((FAILED + 1))
  fi
}

echo "REJECTIONS:"

# THE stop condition: plausible AVOID verdict citing an ID that does not exist.
expect "fake guideline id" false unknown-guideline-id '{"raw":{
  "severity":"AVOID","headline":"Avoid this one",
  "reasoning":"Deli meat carries listeria risk during pregnancy.",
  "flags":[{"ingredient":"deli turkey","severity":"AVOID",
            "plainReason":"Listeria risk unless heated until steaming.",
            "guidelineIds":["FDA-LISTERIA-2099"]}],
  "alternatives":[],"modelConfidence":0.95}}'

# Real ID mixed with a fake one — the fake must still sink it.
expect "one real one fake" false unknown-guideline-id '{"raw":{
  "severity":"AVOID","headline":"Avoid this one","reasoning":"Listeria risk.",
  "flags":[{"ingredient":"deli turkey","severity":"AVOID","plainReason":"Listeria.",
            "guidelineIds":["FDA-LISTERIA-2022","ACOG-DELIMEAT-2024"]}],
  "alternatives":[],"modelConfidence":0.9}}'

expect "downgrade under rule" false severity-downgrade '{"raw":{
  "severity":"OK","headline":"Looks fine","reasoning":"Nothing concerning here.",
  "flags":[],"alternatives":[],"modelConfidence":0.9}}'

expect "unknown under rule" false severity-downgrade '{"raw":{
  "severity":"UNKNOWN","headline":"Not sure about this","reasoning":"No guidance found.",
  "flags":[],"alternatives":[],"modelConfidence":0.4}}'

expect "flag with no citation" false uncited-flag '{"raw":{
  "severity":"AVOID","headline":"Avoid this one","reasoning":"Listeria risk.",
  "flags":[{"ingredient":"deli turkey","severity":"AVOID","plainReason":"Listeria.",
            "guidelineIds":[]}],
  "alternatives":[],"modelConfidence":0.9}}'

expect "avoid with no flags" false uncited-flag '{"raw":{
  "severity":"AVOID","headline":"Avoid this one","reasoning":"Trust me on this one.",
  "flags":[],"alternatives":[],"modelConfidence":0.99}}'

expect "invented severity" false bad-severity '{"raw":{
  "severity":"DANGER","headline":"Avoid this one","reasoning":"Listeria risk.",
  "flags":[],"alternatives":[],"modelConfidence":0.9}}'

expect "not an object" false bad-schema '{"raw":"AVOID: deli meat is unsafe"}'

expect "missing reasoning" false bad-schema '{"raw":{
  "severity":"AVOID","headline":"Avoid this one",
  "flags":[{"ingredient":"deli turkey","severity":"AVOID","plainReason":"Listeria.",
            "guidelineIds":["FDA-LISTERIA-2022"]}],
  "alternatives":[],"modelConfidence":0.9}}'

echo "ACCEPTANCES:"

expect "valid avoid" true - '{"raw":{
  "severity":"AVOID","headline":"Avoid this one",
  "reasoning":"Ready-to-eat deli meat can carry listeria. Heating it until steaming makes it safe.",
  "flags":[{"ingredient":"deli turkey","severity":"AVOID",
            "plainReason":"Listeria risk unless heated until steaming.",
            "guidelineIds":["FDA-DELI-RTE-2022","FDA-LISTERIA-2022"]}],
  "alternatives":[{"name":"Rotisserie chicken","why":"same savory, served hot"}],
  "modelConfidence":0.93}}'

# Raising severity above the floor is explicitly allowed.
expect "raise above floor" true - '{"raw":{
  "severity":"AVOID","headline":"Avoid this one","reasoning":"Caffeine plus listeria risk here.",
  "flags":[{"ingredient":"deli turkey","severity":"AVOID","plainReason":"Listeria risk.",
            "guidelineIds":["FDA-LISTERIA-2022"]}],
  "alternatives":[],"modelConfidence":0.9},
  "item":{"name":"Iced Coffee","ingredients":["coffee","milk"],"nutrition":{}}}'

# No rule floor, nothing cited, model says OK -> fine, nothing to downgrade.
expect "clean ok verdict" true - '{"raw":{
  "severity":"OK","headline":"Nothing here to avoid",
  "reasoning":"No pregnancy hazard in this ingredient list.",
  "flags":[],"alternatives":[],"modelConfidence":0.9},
  "item":{"name":"Rolled Oats","ingredients":["whole grain oats"],"nutrition":{}}}'

echo
if [ "$FAILED" -eq 0 ]; then
  echo "all checks passed"
else
  echo "$FAILED check(s) FAILED"
  exit 1
fi
