#!/usr/bin/env bash
# Every guideline ID referenced anywhere in src/ must exist in the corpus, and
# every corpus URL must be well-formed.
#
# This exists because replacing the corpus silently orphaned five citations in
# the seeded demo data: each card still rendered, but claimed no source
# supported it. A dead citation is worse than no citation, because the UI shows
# a source card that links nowhere.
#
#   ./scripts/check-citations.sh

set -uo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import json, re, sys, pathlib

corpus = {g["id"]: g for g in json.load(open("src/data/guidance.json"))}
failed = 0

print(f"corpus: {len(corpus)} sources")

# 1. Structural checks on the corpus itself.
for gid, g in corpus.items():
    for field in ("title", "organization", "url", "topic", "hazardClass", "summary"):
        if not g.get(field):
            print(f"  FAIL  {gid} missing {field}"); failed += 1
    if not str(g.get("url", "")).startswith("https://"):
        print(f"  FAIL  {gid} url is not https"); failed += 1
    if len(g.get("summary", "").split()) > 60:
        print(f"  FAIL  {gid} summary over 60 words"); failed += 1
    if not g.get("applicableRisks"):
        print(f"  FAIL  {gid} has no retrieval keywords"); failed += 1

# 2. Every ID referenced in source must resolve.
pattern = re.compile(r'"((?:FDA|NHS|ACOG|CDC|HC|WHO)-[A-Z0-9-]+)"')
referenced = {}
for path in pathlib.Path("src").rglob("*"):
    if path.suffix not in {".ts", ".tsx", ".json"} or path.name == "guidance.json":
        continue
    for gid in pattern.findall(path.read_text()):
        referenced.setdefault(gid, set()).add(str(path))

for gid, files in sorted(referenced.items()):
    if gid in corpus:
        print(f"  ok    {gid} referenced in {len(files)} file(s)")
    else:
        print(f"  FAIL  {gid} referenced but NOT in corpus -> {', '.join(sorted(files))}")
        failed += 1

print()
if failed:
    print(f"{failed} problem(s)")
    sys.exit(1)
print("all citations resolve")
PY
