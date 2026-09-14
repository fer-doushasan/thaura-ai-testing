#!/bin/bash
paths=(
  "/.env"
  "/.git/config"
  "/wp-admin"
  "/admin"
  "/api/debug"
  "/api/health"
  "/api/status"
  "/.well-known/change-password"
  "/this-page-definitely-does-not-exist-qa-404-test"
  "/config.json"
  "/package.json"
  "/.git/HEAD"
)
for p in "${paths[@]}"; do
  code=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" -A "Mozilla/5.0 QA-Assessment-Bot" --max-time 10 "https://thaura.ai${p}")
  echo "${code}  ${p}"
done
