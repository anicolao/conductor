#!/usr/bin/env bash

set -euo pipefail

gemini_dir="${HOME:?HOME is required}/.gemini"
mkdir -p "$gemini_dir"

if [ ! -f "$gemini_dir/projects.json" ]; then
  printf '{"projects":{}}\n' > "$gemini_dir/projects.json"
fi

if [ -n "${GEMINI_OAUTH_CREDS_JSON:-}" ]; then
  node -e 'JSON.parse(process.env.GEMINI_OAUTH_CREDS_JSON || "")'
  printf '%s' "$GEMINI_OAUTH_CREDS_JSON" > "$gemini_dir/oauth_creds.json"
  chmod 600 "$gemini_dir/oauth_creds.json"
  echo "Using Gemini OAuth credentials from GEMINI_OAUTH_CREDS_JSON."
  exit 0
fi

if [ -n "${GEMINI_API_KEY_SECRET:-}" ]; then
  if [ -z "${GITHUB_ENV:-}" ]; then
    echo "GITHUB_ENV is required to forward GEMINI_API_KEY_SECRET." >&2
    exit 1
  fi

  echo "GEMINI_API_KEY=$GEMINI_API_KEY_SECRET" >> "$GITHUB_ENV"
  echo "Using Gemini API key from GEMINI_API_KEY."
  exit 0
fi

echo "Neither GEMINI_OAUTH_CREDS_JSON nor GEMINI_API_KEY is configured." >&2
exit 1
