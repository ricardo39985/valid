#!/usr/bin/env bash
set -euo pipefail

release=2026-10-21.0
bbox=-122.525,37.704,-122.349,37.837
root="$(cd "$(dirname "$0")/.." && pwd)"
raw="$(mktemp -d)"
trap 'rm -rf "$raw"' EXIT

for type in address place connector segment infrastructure land water land_use building; do
  overturemaps download --release "$release" --bbox="$bbox" --type "$type" \
    -f geojsonseq --output "$raw/$type.jsonl"
done
python "$root/scripts/prepare.py" "$raw" "$root/src/assets" "$release"
python "$root/scripts/prepare_basemap.py" "$raw" "$root/src/assets/basemap.pack"

python "$root/scripts/prepare_buildings.py" "$raw" "$root/src/assets/buildings"

mkdir -p "$raw/region"
for type in land land_use segment; do
  overturemaps download --release "$release" --bbox=-122.70,37.50,-122.10,38.00 --type "$type" \
    -f geojsonseq --output "$raw/region/$type.jsonl"
done
python "$root/scripts/prepare_region.py" "$raw/region" "$root/src/assets/region.pack"
