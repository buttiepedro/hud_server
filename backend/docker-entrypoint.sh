#!/bin/sh
set -e

# SSH refuses keys not owned by the running user.
# The container runs as root but mounted dirs may be owned by the host user.
# Copy whichever key exists to /root/.ssh/ with correct root ownership.
# Priority: /app/certs/ (manual setup) → /app/data/ (wizard-generated)
if [ -f /app/certs/id_ed25519 ]; then
    cp /app/certs/id_ed25519 /root/.ssh/id_ed25519
    chmod 600 /root/.ssh/id_ed25519
elif [ -f /app/data/id_ed25519 ]; then
    cp /app/data/id_ed25519 /root/.ssh/id_ed25519
    chmod 600 /root/.ssh/id_ed25519
fi

exec "$@"
