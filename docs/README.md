# OtoPair Documentation Index

**Last Updated:** January 31, 2026  
**Schema Version:** Current (vehicles + vehicle_owners refactor)

---

## 📖 Core Documentation

Start here for comprehensive understanding of the current system:

### 1. **[DB_STATUS.md](./DB_STATUS.md)** — Database Schema Reference
**Length:** 1,800+ lines | **Purpose:** Single source of truth for database design

When to read:
- "What tables exist?"
- "What are the relationships?"
- "How are indexes organized?"
- "What invariants are enforced?"
- "Is this field in the schema?"

**Key Sections:**
- Current Tables (36 total, organized by domain)
- Key Relationships (includes NEW VIN uniqueness model)
- Indexes by Table (74 indexes documented)
- Invariants & Constraints
- Performance Profile
- Data Integrity Guarantees

---

### 2. **[API_STATUS.md](./API_STATUS.md)** — Convex API Inventory
**Length:** 1,200+ lines | **Purpose:** Complete API surface documentation

When to read:
- "What queries/mutations are available?"
- "What parameters does this function take?"
- "Is this feature implemented?"
- "How do I follow the user flow?"
- "What's the typical booking flow?"

**Key Sections:**
- Module Overview (12 implemented, 14 schema-only, 2 missing)
- Fully Implemented APIs (with all queries/mutations listed)
- Schema-Only Tables (read-only, no access layer)
- Missing Access Layers (complete specs provided)
- Call Patterns (typical user flows)
- Performance Notes

---

### 3. **[GAP_REPORT.md](./GAP_REPORT.md)** — Implementation Roadmap
**Length:** 2,000+ lines | **Purpose:** Implementation status and next steps

When to read:
- "What needs to be built next?"
- "What's the complete spec for vehicles.ts?"
- "How long will this take?"
- "What are the risks?"
- "How do I test this?"

**Key Sections:**
- Summary by Status (12/14/2 breakdown)
- Detailed Gap Analysis (with complete code specs)
- Priority-Ordered Roadmap (4 phases with effort)
- Risk Assessment
- Recommendations

**Critical:** See "Missing" section for complete specs for:
- vehicles.ts (upsertVehicle, addOwner, removeOwner)
- vehicle_owners.ts (join table, soft-delete support)

---

### 4. **[DOCUMENTATION_UPDATE.md](./DOCUMENTATION_UPDATE.md)** — What Changed
**Length:** 500 lines | **Purpose:** Transition guide for schema refactor

When to read:
- "Why did the schema change?"
- "What documentation is new?"
- "Where did the old docs go?"
- "What should I focus on?"

**Key Sections:**
- What Happened (schema change summary)
- What Was Done (new docs created, old archived)
- Current Structure (where to find what)
- Critical Next Actions (blocking items)

---

## 📚 Supporting Documentation

Additional resources for completed work and deep dives:

### In `/strategy_markdown/`

- **[1st_final_summary.md](../strategy_markdown/1st_final_summary.md)** — Executive summary of all completed work
  - Timestamps standardized (v.float64() throughout)
  - 44 indexes applied for performance
  - FSM validation implemented
  - Status history audit logs
  - No breaking changes

- **[STATUS_HISTORY_IMPLEMENTED.md](../strategy_markdown/STATUS_HISTORY_IMPLEMENTED.md)** — FSM audit trail design
  - Booking status machine diagram
  - Payment status machine diagram
  - Append-only log design
  - Usage examples

- **[IMPLEMENTATION_SUMMARY.md](../strategy_markdown/IMPLEMENTATION_SUMMARY.md)** — Timestamp migration details
  - Migration strategy
  - Backfill plan
  - Validation checklist

---

## 🗂️ Archive

**Old documentation preserved for historical context:**

See [archive/README.md](./archive/README.md) for:
- Why files were archived
- What they contained
- When/if to reference them

**Archived Files:**
- OLD_BUSINESS_STANDARD_DB_RELATIONS.md
- OLD_DATABASE_ARCHITECTURE_MAP.md
- OLD_DB_RELATIONS_REVIEW.md
- OLD_DB_SCHEMA_DIFFS.md
- OLD_DB_REVIEW_SUMMARY.md
- OLD_INDEX_STRATEGY_APPLIED.md
- OLD_TIMESTAMP_MIGRATION_APPLIED.md

---

## 🎯 Quick Navigation

### "I want to..." → "Go to..."

