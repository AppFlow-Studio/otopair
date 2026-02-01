# CRM schema readiness

**Context:** Beyond scheduling (time_slots, availability_rules, schedule_exceptions, shops.timezone), these are the **other tables and changes** needed so the schema supports a CRM: customer/contact views, pipeline, assignments, and shop staff. Contact/communication happens in the app; reviews stay as their own table without CRM-specific additions.

**Source:** Current [convex/schema.ts](../convex/schema.ts). This doc is additive—it does not change the schema by itself.

---

## 1. Existing tables to edit (non-scheduling)

### **users** (customers = contacts in CRM)

| Add / change | Purpose |
|--------------|---------|
| `lead_source` (optional string) | Where they came from: "web", "referral", "walk_in", "campaign_xyz". |
| `tags` (optional array of strings) | Segment/label: "vip", "oil_change_only", "at_risk". Enables saved segments. |
| `last_contact_at` (optional number, ms) | Last touchpoint (e.g. booking). Powers "last activity" in CRM. |
| `notes` (optional string) | Quick internal notes; timeline/history from activities (below). |

**Index:** Consider `by_last_contact_at` or `by_lead_source` if you filter lists by these.

---

### **shops** (business entity in CRM)

Each shop is its own entity/organization. **No franchise or chain support** — no parent/child shops.

| Add / change | Purpose |
|--------------|---------|
| `timezone` (optional string) | e.g. `"America/New_York"`. Already in scheduling scope; needed for CRM calendar/reminders. |
| `logo_url` (optional string) | Branding in shop dashboard and white-label. |
| `website` (optional string) | Contact/channel. |
| `admin_user_id` (optional, FK users) | The one admin for this shop (platform user who manages the shop). |

---

### **mechanics** (technicians at the shop)

Shop access is **admin + mechanics** only: one admin per shop (`shops.admin_user_id`) and mechanics (this table). No separate staff table.

| Add / change | Purpose |
|--------------|---------|
| `user_id` (optional, FK users) | Link to platform user if this mechanic has a login. |

---

### **bookings** (deals/appointments in CRM)

| Add / change | Purpose |
|--------------|---------|
| `source` (optional string) | Channel: "web", "phone", "walk_in", "shop_dashboard". |
| `campaign` / attribution | TBD — figure out later. |
| `internal_notes` (optional string) | Staff-only notes (e.g. "customer asked for synthetic only"). |
| `assigned_to` (optional, FK mechanics or users) | Who "owns" this booking — mechanic or admin user (for my-appointments / workload). |

**Index:** `by_assigned_to` if you show "my appointments" by staff.

---

### **follow_ups** (tasks/reminders in CRM)

| Add / change | Purpose |
|--------------|---------|
| `assigned_to` (optional, FK users or mechanics) | Who should act (call back, send quote). |
| `due_at` (optional number, ms) | Explicit due date; you already have `scheduled_for` for trigger time. |
| Broader `follow_up_type` | Add types like "call_back", "send_quote", "inspection" in addition to "reminder", "maintenance_due". |
| `shop_id` (optional, FK shops) | If tasks are shop-scoped (e.g. "call this customer" at Shop A). |

**Index:** `by_assigned_to`, `by_shop_id` if you filter tasks by assignee or shop.

---

### **conversion_funnels** (attribution in CRM)

| Add / change | Purpose |
|--------------|---------|
| `source` (optional string) | e.g. "google", "facebook". |
| Campaign / attribution | TBD — figure out later. |

---

## 2. New tables that make the schema CRM-friendly

### **activities** or **activity_timeline** (unified "last activity" / timeline)

| Field | Type | Purpose |
|-------|------|---------|
| `entity_type` | string | "user" \| "booking" \| "shop" |
| `entity_id` | string or id | Target record id |
| `activity_type` | string | "booking_created", "payment_completed", "booking_updated", etc. |
| `actor_id` | optional id("users") | Who performed the action |
| `created_at` | number (ms) | When it happened |
| `metadata` | optional object | Link to booking_id, payment_id, etc. |

**Indexes:** `by_entity` (entity_type, entity_id), `by_created_at`, optionally `by_actor_id`.

Powers "Last activity" on contact/booking and a single timeline view in CRM. You can backfill from existing `analytics_events` / `booking_status_history` / `payment_status_history` and then write to this table from new events.

---

_Campaigns / attribution: figure out later._

---

## 3. Summary: what to edit vs add

| Category | Edit existing | Add new |
|----------|----------------|---------|
| **Scheduling** | time_slots, shops (timezone) | availability_rules, schedule_exceptions |
| **Contacts (users)** | users (lead_source, tags, last_contact_at, notes) | — |
| **Business (shops)** | shops (timezone, logo_url, website, admin_user_id); each shop is its own entity, no chains | — |
| **Staff** | shops (admin_user_id), mechanics (user_id optional); admin + mechanics only, no shop_users | — |
| **Pipeline (bookings)** | bookings (source, internal_notes, assigned_to); campaign/attribution TBD later | — |
| **Tasks** | follow_ups (assigned_to, due_at, shop_id, broader types) | — |
| **Attribution** | conversion_funnels (source); campaign TBD later | — |
| **CRM UX** | — | activities only |

---

## 4. Implementation order (suggested)

1. **Quick wins (scheduling):** time_slots (status, booking_id, hold_expires_at_ms, etc.), availability_rules, schedule_exceptions, shops.timezone.
2. **CRM contact view:** users (lead_source, tags, last_contact_at, notes).
3. **Pipeline and assignment:** bookings (source, internal_notes, assigned_to); shops (admin_user_id); mechanics (user_id optional). Staff = admin + mechanics only.
4. **Timeline:** activities (backfill from existing events; use for "last activity" and timeline — no separate notes table).
5. **Tasks:** follow_ups (assigned_to, due_at, shop_id, task types).
6. **Shops and attribution:** shops (logo_url, website, admin_user_id); conversion_funnels (source). Campaigns / attribution TBD later.

This keeps the current schema working while making it possible to build a CRM that thinks in contacts, pipeline, assignments, and touchpoints rather than only in bookings and slots.
