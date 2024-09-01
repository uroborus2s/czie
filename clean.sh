#!/bin/bash

find . -name "node_modules" -type d -exec rm -rf '{}' +
find . -name ".turbo" -type d -exec rm -rf '{}' +
find . -name "dist" -type d -exec rm -rf '{}' +
find . -name "tsconfig.tsbuildinfo" -exec rm -rf '{}' +