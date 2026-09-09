/**
 * Root-level Transactions route
 *
 * PURPOSE: When navigating from membership (points page) → History, use this route
 *          so that router.back() returns to membership instead of switching tabs.
 *
 * USED IN: router.push("/transactions") from membership History button
 */

export { default } from "./settings/transactions";
