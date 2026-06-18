#!/bin/sh
set -e

# SSH refuses keys not owned by the running user.
# The container runs as root but certs/ is mounted owned by the host user.
# Copy the key to /root/.ssh/ with correct root ownership before starting.
if [ -f /app/certs/id_ed25519 ]; then
    cp /app/certs/id_ed25519 /root/.ssh/id_ed25519
    chmod 600 /root/.ssh/id_ed25519
fi

exec "$@"
