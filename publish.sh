#!/bin/bash

# Exit on error
set -e

# Publish
cd lib
npm publish --access public --verbose
cd ..
