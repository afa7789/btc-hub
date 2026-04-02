#!/bin/bash
# Cron setup for daily data updates
# Run: bash cron.sh install
#       bash cron.sh remove

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRON_CMD="cd $SCRIPT_DIR && bash update-and-rebuild.sh --deploy 2>&1 | logger -t btc-things"

case "${1:-}" in
    install)
        # Add cron job (daily at 6 AM UTC)
        (crontab -l 2>/dev/null | grep -v "btc-things" || true; echo "0 6 * * * $CRON_CMD") | crontab -
        echo "Cron job installed: daily at 6 AM UTC"
        crontab -l | grep btc-things
        ;;
    remove)
        crontab -l 2>/dev/null | grep -v "btc-things" | crontab -
        echo "Cron job removed"
        ;;
    *)
        echo "Usage: bash cron.sh [install|remove]"
        ;;
esac
