/**
 * vehicleEnrichment/scraper.ts — FireCrawl scraping with Convex cache
 *
 * Two scraping modes:
 *
 * 1. Parts pages — DIRECT URL FETCH via fetchUrl() on known registry URLs.
 *    URLs are deterministic from make/model/trim/year. Each page returns:
 *    OEM part number + discount price + MSRP + supersession chain + fitment years.
 *    Fallback chain: year-specific URL → generic URL → skip (Batch 2 fills via web_search).
 *
 * 2. Owner's manual / maintenance schedule — SEARCH via searchAndFetch().
 *    No single known URL for maintenance schedules across all makes.
 *    Broad queries targeting dealer maintenance pages and manufacturer sites.
 *
 * Results are cached in `raw_scrape_cache` (30-day TTL).
 * A cache hit skips FireCrawl entirely.
 *
 * NOTE: Pricing is extracted by Batch 1 from parts pages (parts pages include
 * discount + MSRP for each part). No separate pricing scrape step needed.
 */

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { fetchUrl, searchAndFetch } from "./firecrawl";
import {
  getSourceConfig,
  getPartsPageUrls,
  getGenericPartsPageUrls,
  getManualSearchQueries,
  BLOCKED_DOMAINS,
} from "./sourceRegistry";
import type { VehicleInput } from "./types";

const TTL_PARTS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_MARKDOWN_CHARS = 40_000;
const MAX_PER_PAGE_CHARS =  8_000; // per-page cap when concatenating multiple pages

export interface ScrapedSources {
  partsMarkdown: string;
  manualMarkdown: string;
  partsSourceUrls: string[];
  manualSourceUrls: string[];
}

// ─── Parts + Manual ──────────────────────────────────────────────

/**
 * Scrape parts catalog (direct URL fetch) and owner's manual (search) for a vehicle.
 * Uses cache — only calls FireCrawl if no fresh cached result exists.
 */
export async function scrapeVehicleSources(
  ctx: ActionCtx,
  vehicle: VehicleInput,
): Promise<ScrapedSources> {
  const config = getSourceConfig(vehicle.make);

  if (!config) {
    console.warn(`[scraper] No source config for make: ${vehicle.make} — returning empty sources`);
    return { partsMarkdown: "", manualMarkdown: "", partsSourceUrls: [], manualSourceUrls: [] };
  }

  const yearSpecificUrls = getPartsPageUrls(config, vehicle);
  const genericUrls = getGenericPartsPageUrls(config, vehicle);
  const manualQueries = getManualSearchQueries(config, vehicle);

  const [partsResult, manualResult] = await Promise.allSettled([
    scrapePartsPages(ctx, vehicle, yearSpecificUrls, genericUrls),
    scrapeManual(ctx, vehicle, manualQueries),
  ]);

  const parts  = partsResult.status  === "fulfilled" ? partsResult.value  : { markdown: "", urls: [] };
  const manual = manualResult.status === "fulfilled" ? manualResult.value : { markdown: "", urls: [] };

  console.log(
    `[scraper] ${vehicle.year} ${vehicle.make} ${vehicle.model}: ` +
    `parts=${parts.markdown.length} chars (${parts.urls.length} pages), ` +
    `manual=${manual.markdown.length} chars (${manual.urls.length} src)`,
  );

  return {
    partsMarkdown:    parts.markdown,
    manualMarkdown:   manual.markdown,
    partsSourceUrls:  parts.urls,
    manualSourceUrls: manual.urls,
  };
}

// ─── Parts: direct URL fetch with generic fallback ────────────────

