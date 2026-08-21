# Shop Images — Design + Dashboard Blueprint

**Date:** 2026-07-12
**Branch:** `waleed/oto-warning-lights-health-fixes`
**Goal:** Let a shop show its own official image (logo / preferred photo) on the map's shop card — replacing the always-blank 🏠 placeholder — with the image held in Convex File Storage and set from the (separate) mechanic dashboard website. This spec covers the **app + backend** work (built in this repo) and a **blueprint** for the dashboard's client-side upload flow.

---

## 0. Decisions locked
| Decision | Choice |
|---|---|
| Where the image lives | **Convex File Storage** — the image bytes are held by Convex, referenced by a `_storage` id. Matches the existing `users.profile_photo_storage_id` + `mechanics.photo` precedent. |
| Backend write functions | Built **in this repo's `convex/`** (`generateShopLogoUploadUrl` + `setShopLogo`), shop-owner-authed. The dashboard only builds a picker UI and calls them. |
| Field | New `shops.logo_storage_id: v.optional(v.id("_storage"))` — the **sole** source of the shop image. (`shops.logo` exists in the schema but is **never written anywhere**, so it is NOT used as a fallback.) |

---

## 1. Current state
- **The blank spot (corrected during implementation):** the live map shop card is **`components/booking-flow/MapBrowseShopCard.tsx`** (rendered in `app/(booking-flow)/choose-mechanic.tsx` + `select-services.tsx`). It **already has a built `<Image>` + placeholder for an `imageUrl` prop**, already wired as `imageUrl={shop.imageUrl}` — but `Shop.imageUrl` (`stores/types/store.types.ts`) was hardcoded to `null` in `hooks/useShopsFromConvex.ts`. So the slot exists and is always blank. (Note: `components/booking/MechanicCarouselCard.tsx` with its 🏠 emoji is **orphaned dead code** from before the May 2026 Bookings redesign — nothing renders it; it is NOT the target.)
- **The field exists, unused:** `shops.logo` (`convex/schema.ts:1744`, `v.optional(v.string())`) is defined but never populated or read.
- **The resolve precedent already exists:** `convex/mechanics.ts:70` `resolveMechanicPhotoUrl(ctx, photo)` turns a stored photo reference into a served URL (`ctx.storage.getUrl(...)`). The **`shops.list` query** (`convex/shops.ts:241`) is what `useShopsFromConvex` reads, so that's where we resolve `logoUrl`.
- **Auth precedent:** `requireShopOwner(ctx, shopId)` (`convex/mechanics.ts:66`, backed by the `shop_users` membership check ~line 52) is the shop-owner gate to reuse for the write mutation.
- **"Not just Clerk":** the mechanic's personal `photoUrl` (from `mechanics.photo`, Clerk-synced) is distinct from the shop's official image. This feature adds the **shop's** image; it does not touch the mechanic photo.

---

## 2. Storage model
- Uploaded image bytes → Convex File Storage → a `_storage` id stored in `shops.logo_storage_id`.
- The app never stores the image itself, only reads a resolved URL.
- **Resolution** (in the query): `getUrl(logo_storage_id)` → else `null` (card shows the 🏠 fallback). There is no `shops.logo` fallback — that field is never written, so it's always empty; relying on it would be dead code.

---

## 3. Schema change (`convex/schema.ts`)
Add one field to the `shops` table (after `logo`, line 1744):
```ts
logo_storage_id: v.optional(v.id("_storage")),
```
Plus an index used by the security check in `setShopLogo` (§4.3):
```ts
.index("by_logo_storage_id", ["logo_storage_id"])
```
`shops.logo` is left in the schema as-is (legacy, never written) but is unused by this feature.

---

## 4. Backend — built in this repo

### 4.1 Read: resolve `logoUrl` in the shops query
`convex/shops.ts` — this is the query `hooks/useShopsFromConvex.ts` reads, which feeds `Shop.imageUrl` → `MapBrowseShopCard`:
```ts
async function resolveShopLogoUrl(ctx: any, shop: any): Promise<string | null> {
  if (!shop?.logo_storage_id) return null;
  return await ctx.storage.getUrl(shop.logo_storage_id); // null if the file is gone
}
```
- In `shops.list` (line 241), resolve `logoUrl` per shop:
```ts
const shops = await ctx.db.query("shops").collect();
return await Promise.all(shops.map(async (shop) => ({ ...shop, logoUrl: await resolveShopLogoUrl(ctx, shop) })));
```
(No `mechanics.ts` change — the map card is fed by `shops.list`, not `mechanics.list`.)

