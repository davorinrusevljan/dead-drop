#!/bin/sh
# Pre-commit hook: Run lint-staged AND tests on modified packages

set -e

# Run lint-staged first (existing behavior)
npx lint-staged
lint_status=$?

# Get staged files and determine which packages changed
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

# Function to test a specific package
test_package() {
  if [ -n "$1" ]; then
    return 1
  fi

  # Check if any staged file is in this package
  if echo "$STAGED_FILES" | grep -q "packages/engine/"; then test_package "packages/engine" && return 0; fi
  if echo "$STAGED_FILES" | grep -q "packages/ui/"; then test_package "packages/ui" && return 0; fi
  if echo "$STAGED_FILES" | grep -q "apps/core/"; then test_package "apps/core" && return 0; fi
  if echo "$STAGED_FILES" | grep -q "apps/admin/"; then test_package "apps/admin" && return 0; fi
  if echo "$STAGED_FILES" | grep -q "apps/saas/"; then test_package "apps/saas" && return 0; fi

  return 0
}

# Check which packages have changes
MODIFIED_PACKAGES=""

if echo "$STAGED_FILES" | grep -q "packages/engine/"; then MODIFIED_PACKAGES="$MODIFIED_PACKAGES @dead-drop/engine"; fi
if echo "$STAGED_FILES" | grep -q "packages/ui/"; then MODIFIED_PACKAGES="$MODIFIED_PACKAGES @dead-drop/ui"; fi
if echo "$STAGED_FILES" | grep -q "apps/core/"; then MODIFIED_PACKAGES="$MODIFIED_PACKAGES @dead-drop/core"; fi
if echo "$STAGED_FILES" | grep -q "apps/admin/"; then MODIFIED_PACKAGES="$MODIFIED_PACKAGES @dead-drop/admin"; fi
if echo "$STAGED_FILES" | grep -q "apps/saas/"; then MODIFIED_PACKAGES="$MODIFIED_PACKAGES @dead-drop/saas"; fi

# Only run tests if packages were modified
if [ -n "$MODIFIED_PACKAGES" ]; then
  echo "Running tests for modified packages: $MODIFIED_PACKAGES"

  # Build list of packages to test
  TEST_FILTER=""
  if [ -n "$MODIFIED_PACKAGES" ]; then
    for pkg in $MODIFIED_PACKAGES; do
      TEST_FILTER="$TEST_FILTER --filter=$pkg"
    done
  fi

  # Run tests
  if pnpm turbo test --force $TEST_FILTER; then
    echo "Tests passed ✓"
  else
    echo "Tests failed ✗"
    exit 1
  fi
fi
