#!/bin/bash

# Fail if a subcommand fails
set -e

# Print the commands
set -x

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ROOT_DIR=$SCRIPT_DIR/..

cd $ROOT_DIR/py
uvx ruff check .

cd $ROOT_DIR/ts
npx check-notebook ../py/normalizing-flows.ipynb
