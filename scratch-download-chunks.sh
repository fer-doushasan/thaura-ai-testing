#!/bin/bash
mkdir -p "./discovery-evidence/source-scan/chunks"
while read -r path; do
  fname=$(echo "$path" | sed 's#/#_#g')
  /usr/bin/curl -s --max-time 15 "https://thaura.ai${path}" -o "./discovery-evidence/source-scan/chunks/${fname}"
done < "./discovery-evidence/source-scan/chunk-list.txt"
echo "Downloaded $(ls ./discovery-evidence/source-scan/chunks | wc -l) chunk files"
