#!/bin/bash
urls=(
  "https://thaura.ai/"
  "https://thaura.ai/api-platform"
  "https://thaura.ai/careers"
  "https://thaura.ai/community"
  "https://thaura.ai/constitution"
  "https://thaura.ai/contact"
  "https://thaura.ai/data-processing-addendum"
  "https://thaura.ai/donate"
  "https://thaura.ai/download"
  "https://thaura.ai/downloads/Thaura-latest.dmg"
  "https://thaura.ai/downloads/Thaura-latest.exe"
  "https://thaura.ai/faq"
  "https://thaura.ai/home"
  "https://thaura.ai/imprint"
  "https://thaura.ai/pricing"
  "https://thaura.ai/privacy-policy"
  "https://thaura.ai/story"
  "https://thaura.ai/terms-of-service"
  "https://discord.gg/bYzxURKVQa"
)
for u in "${urls[@]}"; do
  code=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" -I -A "Mozilla/5.0 QA-Assessment-Bot" --max-time 15 "$u")
  if [ "$code" == "000" ] || [ "$code" == "405" ]; then
    code=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" -A "Mozilla/5.0 QA-Assessment-Bot" --max-time 15 --range 0-0 "$u")
  fi
  echo "$code  $u"
done
