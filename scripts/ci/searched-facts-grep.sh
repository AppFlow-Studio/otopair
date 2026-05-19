#!/usr/bin/env bash
# =============================================================================
# DEPRECATED — see scripts/ci/vehicle-facts-grep.sh
# =============================================================================
#
# Sprint 1 Day 1 correction (2026-05-16). The original Sprint 1 Day 1 created
# this script for a parallel `vehicle_searched_facts` table that the
# consolidation v3 ruling retired. The replacement is the consolidated
# vehicle-facts-grep.sh (five rules instead of three).
#
# This stub delegates to the new script so any in-flight CI config that
# referenced the old path continues to work. Update CI config to point at
# `scripts/ci/vehicle-facts-grep.sh` directly when convenient.
# =============================================================================

set -e
HERE="$(dirname "$0")"
exec bash "$HERE/vehicle-facts-grep.sh" "$@"
