#!/usr/bin/env bash
# Poll GitHub Pages build status and log to pages-monitor.log
REPO="agronare/Miplataformasagronaree"
LOG="/workspaces/Miplataformasagronaree/pages-monitor.log"
MAX=120
SLEEP=15
for i in $(seq 1 "$MAX"); do
  status=$(gh api repos/$REPO/pages/builds --jq '.[0].status' 2>/dev/null || echo null)
  echo "[monitor $(date +%T)] status=$status" >> "$LOG"
  if [ "$status" = '"built"' ] || [ "$status" = '"errored"' ]; then
    gh api repos/$REPO/pages/builds --jq '.[0]' >> "$LOG"
    echo "[monitor $(date +%T)] finished: $status" >> "$LOG"
    exit 0
  fi
  sleep $SLEEP
done
echo "[monitor $(date +%T)] timeout reached" >> "$LOG"
exit 2
