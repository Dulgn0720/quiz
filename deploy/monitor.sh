#!/bin/sh
# Checks the API every minute and sends one alert when it goes down and one when it recovers.
# Alerts go to ALERT_WEBHOOK_URL (Slack/Mattermost/Discord-style JSON) and/or Telegram.
set -u
URL="${HEALTH_URL:-http://api:3000/api/health}"
NAME="${DOMAIN:-Agula Quiz}"
state=up
fails=0

notify() {
  msg="$1"
  echo "monitor: $msg"
  if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
    curl -fsS -m 10 -H 'Content-Type: application/json' \
      -d "{\"text\":\"$msg\",\"content\":\"$msg\"}" "$ALERT_WEBHOOK_URL" >/dev/null || echo "monitor: webhook failed" >&2
  fi
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsS -m 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=$msg" >/dev/null || echo "monitor: telegram failed" >&2
  fi
}

while true; do
  body="$(curl -fsS -m 10 "$URL" 2>/dev/null)" && echo "$body" | grep -q '"status":"ok"' && ok=1 || ok=0
  if [ "$ok" = 1 ]; then
    if [ "$state" = down ]; then notify "✅ $NAME is back up."; fi
    state=up; fails=0
  else
    fails=$((fails + 1))
    # Three failed checks in a row (about 3 minutes) before alerting, to ignore restarts.
    if [ "$state" = up ] && [ "$fails" -ge 3 ]; then
      notify "🚨 $NAME is down: health check failing (${body:-no response})."
      state=down
    fi
  fi
  sleep "${CHECK_INTERVAL_SECONDS:-60}"
done
