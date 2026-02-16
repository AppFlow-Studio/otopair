# OTOPAIR Rewards Program

**Purpose:** Document the rewards system per OTOPAIR Rewards Program Framework V2.  
**Source:** [convex/rewards.ts](../convex/rewards.ts), [convex/schema.ts](../convex/schema.ts), [app/membership.tsx](../app/membership.tsx).

---

## 1. Two-lane architecture

| Lane                      | What it tracks                 | Scope                    |
| ------------------------- | ------------------------------ | ------------------------ |
| **Relationship (Tier)**   | Status earned by service spend | Per vehicle (vin + user) |
| **Contribution (Credit)** | Dollar credits from actions    | Per user (pooled wallet) |

Tiers and credits never merge: tier determines earn rate; credits are the spendable balance.

---

## 2. Ownership Credit

- **Unit:** Dollars, not points.
- **Earn rate by tier:** Driver 1.5%, Preferred 3%, Elite 5% of `booking.total_cost`.
- **Expiry:** 6 months (MVP).
- **Primary earn:** Completing maintenance/diagnostics/repairs through Otopair-trusted shops.
- **Contribution earn:** Review $5, Upload records $10, Referral $25 (both parties; cap 5 referrals).

---

## 3. Tier structure

| Tier      | Spend threshold (12‑mo) | Earn rate |
| --------- | ----------------------- | --------- |
| Driver    | Default                 | 1.5%      |
| Preferred | ~$750                   | 3%        |
| Elite     | ~$1,500                 | 5%        |

- **Per-vehicle:** Tier is stored in `vehicle_tiers(vin, user_id)`. Each car has its own tier.
- **Auto-upgrade:** When a booking completes, `addCreditForCompletedBooking` recomputes 12‑month spend for that vehicle and updates tier if thresholds are crossed.
- **Credits pool:** All earned credits go into one wallet per user, regardless of which car was serviced.

---

## 4. Tables

| Table                         | Purpose                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| user_reward_wallets           | Per-user balance, auto_apply_to_booking, miles_safe (current odometer − initial odometer at registration) |
| ownership_credit_transactions | Earn/redeem audit; type, reference_id, expires_at                                                         |
| reward_deals                  | Suggested deals with credit_amount; display_order                                                         |
| user_contribution_claims      | Claimed contribution rewards; prevents double-credit; referral cap                                        |
| vehicle_tiers                 | Per-vehicle tier, spend_12mo; by_vin_user                                                                 |

---

## 5. API (rewards.ts)

### Queries

- `getWallet(userId)` — balance + auto_apply
- `getSuggestedDeals(limit?)` — first N by display_order
- `getAllDeals()` — all deals
- `getCreditHistory(userId, limit?)` — ownership_credit_transactions
- `getMembershipStats(userId)` — miles_safe, services, shops
- `getPrimaryVehicleTier(userId)` — tier for primary vehicle
- `hasClaimedContribution(userId, actionType, referenceId?)` — check before claiming

### Mutations

- `ensureWallet(userId)` — create wallet if missing
- `updateRedemptionPreference(userId, autoApply)`
- `updateMilesSafe(userId, milesSafe)`
- `redeemSelected(userId, option)`
- `claimContributionReward(userId, actionType, referenceId?)` — review | upload | referral

### Internal (scheduled)

- `addCreditForCompletedBooking(bookingId)` — invoked when booking reaches `"completed"` via `bookings.updateStatus` or `job_actuals.submitJobActuals`.

---

## 6. Booking → Credit flow

1. Booking completes (`updateStatus` or `submitJobActuals`).
2. Scheduler runs `internal.rewards.addCreditForCompletedBooking(bookingId)`.
3. Handler: get booking, verify completed and not already credited; look up vehicle tier; compute credit; credit wallet; insert ownership_credit_transaction and transaction; recompute 12‑month spend for that VIN; update or create vehicle_tiers with new tier.

---

## 7. Contribution hooks

**Contribution hooks** are the integration points where we must call `claimContributionReward` when the user completes an action:

| Action   | Credit     | Hook location                        | Status                      |
| -------- | ---------- | ------------------------------------ | --------------------------- |
| Review   | $5         | `reviews.submit` — after insert      | Not wired                   |
| Upload   | $10        | Upload service records flow          | Flow not built              |
| Referral | $25 (both) | When referee completes first service | Referrer tracking not built |

The mutation exists; it needs to be invoked from these flows.

---

## 8. UI

- **Membership:** `app/membership.tsx` — balance, tier badge, tier modal (Driver/Preferred/Elite), suggested deals, History (`/transactions`), Refer a Friend (`/refer-a-friend`), Add Car.
- **Suggested deals:** `app/suggested-deals.tsx` — `getAllDeals`.
- **Transactions:** `app/transactions.tsx` — `transactions.listForUser` for History.

---

## 9. Not implemented (V1+)

- Subscription path (Preferred $9.99/mo, Elite $24.99/mo)
- Tier benefits (diagnostics coverage, booking priority, price lock, concierge)
- Organic graduation messaging (“You’ve earned Preferred organically…”)
- Context switcher updating tier when switching vehicles in membership view
