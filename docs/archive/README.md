# Documentation Archive

**Purpose:** Old/deprecated documentation files from previous schema versions

**Reason for Archival:**
- Vehicle model refactored: `user_vehicles` → `vehicles` + `vehicle_owners` (soft-delete join table)
- Schema changed on January 31, 2026 (vehicles VIN uniqueness model)
- These files describe old architecture and are no longer accurate

**Migrated To:**
- See `/workspaces/otopair/docs/DB_STATUS.md` for current database state
- See `/workspaces/otopair/docs/API_STATUS.md` for current API surface
- See `/workspaces/otopair/docs/GAP_REPORT.md` for implementation gaps

**Files in This Archive:**
- OLD_BUSINESS_STANDARD_DB_RELATIONS.md — Old canonical schema spec
- OLD_DATABASE_ARCHITECTURE_MAP.md — Old ER diagrams
- OLD_DB_RELATIONS_REVIEW.md — Old detailed analysis
- OLD_DB_REVIEW_SUMMARY.md — Old review findings
- OLD_DB_SCHEMA_DIFFS.md — Old code diffs
- OLD_TIMESTAMP_MIGRATION_APPLIED.md — Old migration strategy (partially superseded)
- OLD_INDEX_STRATEGY_APPLIED.md — Old index documentation (still mostly valid)

**If You Need:**
- **Current database structure?** → See `DB_STATUS.md`
- **API implementation status?** → See `API_STATUS.md`
- **What still needs to be built?** → See `GAP_REPORT.md`
- **Historical context from previous schema?** → Check files in this archive

---

*Archived: January 31, 2026*
