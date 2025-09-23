#!/bin/bash

# Exit on error
set -e

# Then publish
echo "Publishing package..."
docker compose run --rm node sh -c "cd lib && npm publish --access public --verbose"