| Question | Document | Section |
|----------|----------|---------|
| See all tables and relationships | DB_STATUS | Current Tables / Key Relationships |
| Find available APIs | API_STATUS | Module Overview |
| Build vehicles.ts | GAP_REPORT | Missing / vehicles.ts spec |
| Understand bookings flow | API_STATUS | Call Patterns / Typical User Flow |
| Check performance | DB_STATUS | Performance Profile |
| See what changed | DOCUMENTATION_UPDATE | Summary / What Was Done |
| Understand FSM validation | STATUS_HISTORY_IMPLEMENTED | FSM diagrams |
| See all indexes | DB_STATUS | Indexes by Table |
| Find implementation roadmap | GAP_REPORT | Priority-Ordered Roadmap |
| Check what's implemented | API_STATUS | Module Overview / Summary |

---

## 📋 Document Purposes at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                   DOCUMENTATION MATRIX                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DB_STATUS.md          →  "What's the database right now?"    │
│  (1,800 lines)             • Tables, relationships, indexes     │
│  REFERENCE              • Invariants, constraints              │
│                         • Single source of truth               │
│                                                                 │
│  API_STATUS.md         →  "What APIs exist?"                  │
│  (1,200 lines)             • Implemented queries/mutations      │
│  INVENTORY              • Schema-only tables                   │
│                         • Missing access layers                │
│                         • Typical flows                        │
│                                                                 │
│  GAP_REPORT.md         →  "What should I build?"              │
│  (2,000 lines)             • Complete specs for missing items   │
│  ROADMAP                • Implementation phases                │
│                         • Effort estimates                     │
│                         • Smoke tests                          │
│                                                                 │
│  DOCUMENTATION_UPDATE  →  "What's the status?"                │
│  (500 lines)               • Changes made                       │
│  SUMMARY                • New structure                        │
│                         • Critical actions                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### For New Team Members
1. Read [DOCUMENTATION_UPDATE.md](./DOCUMENTATION_UPDATE.md) (5 min)
2. Skim [DB_STATUS.md](./DB_STATUS.md) Current Tables (10 min)
3. Check [API_STATUS.md](./API_STATUS.md) Module Overview (5 min)
4. You're ready to code!

### For Building New Features
1. Check [GAP_REPORT.md](./GAP_REPORT.md) Priority-Ordered Roadmap
2. Find your feature in "Missing" or "Schema-Only" section
3. Use complete specs provided
4. Reference [DB_STATUS.md](./DB_STATUS.md) for schema details

### For Understanding Current System
1. Read [API_STATUS.md](./API_STATUS.md) - what's built
2. Reference [DB_STATUS.md](./DB_STATUS.md) - how data is stored
3. Check [STATUS_HISTORY_IMPLEMENTED.md](../strategy_markdown/STATUS_HISTORY_IMPLEMENTED.md) - how changes are tracked

---

## 📊 Documentation Coverage

| Category | Covered | Notes |
|----------|---------|-------|
| **Schema** | ✅ Complete | All 36 tables documented in DB_STATUS |
| **Indexes** | ✅ Complete | All 74 indexes mapped |
| **Relationships** | ✅ Complete | Including NEW vehicle model |
| **API Surface** | ✅ Complete | 12 implemented modules fully documented |
| **Missing Features** | ✅ Complete | vehicles.ts and vehicle_owners.ts have full specs |
| **Performance** | ✅ Complete | Index strategy and O(n) analysis in DB_STATUS |
| **Roadmap** | ✅ Complete | 4-phase plan with effort estimates |
| **Risk Assessment** | ✅ Complete | In GAP_REPORT |

---

## 🔄 Keeping Documentation Updated

When you:
- **Add a new table** → Update DB_STATUS.md (add to Current Tables, indexes, relationships)
- **Add a query/mutation** → Update API_STATUS.md (add to Module Overview)
- **Complete implementation** → Update GAP_REPORT.md (move from ❌ to ✅)
- **Discover a problem** → Add to GAP_REPORT.md (add to Risk Assessment)

---

## 🤝 Documentation Team

- **DB_STATUS.md** — Schema reference (auto-generate from convex/schema.ts)
- **API_STATUS.md** — API inventory (manual; update when adding endpoints)
- **GAP_REPORT.md** — Implementation tracker (update when completing features)

---

## 📞 Questions?

- "What field is on this table?" → DB_STATUS.md
- "Does this API exist?" → API_STATUS.md
- "How do I build this?" → GAP_REPORT.md
- "Why did something change?" → DOCUMENTATION_UPDATE.md

---

**Last Updated:** January 31, 2026  
**Next Review:** After Phase 1 completion (vehicles.ts + vehicle_owners.ts)  
**Maintainer:** Development team  
**Status:** Current and accurate ✅