### 4.2 Write: upload URL action (`convex/shops.ts`)
```ts
export const generateShopLogoUploadUrl = action({
  args: { shopId: v.id("shops") },
  handler: async (ctx, { shopId }) => {
    await requireShopOwnerForAction(ctx, shopId); // auth: caller owns/ manages shopId
    return await ctx.storage.generateUploadUrl(); // short-lived POST URL
  },
});
```
(If `requireShopOwner` is a query/mutation-ctx helper, add an action-compatible variant that runs the same `shop_users` membership check via `ctx.runQuery`.)

### 4.3 Write: set the logo (`convex/shops.ts`)
```ts
export const setShopLogo = mutation({
  args: { shopId: v.id("shops"), storageId: v.id("_storage") },
  handler: async (ctx, { shopId, storageId }) => {
    await requireShopOwner(ctx, shopId);
    // SECURITY: reject a storageId already used as another shop's logo. Without
    // this, an owner of any shop could adopt a victim's file id (which shops.list
    // exposes) and then delete it — Convex storage.delete is a global hard-delete
    // with no refcount. This guarantees a shop's logo_storage_id is always its
    // own unique upload, so the delete-previous below can never destroy another
    // tenant's file. (`_id !== shopId` keeps re-setting the same image idempotent.)
    const conflict = await ctx.db
      .query("shops")
      .withIndex("by_logo_storage_id", (q) => q.eq("logo_storage_id", storageId))
      .filter((q) => q.neq(q.field("_id"), shopId))
      .first();
    if (conflict) throw new Error("That image is already in use by another shop.");

    await ctx.db.patch(shopId, { logo_storage_id: storageId });
    // NOTE: we deliberately do NOT ctx.storage.delete() the replaced file. A
    // client-supplied storageId can't be proven to belong to this shop, and
    // ctx.storage.delete is a GLOBAL hard-delete with no refcount — so deleting
    // a "previous" id an attacker could have poisoned would destroy another
    // feature's file (e.g. a user's profile photo). Orphaned logo files are an
    // accepted low-severity tradeoff, reclaimed by a background reaper (§9).
  },
});
```
Companion `clearShopLogo({ shopId })` mutation (shop-owner) that just unsets `logo_storage_id` (for a "remove image" button). It does **not** `ctx.storage.delete()` the file — same reasoning as above; the orphan is reaped async (§9).

---

## 5. Frontend — built in this repo
The live map card (`components/booking-flow/MapBrowseShopCard.tsx`) **already** renders an `<Image>` from an `imageUrl` prop with a placeholder fallback, and is already wired `imageUrl={shop.imageUrl}`. `Shop.imageUrl` already exists on the type. The ONLY change needed is feeding it real data:
- **`hooks/useShopsFromConvex.ts`**: set `Shop.imageUrl` from `shop.logoUrl` (the resolved URL now returned by `shops.list`) instead of the current hardcoded `null`.

That's it — no `Shop` type change, no `MapBrowseShopCard` change, and **no `Mechanic` type / `mechanics.ts` / `MechanicCarouselCard` changes** (that card is orphaned dead code — see §1). The shop **detail** page renders no image today; a hero image there is a follow-up (§9).

---

## 6. Dashboard blueprint (separate website — NOT built here)
The dashboard shares this Convex deployment. To set a shop's image so the app reads it, the dashboard does exactly this:

**Contract**
- Field written: `shops.logo_storage_id`.
- Convex functions it calls (defined here, §4): `generateShopLogoUploadUrl({ shopId })` (action) and `setShopLogo({ shopId, storageId })` (mutation). Optional `clearShopLogo({ shopId })`.
- Auth: the caller must be signed in as a user who owns/manages `shopId` (same `shop_users` membership the rest of the dashboard already relies on). The functions enforce this server-side; unauthorized calls throw.
- Security: `setShopLogo` also **rejects a `storageId` already used as another shop's logo** ("That image is already in use by another shop."). In the normal flow each upload returns a fresh, unique `storageId`, so this never triggers — but surface any thrown error to the user rather than swallowing it.