async function scrapePartsPages(
  ctx: ActionCtx,
  vehicle: VehicleInput,
  yearSpecificUrls: string[],
  genericUrls: string[],
): Promise<{ markdown: string; urls: string[] }> {
  // Check cache first
  const cached = await ctx.runQuery(
    internal.vehicleEnrichment.scraperQueries.getCachedScrape,
    { vehicleMake: vehicle.make, vehicleModel: vehicle.model, vehicleYear: vehicle.year, sourceType: "parts_catalog" },
  );
  if (cached) {
    console.log(`[scraper] Cache hit: parts_catalog for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    return { markdown: cached.markdown, urls: [cached.url] };
  }

  const hostname = yearSpecificUrls[0] ? new URL(yearSpecificUrls[0]).hostname : vehicle.make;
  console.log(`[scraper] Cache miss: parts_catalog — fetching ${yearSpecificUrls.length} pages from ${hostname}`);

  const markdownParts: string[] = [];
  const sourceUrls: string[] = [];
  let totalChars = 0;

  for (let i = 0; i < yearSpecificUrls.length; i++) {
    if (totalChars >= MAX_MARKDOWN_CHARS) break;

    // Try year-specific URL first, fall back to generic if empty/blocked
    let md = await fetchUrl(yearSpecificUrls[i]);
    let usedUrl = yearSpecificUrls[i];

    if ((!md || md.length < 100) && genericUrls[i]) {
      console.warn(`[scraper] Year-specific URL empty (${md?.length ?? 0} chars), trying generic: ${genericUrls[i]}`);
      md = await fetchUrl(genericUrls[i]);
      usedUrl = genericUrls[i];
    }

    if (!md || md.length < 100) {
      console.warn(`[scraper] Both URLs returned short/empty content — skipping (Batch 2 will fill via web_search)`);
      continue;
    }

    const chunk = md.slice(0, MAX_PER_PAGE_CHARS);
    markdownParts.push(`\n\n--- Parts Page: ${usedUrl} ---\n${chunk}`);
    sourceUrls.push(usedUrl);
    totalChars += chunk.length;
  }

  const markdown = markdownParts.join("").trim();
  console.log(`[scraper] Parts pages: ${sourceUrls.length}/${yearSpecificUrls.length} fetched, ${markdown.length} chars`);

  if (markdown.length > 0) {
    const now = Date.now();
    await ctx.runMutation(internal.vehicleEnrichment.scraperQueries.storeScrapeCache, {
      url: sourceUrls[0] ?? yearSpecificUrls[0],
      scrapedAt: now,
      markdown,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleYear: vehicle.year,
      sourceType: "parts_catalog",
      expiresAt: now + TTL_PARTS_MS,
    });
  }

  return { markdown, urls: sourceUrls };
}

// ─── Manual: search-based ─────────────────────────────────────────

async function scrapeManual(
  ctx: ActionCtx,
  vehicle: VehicleInput,
  queries: string[],
): Promise<{ markdown: string; urls: string[] }> {
  const cached = await ctx.runQuery(
    internal.vehicleEnrichment.scraperQueries.getCachedScrape,
    { vehicleMake: vehicle.make, vehicleModel: vehicle.model, vehicleYear: vehicle.year, sourceType: "owner_manual" },
  );
  if (cached) {
    console.log(`[scraper] Cache hit: owner_manual for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
    return { markdown: cached.markdown, urls: [cached.url] };
  }

  console.log(`[scraper] Cache miss: owner_manual — running ${queries.length} search queries`);

  const markdownParts: string[] = [];
  const sourceUrls: string[] = [];
  let totalChars = 0;

  for (const query of queries) {
    if (totalChars >= MAX_MARKDOWN_CHARS) break;

    const results = await searchAndFetch(query, 3);
    for (const r of results) {
      if (!r.markdown || totalChars >= MAX_MARKDOWN_CHARS) continue;
      const host = (() => { try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
      if (BLOCKED_DOMAINS.some((d) => host === d || host.endsWith("." + d))) {
        console.warn(`[scraper] Blocked domain skipped: ${r.url}`);
        continue;
      }
      const chunk = r.markdown.slice(0, MAX_PER_PAGE_CHARS);
      markdownParts.push(`\n\n--- Source: ${r.url} ---\n${chunk}`);
      sourceUrls.push(r.url);
      totalChars += chunk.length;
    }
  }

  const markdown = markdownParts.join("").trim();

  if (markdown.length > 0) {
    const now = Date.now();
    await ctx.runMutation(internal.vehicleEnrichment.scraperQueries.storeScrapeCache, {
      url: sourceUrls[0] ?? `scraped:${vehicle.make}:${vehicle.model}:owner_manual`,
      scrapedAt: now,
      markdown,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleYear: vehicle.year,
      sourceType: "owner_manual",
      expiresAt: now + TTL_PARTS_MS,
    });
  }

  return { markdown, urls: sourceUrls };
}
