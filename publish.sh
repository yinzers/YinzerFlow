#!/bin/bash

# Exit on error
set -e

# Check the file size of lib/index.js to ensure it is below 50KB
SIZE=$(stat -c%s lib/index.js)
if [ $SIZE -gt 50000 ]; then
    echo "File size of lib/index.js is $SIZE bytes, which is greater than 50KB"
    exit 1
fi

# Copy required files
cp package.json lib/
cp README.md lib/
cp LICENSE lib/
cp .npmignore lib/

# Publish
cd lib
npm publish --access public --verbose
cd ..
