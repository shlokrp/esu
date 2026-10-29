#!/bin/bash
# Double-click this file to share the PayRight app with a phone on the same Wi-Fi.
# It starts a small local web server and opens a page with a QR code to scan.

cd "$(dirname "$0")"

PORT=8000
while lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done

IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$IP" ] && IP=$(ipconfig getifaddr en1 2>/dev/null)
[ -z "$IP" ] && IP=$(ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')

echo ""
echo "  PayRight is running."
echo ""
echo "  On your phone (same Wi-Fi), open:   http://$IP:$PORT/app/"
echo "  On this Mac, open:                  http://localhost:$PORT/app/"
echo "  Website:                            http://localhost:$PORT/"
echo ""
echo "  If macOS asks whether Python may accept incoming connections, click Allow."
echo "  Keep this window open while presenting. Close it (or press Ctrl+C) to stop."
echo ""

(sleep 1; open "http://localhost:$PORT/phone.html?ip=$IP&port=$PORT") &
python3 -m http.server "$PORT" --bind 0.0.0.0
