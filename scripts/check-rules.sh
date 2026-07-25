#!/usr/bin/env bash
# Regression battery for the safety spine, layer 1.
#
# The rule matcher has to be right in BOTH directions: a missed deli meat is a
# safety failure, and a hard-flagged Brussels sprout trains the user to ignore
# hard flags. Run this after touching lib/rules.ts.
#
#   ./scripts/check-rules.sh [base-url]     (default http://localhost:3000)

set -uo pipefail
BASE="${1:-http://localhost:3000}"
FAILED=0

check () { # name | ingredients | expected floor | [conditions]
  local q="$1" ing="$2" want="$3" cond="${4:-}" got floor
  got=$(curl -sS --max-time 15 --get "$BASE/api/scratch" \
        --data-urlencode "name=$q" \
        --data-urlencode "ingredients=$ing" \
        --data-urlencode "conditions=$cond" \
        | python3 -c "import sys,json; d=json.load(sys.stdin); print((d['ruleFloor'] or 'none'), '|', ','.join(m['hazardClass'] for m in d['matches']) or '-')" 2>/dev/null)
  floor="${got%% |*}"
  if [ "$floor" = "$want" ]; then
    printf "  ok    %-28s -> %s\n" "$q" "$got"
  else
    printf "  FAIL  %-28s -> %s   (wanted %s)\n" "$q" "$got" "$want"
    FAILED=$((FAILED + 1))
  fi
}

echo "SHOULD FIRE:"
check "Deli Turkey Breast"      "turkey,salt"             AVOID
check "Cold Cut Combo"          "ham,salami"              AVOID
check "Swordfish Steak"         "swordfish"               AVOID
check "Brie Cheese"             "milk,cultures"           AVOID
check "Chicken Liver Pate"      "chicken liver,butter"    AVOID
check "Red Wine"                "grapes,sulfites"         AVOID
check "Salmon Sashimi"          "raw salmon"              AVOID
check "Alfalfa Sprouts"         "alfalfa sprouts"         AVOID
check "Bean Sprout Salad"       "bean sprout"             AVOID
check "Caesar Dressing"         "raw egg,anchovy"         AVOID
check "Ground Coffee"           "coffee"                  CAUTION

echo "SHOULD NOT FIRE:"
check "Brussels Sprouts"        "brussels sprouts"        none
check "Brussel Sprout Chips"    "brussel sprout,oil"      none
check "Sugar Free Gum"          "sugar alcohol,sorbitol"  none
check "Decaf Coffee"            "decaffeinated coffee"    none
check "Atlantic Mackerel"       "atlantic mackerel"       none
check "Whole Milk"              "pasteurized milk"        none
check "Non-Alcoholic Beer"      "water,barley malt"       none
check "Roast Turkey Breast"     "turkey breast,water"     none
check "Cheddar Cheese"          "pasteurized milk,salt"   none

echo "CONDITION-GATED:"
check "Fruit Punch"             "corn syrup,water"        none
check "Fruit Punch"             "corn syrup,water"        CAUTION gestational-diabetes

echo
if [ "$FAILED" -eq 0 ]; then
  echo "all checks passed"
else
  echo "$FAILED check(s) FAILED"
  exit 1
fi
