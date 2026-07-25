#!/usr/bin/env bash
# Safety spine, layer 3. These analyses are hand-written, NOT model output —
# the point is to prove the spine rejects them before a user sees one.
#
# The case that matters most is FAKE-ID: a hallucinated source ID renders as a
# real-looking card on the analysis page, linking nowhere.
#
#   ./scripts/check-spine.sh [base-url]

set -uo pipefail
BASE="${1:-http://localhost:3000}"
FAILED=0

# Default item is deli turkey, so the rule floor is consider_avoiding.
expect () { # label | want_accepted | want_reason | json
  local label="$1" want_ok="$2" want_reason="$3" json="$4" out ok reason
  out=$(curl -sS --max-time 20 -X POST "$BASE/api/scratch" \
        -H 'content-type: application/json' -d "$json")
  ok=$(python3 -c "import sys,json; print(str(json.loads(sys.argv[1])['accepted']).lower())" "$out" 2>/dev/null)
  reason=$(python3 -c "import sys,json; print(json.loads(sys.argv[1])['reason'] or '-')" "$out" 2>/dev/null)

  if [ "$ok" = "$want_ok" ] && [ "$reason" = "$want_reason" ]; then
    printf "  ok    %-26s accepted=%-5s reason=%s\n" "$label" "$ok" "$reason"
  else
    printf "  FAIL  %-26s accepted=%-5s reason=%s   (wanted %s / %s)\n" \
      "$label" "$ok" "$reason" "$want_ok" "$want_reason"
    FAILED=$((FAILED + 1))
  fi
}

echo "REJECTIONS:"

# THE case: a plausible avoid verdict citing a source ID that does not exist.
expect "fake source id" false unknown-guideline-id '{"raw":{
  "status":"consider_avoiding","summary":"Avoid this one",
  "sourceIds":["FDA-LISTERIA-2099"]}}'

expect "one real one fake" false unknown-guideline-id '{"raw":{
  "status":"consider_avoiding","summary":"Avoid this one",
  "sourceIds":["FDA-LISTERIA-2022","ACOG-DELIMEAT-2024"]}}'

# Their original code kept the dead Health Canada ID; it must not resolve now.
expect "retired HC id" false unknown-guideline-id '{"raw":{
  "status":"consider_avoiding","summary":"Avoid","sourceIds":["HC-LISTERIA-01"]}}'

expect "downgrade under rule" false severity-downgrade '{"raw":{
  "status":"generally_suitable","summary":"Looks fine","sourceIds":["FDA-LISTERIA-2022"]}}'

expect "insufficient under rule" false severity-downgrade '{"raw":{
  "status":"insufficient_information","summary":"Not sure","sourceIds":[]}}'

expect "caution under avoid rule" false severity-downgrade '{"raw":{
  "status":"use_caution","summary":"Careful","sourceIds":["FDA-LISTERIA-2022"]}}'

expect "uncited conclusion" false uncited-conclusion '{"raw":{
  "status":"consider_avoiding","summary":"Trust me","sourceIds":[]}}'

echo "ACCEPTANCES:"

expect "valid avoid" true - '{"raw":{
  "status":"consider_avoiding","summary":"Avoid cold deli meat",
  "sourceIds":["FDA-DELI-RTE-2022","FDA-LISTERIA-2022"]}}'

# No rule floor on oats, and generally_suitable needs no citation.
expect "clean suitable" true - '{"raw":{
  "status":"generally_suitable","summary":"Nothing to avoid","sourceIds":[]},
  "item":{"name":"Rolled Oats","ingredients":"whole grain oats"}}'

# Raising above the floor is explicitly allowed.
expect "raise above floor" true - '{"raw":{
  "status":"consider_avoiding","summary":"Avoid","sourceIds":["ACOG-CAFFEINE-2010"]},
  "item":{"name":"Iced Coffee","ingredients":"coffee, milk"}}'

# The two sources merged in from BumpSafe must resolve.
expect "merged CDC source" true - '{"raw":{
  "status":"consider_avoiding","summary":"Avoid","sourceIds":["CDC-SAFERFOOD-2025"]}}'

expect "merged ACOG source" true - '{"raw":{
  "status":"generally_suitable","summary":"Fine","sourceIds":["ACOG-NUTRITION-01"]},
  "item":{"name":"Rolled Oats","ingredients":"whole grain oats"}}'

echo
if [ "$FAILED" -eq 0 ]; then
  echo "all checks passed"
else
  echo "$FAILED check(s) FAILED"
  exit 1
fi