**Upload flow (client-side, in the dashboard)**
```
1. Shop owner picks/crops an image in the dashboard UI.
2. const uploadUrl = await convex.action(api.shops.generateShopLogoUploadUrl, { shopId });
3. const res = await fetch(uploadUrl, {
     method: "POST",
     headers: { "Content-Type": file.type },   // e.g. image/png
     body: file,                                // the raw image bytes/Blob
   });
   const { storageId } = await res.json();      // Convex returns { storageId }
4. await convex.mutation(api.shops.setShopLogo, { shopId, storageId });
5. Done. The app's mechanics `list` query now resolves shopLogoUrl for that shop
   automatically (reactive) — no app deploy, no cache bust.
```

**Image constraints (enforce in the dashboard UI; optionally re-check server-side)**
- Types: `image/png`, `image/jpeg`, `image/webp`.
- Max size: ~2 MB (map card is small; keep it light).
- Recommended: square, ≥ 256×256, center-cropped to a square (the card renders 56×56 `cover`).

**Cleanup:** replaced/cleared logo files are **not** deleted inline (a client-supplied `storageId` can't be proven to belong to the shop, so hard-deleting a "previous" id would be an arbitrary-file-deletion vector — see §9). Orphans are reclaimed by a background reaper. The dashboard does not manage file lifecycle beyond calling these functions.

---

## 7. App ↔ dashboard communication summary
```
Dashboard (website)                Convex (shared)                 App (this repo)
  pick image ──▶ generateShopLogoUploadUrl ──▶ upload URL
  POST bytes ─────────────────────▶ _storage (bytes) ──▶ storageId
  setShopLogo(shopId, storageId) ─▶ shops.logo_storage_id = storageId
                                     shops.list resolves logoUrl ──▶ useShopsFromConvex → Shop.imageUrl ──▶ MapBrowseShopCard <Image>
```
The single shared contract is **`shops.logo_storage_id` + the two functions**. Neither side hardcodes URLs; the app always resolves fresh via `ctx.storage.getUrl`.

---

## 8. Testing / verification
- **Backend:** with a seeded shop, call `generateShopLogoUploadUrl` → POST a test image → `setShopLogo` → assert `shops.logo_storage_id` set and `mechanics.list` returns a non-null `shopLogoUrl` for that shop; assert a non-owner call throws; assert replacing deletes the old file.
- **Frontend:** `useShopsFromConvex` maps `shop.logoUrl` → `Shop.imageUrl`; `MapBrowseShopCard` renders the shop image when set, its placeholder when null. Typecheck: no new errors beyond the ~114 baseline.
- **Manual:** the map's `MapBrowseShopCard` shows the shop's uploaded image; a shop with no image still shows the placeholder.

---

## 9. Deferred / out of scope
- Shop **detail** page hero image (the profile page renders no image today) — a natural follow-up using the same `shopLogoUrl`.
- Multiple images / portfolio (there is a separate `shop_portfolio` table for that).
- Server-side image validation/resizing (dashboard-side constraints are sufficient for v1).
- Backfilling logos for existing shops (they simply show the placeholder until a dashboard upload).
- **Orphaned-file reaper:** because `setShopLogo`/`clearShopLogo` no longer delete inline, a scheduled job should reclaim `_storage` blobs that are shop-logo orphans (not referenced by any live `shops.logo_storage_id`, cross-checked against other `_storage`-referencing tables). Alternatively, a `{shopId, storageId}` pending-upload record written at `generateShopLogoUploadUrl` time would enable safe synchronous reclamation.

## 10. Security review findings (2026-07-12)
An adversarial review of this feature surfaced two issues:
1. **(Fixed here)** `setShopLogo` originally hard-deleted a client-supplied `previous` storageId. Combined with queries exposing raw `logo_storage_id`, that was a cross-tenant / arbitrary file-deletion primitive. Closed by (a) the `by_logo_storage_id` conflict guard and (b) removing the inline `ctx.storage.delete()` entirely (orphans reaped async).
2. **(Out of scope, tracked separately)** `convex/users.ts` `list` (line 63) and `getById` (line 125) are **unauthenticated** and return every user's full record (email, phone, name, raw `profile_photo_storage_id`). This is an independent, pre-existing PII-exposure defect — spun off as its own task, not part of shop-images.
