#!/usr/bin/env bash
# update every skill in ~/skills from its upstream source.
#
#   ./update.sh              pull every source, sync the copied-in skills
#   ./update.sh --dry-run    show what would change, write nothing
#   ./update.sh --prune      also delete local files upstream removed
#   ./update.sh --list-new   upstream skills you do not have installed
#   ./update.sh --repo NAME  only touch one source, NAME matches the header
#
# reads sources.tsv, written by ~/Documents/Projects/skills/gen-sources.py.
#
# upstream is the source of truth for third-party skills. a synced directory is a
# mirror, so local edits inside one get overwritten. run --dry-run first if you
# have ever edited a skill you do not own.
set -uo pipefail

SK="${SKILLS_DIR:-$HOME/skills}"
REPOS_DIR="$SK/.repos"
REG="$SK/sources.tsv"
NPM_PREFIX="$HOME/.pi/agent/npm"

DRY=0; PRUNE=0; LIST_NEW=0; ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY=1 ;;
    --prune)    PRUNE=1 ;;
    --list-new) LIST_NEW=1 ;;
    --repo)     ONLY="${2:-}"; shift ;;
    -h|--help)  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

if [[ ! -f "$REG" ]]; then
  echo "no registry at $REG" >&2
  echo "regenerate it: python3 ~/Documents/Projects/skills/gen-sources.py" >&2
  exit 1
fi

# short name for a source, used in the header and by --repo
display() {
  case "$1" in
    https://github.com/M1noa/skills) echo "m1noa-skills" ;;
    *) basename "$1" .git | tr '[:upper:]' '[:lower:]' ;;
  esac
}

# local working tree for a source: a cache clone under .repos, except the two we
# already keep somewhere else
working_tree() {
  case "$1" in
    https://github.com/M1noa/skills) echo "$HOME/Documents/Projects/skills" ;;
    https://github.com/thelegendtubaguy/pi-ponytail) echo "$NPM_PREFIX/node_modules/pi-ponytail" ;;
    *) echo "$REPOS_DIR/$(display "$1")" ;;
  esac
}

# registry rows for one source, as mode<TAB>name<TAB>upstream dir
rows() { awk -F'\t' -v r="$1" '$2==r {print $1"\t"$3"\t"$4}' "$REG"; }
sources() { awk -F'\t' '!/^#/ && NF>1 {print $2}' "$REG" | sort -u; }
names_of() { awk -F'\t' -v r="$1" '$2==r {print $3}' "$REG" | sort -u; }

fetch() {  # url -> the clone at working_tree(url), pulled up to date
  local url="$1" dir; dir="$(working_tree "$url")"

  if [[ ! -d "$dir/.git" ]]; then
    echo "  clone -> ${dir/#$HOME/~}"
    [[ $DRY == 1 ]] && return 0
    if git clone --filter=blob:none --quiet "$url" "$dir"; then
      echo "  at $(git -C "$dir" rev-parse --short HEAD)"
    else
      echo "  ! clone failed"
      return 1
    fi
    return 0
  fi

  local head there count
  head="$(git -C "$dir" rev-parse HEAD)"
  # some clones have no tracking branch configured, so resolve the remote head by
  # hand rather than relying on @{u}
  local remote_head
  remote_head="$(git -C "$dir" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null)"
  remote_head="${remote_head:-origin/$(git -C "$dir" rev-parse --abbrev-ref HEAD)}"

  if [[ $DRY == 1 ]]; then
    git -C "$dir" fetch --quiet origin 2>/dev/null
    there="$(git -C "$dir" rev-parse "$remote_head" 2>/dev/null || echo "$head")"
  else
    git -C "$dir" fetch --quiet origin 2>/dev/null
    if ! git -C "$dir" merge --ff-only --quiet "$remote_head" 2>/dev/null; then
      echo "  ! cannot fast-forward onto $remote_head, dirty or diverged tree"
      return 1
    fi
    # report against the remote head, not the (now moved) local HEAD, so a real
    # run and --dry-run say the same thing
    there="$(git -C "$dir" rev-parse "$remote_head")"
  fi

  count="$(git -C "$dir" rev-list --count "$head..$there" 2>/dev/null || echo '?')"
  if [[ "$head" == "$there" ]]; then
    echo "  current at ${head:0:7}"
  elif [[ "$count" == "0" ]]; then
    # a tree we author ourselves, ahead of its own remote because we never push
    echo "  ahead of $remote_head by $(git -C "$dir" rev-list --count "$there..$head" 2>/dev/null) commit(s), nothing to pull"
  else
    echo "  +$count commit(s) ${head:0:7} -> ${there:0:7}  $(git -C "$dir" log -1 --format=%s "$there" 2>/dev/null)"
  fi
}

