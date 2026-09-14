#!/bin/bash
OUT="./discovery-evidence/website-scan/security-headers.txt"
> "$OUT"
urls=(
  "https://thaura.ai/"
  "https://thaura.ai/pricing"
  "https://thaura.ai/api-platform"
  "https://thaura.ai/contact"
  "https://backend.thaura.ai/api/plugins/list"
)
for u in "${urls[@]}"; do
  echo "=== $u ===" | tee -a "$OUT"
  /usr/bin/curl -sI -A "Mozilla/5.0 QA-Assessment-Bot" --max-time 15 "$u" | grep -iE "strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|set-cookie|x-xss-protection|cross-origin" | tee -a "$OUT"
  echo "" | tee -a "$OUT"
done
