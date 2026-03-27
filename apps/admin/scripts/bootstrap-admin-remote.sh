#!/bin/bash
# Bootstrap script for creating initial superadmin in remote D1 database
# Usage: ./scripts/bootstrap-admin-remote.sh <username> <password>

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <username> <password>"
    echo "  username  - Admin username"
    echo "  password  - Admin password (min 8 characters)"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

if [ ${#PASSWORD} -lt 8 ]; then
    echo "Error: Password must be at least 8 characters"
    exit 1
fi

# Generate salt (32 random bytes, base64 encoded)
SALT=$(openssl rand -base64 32 | tr -d '\n')

# Generate password hash using Node.js
# This matches the hashPassword function in src/lib/password.ts
PASSWORD_HASH=$(node -e "
const crypto = require('crypto');
const password = '${PASSWORD}';
const salt = '${SALT}';

async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );

    return Buffer.from(derivedBits).toString('base64');
}

hashPassword(password, salt).then(console.log);
")

echo "Creating superadmin user: $USERNAME"
echo "Salt: $SALT"
echo "Hash: $PASSWORD_HASH"

# Insert into D1 database
wrangler d1 execute dead-drop-admin --remote --command="
INSERT INTO admin_users (username, password_hash, salt, role, created_at)
VALUES ('$USERNAME', '$PASSWORD_HASH', '$SALT', 'superadmin', unixepoch());
"

echo ""
echo "✓ Superadmin user created successfully!"
echo ""
echo "You can now log in to the admin panel at:"
echo "  https://admin.dead-drop.xyz/login"
echo ""
echo "  Username: $USERNAME"
echo "  Password: $(echo $PASSWORD | sed 's/./*/g')"
