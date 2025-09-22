#!/bin/sh
set -e

SERVER_NAME="${SERVER_NAME:-localhost}"
CERT_DIR="/etc/letsencrypt/live/${SERVER_NAME}"
CERT_DEST="/etc/nginx/ssl/server.crt"
KEY_DEST="/etc/nginx/ssl/server.key"
SELF_CERT="/etc/nginx/ssl/selfsigned.crt"
SELF_KEY="/etc/nginx/ssl/selfsigned.key"

if [ -f "${CERT_DIR}/fullchain.pem" ] && [ -f "${CERT_DIR}/privkey.pem" ]; then
  ln -sf "${CERT_DIR}/fullchain.pem" "${CERT_DEST}"
  ln -sf "${CERT_DIR}/privkey.pem" "${KEY_DEST}"
else
  cp "${SELF_CERT}" "${CERT_DEST}"
  cp "${SELF_KEY}" "${KEY_DEST}"
fi
