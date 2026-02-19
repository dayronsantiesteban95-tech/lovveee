#!/bin/sh
node scripts/check-encoding.js
if [ $? -ne 0 ]; then
  echo "Encoding check failed. Fix before committing."
  exit 1
fi
