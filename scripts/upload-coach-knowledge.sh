#!/usr/bin/env bash
# Uploads coach-knowledge/ to the site's private "coach-knowledge" blob store.
# Run from the repo root after `netlify login` and `netlify link`. Re-run whenever you change a file.
#   coach-knowledge/instructions.md   project instructions
#   coach-knowledge/core/*.txt|.md    short files, included in every message
#   coach-knowledge/library/*.txt|.md textbooks, searched per message
set -euo pipefail
cd "$(dirname "$0")/.."
DIR=coach-knowledge

mapfile -t files < <(find "$DIR" -type f \( -name '*.md' -o -name '*.txt' \) | sort)
[ ${#files[@]} -eq 0 ] && { echo "No .md or .txt files in $DIR/"; exit 1; }

# Remove blobs for files you've deleted locally.
netlify blobs:list coach-knowledge --json 2>/dev/null \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{(JSON.parse(d).blobs||[]).forEach(b=>console.log(b.key))}catch{}})' \
  | while read -r key; do
      [ -f "$DIR/$key" ] || { echo "Removing $key"; netlify blobs:delete coach-knowledge "$key" --force; }
    done

for f in "${files[@]}"; do
  key="${f#$DIR/}"
  echo "Uploading $key"
  netlify blobs:set coach-knowledge "$key" --input "$f" --force
done

prompt=$(cat "$DIR"/instructions.md "$DIR"/core/* 2>/dev/null | wc -c)
library=$(cat "$DIR"/library/* 2>/dev/null | wc -c)
echo "Done: ${#files[@]} files. Every-message prompt about $((prompt / 4)) tokens; searchable library about $((library / 4)) tokens."
[ "$prompt" -gt 200000 ] && echo "Warning: instructions + core is large. Move long files from core/ to library/."
exit 0
