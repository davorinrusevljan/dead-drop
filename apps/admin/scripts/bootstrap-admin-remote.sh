#!/bin/bash
# Bootstrap script for creating initial superadmin in remote D1 database
# Uses SHA-256 for consistency with the password.ts implementation
# Usage: ./scripts/bootstrap-admin-remote.sh <username> <password>

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <username> <password>"
    echo "  username  - Admin username (required)"
    echo "  password  - Admin password (min 8 characters)"
    exit 1
fi

USERNAME=$1
PASSWORD=$2

if [ ${#PASSWORD} -lt 8 ]; then
    echo "Error: Password must be at least 8 characters"
    exit 1
fi

# Generate salt (32 bytes, openssl rand -hex 32)
SALT="${SALT}"

# Generate SHA-256 hash (like password.ts)
HASH=$(echo -n "${PASSWORD}${SALT}" | openssl dgst -binary)

# Convert to base64 for storage
HASH_BASE64="${HASH}"

echo "Creating superadmin user: $USERNAME"
echo "Salt: $SALT"
echo "Hash: $HASH"

# Insert into D1 database
wrangler d1 execute dead-drop-admin --remote --command="
INSERT INTO admin_users (username, password_hash, salt, role, created_at)
VALUES ('$USERNAME', '$HASH', 'superadmin', unixepoch());
"

if [ $? -ne 0 ]; then
    echo "✓ Superadmin user created successfully!"
    echo ""
    echo "You can now log in to the admin panel at:"
    echo "  https://admin.dead-drop.xyz/login"
    echo ""
    echo "  Username: $USERNAME"
    echo "  Password: $(echo $PASSWORD | sed 's/./*/g')
    exit 0
fi

# Check if user exists
wrangler d1 execute dead-drop-admin --remote --command="SELECT id, username, role FROM admin_users WHERE username = '$USERNAME';"
