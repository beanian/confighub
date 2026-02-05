#!/bin/sh

# Initialize git repo if empty
if [ ! -d "/data/config-repo/.git" ]; then
    echo "Initializing git repository..."
    cd /data/config-repo
    git init
    git config user.email "system@confighub.local"
    git config user.name "ConfigHub System"
fi

cd /app

# Check if database exists (first run)
if [ ! -f "/data/confighub.db" ]; then
    echo "First run - starting server and seeding demo data..."

    # Start server in background
    node --import tsx src/index.ts &
    SERVER_PID=$!

    # Wait for server to be ready
    echo "Waiting for server to start..."
    sleep 3

    # Run seed script
    echo "Seeding demo data..."
    node --import tsx src/seed.ts

    echo "Demo data seeded! Server running..."

    # Wait for server process
    wait $SERVER_PID
else
    # Just start the server
    exec node --import tsx src/index.ts
fi
