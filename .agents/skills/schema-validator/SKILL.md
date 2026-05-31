---
name: schema-validator
description: Validates Convex schema changes. Checks table definitions, index coverage, validator usage, and backward compatibility.
context: fork
allowed-tools: Read Grep Glob Bash
---

# Skill: Schema Validator

## When To Use
After any change to convex/schema.ts or adding new Convex functions.

## Process

### Step 1: Schema Consistency
- New table has all required fields
- Foreign keys reference existing tables
- Validators match expected types (v.string(), v.number(), etc.)

### Step 2: Index Coverage
- Queries filter by indexed fields
- No full-table scans on large tables
- Compound indexes for multi-field lookups

### Step 3: Auth Check
- Every user-facing query/mutation calls `ctx.auth.getUserIdentity()`
- Internal functions clearly marked as `internalQuery` / `internalMutation`

### Step 4: Backward Compatibility
- Existing fields not removed (add new, deprecate old)
- Default values for new required fields
- Migration plan if schema changes are breaking

### Step 5: Type Generation
- Run `npx convex dev` to regenerate types
- Verify no TypeScript errors in consuming code

## Output
```
## Schema Validation: [Change Description]
- [ ] Table definition valid
- [ ] Indexes cover query patterns
- [ ] Auth checks present
- [ ] Backward compatible
- [ ] Types regenerated and clean
**Issues:** [list or "None"]
```