sync_skill() {  # url name upstream-dir
  local url="$1" name="$2" rel="$3"
  local root; root="$(working_tree "$url")"
  local src="$root/$rel" dst="$SK/$name"

  if [[ ! -d "$root/.git" ]]; then
    echo "  $name <- $rel (pending clone)"
    return 0
  fi
  if [[ ! -d "$src" ]]; then
    echo "  ! $name: $rel missing upstream, path moved? add it to MOVED in gen-sources.py"
    return 1
  fi
  if [[ -e "$dst" && ! -d "$dst" ]]; then
    echo "  ! $name: local path is not a directory"
    return 1
  fi

  # --checksum so a fresh clone with matching content is not reported as changed
  # just because the mtimes differ
  local flags=(-a --checksum --exclude '.git')
  [[ $PRUNE == 1 ]] && flags+=(--delete)
  [[ $DRY == 1 ]] && flags+=(-n)

  mkdir -p "$dst"
  local log n
  log="$(rsync -i "${flags[@]}" "$src/" "$dst/" 2>&1)"
  n="$(printf '%s\n' "$log" | grep -cE '^[<>ch*]' || true)"
  if [[ "${n:-0}" -gt 0 ]]; then
    echo "  $name: $n change(s)"
    if [[ $DRY == 1 ]]; then
      printf '%s\n' "$log" | grep -E '^[<>ch*]' | head -8 | sed 's/^/      /'
    fi
  fi
}

# upstream skill dirs sitting under the parents we already track from
report_new() {  # url
  local url="$1" dir; dir="$(working_tree "$url")"
  [[ -d "$dir" ]] || return 0

  local have parents parent d leaf extra=""
  have="$(names_of "$url")"
  parents="$(rows "$url" | awk -F'\t' '{n=split($3,a,"/"); if(n>1){p=""; for(i=1;i<n;i++) p=p (i>1?"/":"") a[i]; print p}}' | sort -u)"

  while IFS= read -r parent; do
    [[ -z "$parent" ]] && continue
    while IFS= read -r d; do
      leaf="$(basename "$d")"
      printf '%s\n' "$have" | grep -qxF "$leaf" || extra="$extra$leaf"$'\n'
    done < <(find "$dir/$parent" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)
  done <<< "$parents"

  if [[ -n "$extra" ]]; then
    echo "  not installed: $(printf '%s' "$extra" | sort -u | tr '\n' ' ')"
  fi
  return 0
}

echo "skills: $SK"
echo

while IFS= read -r url; do
  [[ -z "$url" ]] && continue
  label="$(display "$url")"
  [[ -n "$ONLY" && "$label" != *"$ONLY"* ]] && continue

  mode="$(rows "$url" | head -1 | cut -f1)"
  count="$(rows "$url" | wc -l | tr -d ' ')"
  echo "== $label  ($count skills, $mode)"

  case "$mode" in
    npm)
      # the prefix holds pi-code and friends, whose peer ranges conflict with each
      # other, so npm refuses without --legacy-peer-deps even for a no-op update
      if [[ $DRY == 1 ]]; then
        echo "  would: npm --prefix ${NPM_PREFIX/#$HOME/~} install pi-ponytail@latest --legacy-peer-deps"
      else
        was="$(node -p "require('$NPM_PREFIX/node_modules/pi-ponytail/package.json').version" 2>/dev/null || echo '?')"
        npm --prefix "$NPM_PREFIX" install pi-ponytail@latest --legacy-peer-deps --no-audit --no-fund >/dev/null 2>&1
        now="$(node -p "require('$NPM_PREFIX/node_modules/pi-ponytail/package.json').version" 2>/dev/null || echo '?')"
        if [[ "$was" == "$now" ]]; then
          echo "  current at $now"
        else
          echo "  $was -> $now"
        fi
      fi
      ;;
    link)
      fetch "$url"
      ;;
    copy)
      if fetch "$url"; then
        while IFS=$'\t' read -r _ name rel; do
          [[ -z "$name" ]] && continue
          sync_skill "$url" "$name" "$rel"
        done < <(rows "$url")
      fi
      ;;
    *)
      echo "  ! unknown mode '$mode'"
      ;;
  esac

  [[ $LIST_NEW == 1 ]] && report_new "$url"
  echo
done < <(sources)

echo "done."
