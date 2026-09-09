import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const shopsSource = readFileSync(join(process.cwd(), "convex/shops.ts"), "utf8");
const mechanicsSource = readFileSync(join(process.cwd(), "convex/mechanics.ts"), "utf8");
const bookableShopSource = readFileSync(join(process.cwd(), "lib/bookableShop.ts"), "utf8");
const useShopsSource = readFileSync(join(process.cwd(), "hooks/useShopsFromConvex.ts"), "utf8");
const useMechanicsSource = readFileSync(join(process.cwd(), "hooks/useMechanicsFromConvex.ts"), "utf8");

test("booking shop list only returns shops ready to accept bookings", () => {
  assert.match(bookableShopSource, /export function isShopBookable/);
  assert.match(bookableShopSource, /shop\?\.is_active !== false/);
  assert.match(bookableShopSource, /shop\?\.onboarding_complete === true/);
  assert.match(bookableShopSource, /shop\?\.stripe_connect_account_id/);
  assert.match(bookableShopSource, /shop\?\.stripe_charges_enabled === true/);
  assert.match(bookableShopSource, /shop\?\.stripe_payouts_enabled === true/);
  assert.match(bookableShopSource, /getStripeRequirements\(shop\)\.length === 0/);
  assert.match(bookableShopSource, /shop\?\.labor_rate/);
  assert.match(shopsSource, /getBookableShopIds/);
  assert.match(shopsSource, /return shops\.filter\(\(shop\) => bookableShopIds\.has\(shop\._id\)\)/);
});

test("booking mechanic list excludes mechanics from unbookable shops", () => {
  assert.match(mechanicsSource, /getBookableShopIds/);
  assert.match(mechanicsSource, /const bookableShopIds = await getBookableShopIds\(ctx, shops\)/);
  assert.match(mechanicsSource, /if \(!bookableShopIds\.has\(mechanic\.shop_id\)\) return null/);
});

test("booking stores are cleared when no bookable shops or mechanics remain", () => {
  assert.match(useShopsSource, /if \(convexShops !== undefined && shopServicesList !== undefined\) \{/);
  assert.match(useShopsSource, /setShops\(shops\)/);
  assert.doesNotMatch(useShopsSource, /if \(shops\.length > 0\)/);
  assert.match(useMechanicsSource, /if \(convexMechanics !== undefined\) \{/);
  assert.match(useMechanicsSource, /setMechanics\(mechanics\)/);
  assert.doesNotMatch(useMechanicsSource, /if \(mechanics\.length > 0\)/);
});
