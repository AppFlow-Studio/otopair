import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export type TireTier = "elite" | "select" | "standard" | "unlisted";

const TIER_VALIDATOR = v.union(
  v.literal("elite"),
  v.literal("select"),
  v.literal("standard"),
  v.literal("unlisted"),
);

// ─── Queries ──────────────────────────────────────────────────────

/** Returns all brand strings sorted longest-first so multi-word brands match greedily. */
export const getBrandNames = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("tire_brands").collect();
    return rows.map((r) => r.brand).sort((a, b) => b.length - a.length);
  },
});

export const getByBrand = internalQuery({
  args: { brand: v.string() },
  handler: async (ctx, { brand }) => {
    return await ctx.db
      .query("tire_brands")
      .withIndex("by_brand", (q) => q.eq("brand", brand))
      .first();
  },
});

export const getByTier = query({
  args: { tier: TIER_VALIDATOR },
  handler: async (ctx, { tier }) => {
    return await ctx.db
      .query("tire_brands")
      .withIndex("by_tier", (q) => q.eq("tier", tier))
      .collect();
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tire_brands").collect();
  },
});

// ─── Mutations ────────────────────────────────────────────────────

export const upsert = internalMutation({
  args: {
    brand: v.string(),
    tier: TIER_VALIDATOR,
    parent_company: v.optional(v.string()),
    is_sub_brand: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tire_brands")
      .withIndex("by_brand", (q) => q.eq("brand", args.brand))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        parent_company: args.parent_company ?? existing.parent_company,
        is_sub_brand: args.is_sub_brand ?? existing.is_sub_brand,
      });
      return existing._id;
    }
    return await ctx.db.insert("tire_brands", args);
  },
});

export const updateTier = mutation({
  args: { brand: v.string(), tier: TIER_VALIDATOR },
  handler: async (ctx, { brand, tier }) => {
    const existing = await ctx.db
      .query("tire_brands")
      .withIndex("by_brand", (q) => q.eq("brand", brand))
      .first();
    if (!existing) throw new Error(`Brand not found: ${brand}`);
    await ctx.db.patch(existing._id, { tier });
  },
});

// ─── Seed data ────────────────────────────────────────────────────
// Tiers: brand → tier. Parent company info kept in PARENT_INFO below.

const TIRE_TIERS: Record<string, TireTier> = {
  // ── Elite ────────────────────────────────────────────────────────
  Michelin:       "elite",
  Continental:    "elite",
  Bridgestone:    "elite",
  Pirelli:        "elite",
  Goodyear:       "elite",
  Nokian:         "elite",

  // ── Select ───────────────────────────────────────────────────────
  Hankook:            "select",
  BFGoodrich:         "select",
  Cooper:             "select",
  General:            "select",
  "General Tire":     "select",
  Firestone:          "select",
  Yokohama:           "select",
  Toyo:               "select",
  Falken:             "select",
  Dunlop:             "select",
  Nitto:              "select",
  Sumitomo:           "select",
  Maxxis:             "select",
  Vredestein:         "select",
  Kumho:              "select",
  Nexen:              "select",
  Roadstone:          "select",
  Laufenn:            "select",
  Mastercraft:        "select",
  Kelly:              "select",
  Uniroyal:           "select",
  "Mickey Thompson":  "select",
  Hoosier:            "select",
  Metzeler:           "select",
  Apollo:             "select",
  BKT:                "select",
  "GT Radial":        "select",
  Giti:               "select",
  Ohtsu:              "select",
  Kleber:             "select",
  Gislaved:           "select",
  Semperit:           "select",
  Riken:              "select",
  Kenda:              "select",
  Nankang:            "select",
  Federal:            "select",
  CST:                "select",

  // ── Standard ─────────────────────────────────────────────────────
  // Elite-parent budget/value lines
  Dayton:             "standard",
  Fuzion:             "standard",
  Lemans:             "standard",
  Peerless:           "standard",
  Starfire:           "standard",
  Dean:               "standard",
  Fierce:             "standard",
  Fulda:              "standard",
  Sava:               "standard",
  Debica:             "standard",
  Sebring:            "standard",
  Douglas:            "standard",
  Roadmaster:         "standard",
  Avon:               "standard",
  "Duck Commander":   "standard",
  "Dick Cepek":       "standard",
  Tigar:              "standard",
  Kormoran:           "standard",
  Taurus:             "standard",
  Warrior:            "standard",
  Camso:              "standard",
  Barum:              "standard",
  Matador:            "standard",
  Viking:             "standard",
  Mabor:              "standard",
  Sportiva:           "standard",
  Formula:            "standard",
  Nordman:            "standard",
  Primewell:          "standard",
  Dextero:            "standard",
  Runway:             "standard",
  // Korean budget
  Marshal:            "standard",
  Kingstar:           "standard",
  Aurora:             "standard",
  // TBC Corporation
  Hercules:           "standard",
  Ironman:            "standard",
  "Multi-Mile":       "standard",
  Sigma:              "standard",
  Cordovan:           "standard",
  Vanderbilt:         "standard",
  Eldorado:           "standard",
  Telstar:            "standard",
  Jetzon:             "standard",
  "Harvest King":     "standard",
  "Power King":       "standard",
  National:           "standard",
  Akuret:             "standard",
  Delta:              "standard",
  "Wild Country":     "standard",
  "Trailer King":     "standard",
  Sumic:              "standard",
  Doral:              "standard",
  Finalist:           "standard",
  // Retailer house brands
  Arizonian:          "standard",
  Pathfinder:         "standard",
  "Road Hugger":      "standard",
  Hartland:           "standard",
  Mohave:             "standard",
  Corsa:              "standard",
  Phantom:            "standard",
  RAGE:               "standard",
  "Rocky Mountain":   "standard",
  Sentury:            "standard",
  Taskmaster:         "standard",
  Avix:               "standard",
  "Range Finder":     "standard",
  Cornell:            "standard",
  Futura:             "standard",
  Definity:           "standard",
  "American Tourer":  "standard",
  Legacy:             "standard",
  Interstate:         "standard",
  "Member's Mark":    "standard",
  // Chinese / budget
  Accelera:           "standard",
  Achilles:           "standard",
  Advance:            "standard",
  Advanta:            "standard",
  Aeolus:             "standard",
  Altenzo:            "standard",
  Amberstone:         "standard",
  "American Roadstar": "standard",
  Annaite:            "standard",
  Antares:            "standard",
  Aoteli:             "standard",
  Aplus:              "standard",
  Aptany:             "standard",
  "Arctic Claw":      "standard",
  Arisun:             "standard",
  Armstrong:          "standard",
  Arroyo:             "standard",
  Atlander:           "standard",
  Atlas:              "standard",
  Atturo:             "standard",
  BlackHawk:          "standard",
  Blacklion:          "standard",
  Boto:               "standard",
  Celimo:             "standard",
  Centennial:         "standard",
  Chaoyang:           "standard",
  Comforser:          "standard",
  Compasal:           "standard",
  Constancy:          "standard",
  Cosmo:              "standard",
  Crosswind:          "standard",
  Dcenti:             "standard",
  Deestone:           "standard",
  Delinte:            "standard",
  Diamondback:        "standard",
  "Double Coin":      "standard",
  Doublestar:         "standard",
  Duraturn:           "standard",
  Durun:              "standard",
  Evoluxx:            "standard",
  Farroad:            "standard",
  Firemax:            "standard",
  Forceland:          "standard",
  Forceum:            "standard",
  Fortune:            "standard",
  Fullrun:            "standard",
  Fullway:            "standard",
  Gladiator:          "standard",
  Goodride:           "standard",
  Greentrac:          "standard",
  Gremax:             "standard",
  Gripmax:            "standard",
  Groundspeed:        "standard",
  Haida:              "standard",
  Headway:            "standard",
  Hifly:              "standard",
  "Hi Run":           "standard",
  Infinity:           "standard",
  Ironhead:           "standard",
  "JK Tyre":          "standard",
  Joyroad:            "standard",
  Kanati:             "standard",
  Kapsen:             "standard",
  Kpatos:             "standard",
  Lancaster:          "standard",
  LandGolden:         "standard",
  Landgolden:         "standard",
  Landsail:           "standard",
  Landspider:         "standard",
  Lanvigator:         "standard",
  Leao:               "standard",
  Lexani:             "standard",
  Linglong:           "standard",
  Lionhart:           "standard",
  "Long March":       "standard",
  Mastertrack:        "standard",
  Maxam:              "standard",
  Maxtrek:            "standard",
  Mazzini:            "standard",
  Milestar:           "standard",
  Minerva:            "standard",
  Momo:               "standard",
  Montreal:           "standard",
  MRF:                "standard",
  Nanco:              "standard",
  NeoTerra:           "standard",
  Otani:              "standard",
  Pace:               "standard",
  Pantera:            "standard",
  Petlas:             "standard",
  Powertrac:          "standard",
  Premiorri:          "standard",
  Prinx:              "standard",
  Radar:              "standard",
  RoadOne:            "standard",
  RoadX:              "standard",
  Rotalla:            "standard",
  Rovelo:             "standard",
  "Royal Black":      "standard",
  Rydanz:             "standard",
  Sailun:             "standard",
  Samson:             "standard",
  Sunny:              "standard",
  SunFull:            "standard",
  SuperMax:           "standard",
  Summit:             "standard",
  Thunderer:          "standard",
  Tourador:           "standard",
  Tracmax:            "standard",
  Transeagle:         "standard",
  Travelstar:         "standard",
  "Tri-Ace":          "standard",
  Triangle:           "standard",
  "Venom Power":      "standard",
  Vercelli:           "standard",
  Vitour:             "standard",
  Vogue:              "standard",
  Wanli:              "standard",
  Waterfall:          "standard",
  Westlake:           "standard",
  Windforce:          "standard",
  Winrun:             "standard",
  Zeetex:             "standard",
  Zenna:              "standard",
  Zeta:               "standard",
  Zestino:            "standard",
  "Green Max":        "standard",
  TBB:                "standard",
  // Specialty / ag / OTR
  Alliance:           "standard",
  Galaxy:             "standard",
  Mitas:              "standard",
  Trelleborg:         "standard",
  Carlisle:           "standard",
  Carlstar:           "standard",
  Titan:              "standard",
  Interco:            "standard",
  GBC:                "standard",
  ITP:                "standard",
  "Pro Comp":         "standard",
  "Mud Claw":         "standard",
  CEAT:               "standard",
  EuroGrip:           "standard",
  Rosava:             "standard",
  Starmaxx:           "standard",
  Coker:              "standard",
  Suretrac:           "standard",
  Vantage:            "standard",
  Versatyre:          "standard",
  Vizzoni:            "standard",
  Pegasus:            "standard",
  Predator:           "standard",
};

// Parent company info for known sub-brands
const PARENT_INFO: Record<string, { parent_company: string; is_sub_brand: boolean }> = {
  BFGoodrich:         { parent_company: "Michelin",     is_sub_brand: true },
  Kleber:             { parent_company: "Michelin",     is_sub_brand: true },
  Riken:              { parent_company: "Michelin",     is_sub_brand: true },
  Uniroyal:           { parent_company: "Michelin",     is_sub_brand: true },
  Tigar:              { parent_company: "Michelin",     is_sub_brand: true },
  Kormoran:           { parent_company: "Michelin",     is_sub_brand: true },
  Taurus:             { parent_company: "Michelin",     is_sub_brand: true },
  Warrior:            { parent_company: "Michelin",     is_sub_brand: true },
  Camso:              { parent_company: "Michelin",     is_sub_brand: true },
  Cooper:             { parent_company: "Goodyear",     is_sub_brand: true },
  "Mickey Thompson":  { parent_company: "Goodyear",     is_sub_brand: true },
  Kelly:              { parent_company: "Goodyear",     is_sub_brand: true },
  Mastercraft:        { parent_company: "Goodyear",     is_sub_brand: true },
  Dunlop:             { parent_company: "Sumitomo",     is_sub_brand: true },
  Starfire:           { parent_company: "Goodyear",     is_sub_brand: true },
  Dean:               { parent_company: "Goodyear",     is_sub_brand: true },
  Fierce:             { parent_company: "Goodyear",     is_sub_brand: true },
  Fulda:              { parent_company: "Goodyear",     is_sub_brand: true },
  Sava:               { parent_company: "Goodyear",     is_sub_brand: true },
  Debica:             { parent_company: "Goodyear",     is_sub_brand: true },
  Sebring:            { parent_company: "Goodyear",     is_sub_brand: true },
  Douglas:            { parent_company: "Goodyear",     is_sub_brand: true },
  Roadmaster:         { parent_company: "Goodyear",     is_sub_brand: true },
  Avon:               { parent_company: "Goodyear",     is_sub_brand: true },
  "Dick Cepek":       { parent_company: "Goodyear",     is_sub_brand: true },
  "Duck Commander":   { parent_company: "Cooper",       is_sub_brand: true },
  Firestone:          { parent_company: "Bridgestone",  is_sub_brand: true },
  Dayton:             { parent_company: "Bridgestone",  is_sub_brand: true },
  Fuzion:             { parent_company: "Bridgestone",  is_sub_brand: true },
  General:            { parent_company: "Continental",  is_sub_brand: true },
  "General Tire":     { parent_company: "Continental",  is_sub_brand: true },
  Barum:              { parent_company: "Continental",  is_sub_brand: true },
  Matador:            { parent_company: "Continental",  is_sub_brand: true },
  Viking:             { parent_company: "Continental",  is_sub_brand: true },
  Sportiva:           { parent_company: "Continental",  is_sub_brand: true },
  Gislaved:           { parent_company: "Continental",  is_sub_brand: true },
  Semperit:           { parent_company: "Continental",  is_sub_brand: true },
  Hoosier:            { parent_company: "Continental",  is_sub_brand: true },
  Falken:             { parent_company: "Sumitomo",     is_sub_brand: true },
  Ohtsu:              { parent_company: "Sumitomo",     is_sub_brand: true },
  Nitto:              { parent_company: "Toyo",         is_sub_brand: true },
  Laufenn:            { parent_company: "Hankook",      is_sub_brand: true },
  Kingstar:           { parent_company: "Hankook",      is_sub_brand: true },
  Aurora:             { parent_company: "Hankook",      is_sub_brand: true },
  Vredestein:         { parent_company: "Apollo",       is_sub_brand: true },
  Metzeler:           { parent_company: "Pirelli",      is_sub_brand: true },
  Formula:            { parent_company: "Pirelli",      is_sub_brand: true },
  Nordman:            { parent_company: "Nokian",       is_sub_brand: true },
  Marshal:            { parent_company: "Kumho",        is_sub_brand: true },
  "GT Radial":        { parent_company: "Giti",         is_sub_brand: true },
  Primewell:          { parent_company: "Giti",         is_sub_brand: true },
  Dextero:            { parent_company: "Giti",         is_sub_brand: true },
  Runway:             { parent_company: "Giti",         is_sub_brand: true },
  Rydanz:             { parent_company: "Giti",         is_sub_brand: true },
  Thunderer:          { parent_company: "Giti",         is_sub_brand: true },
  CST:                { parent_company: "Maxxis",       is_sub_brand: true },
  BlackHawk:          { parent_company: "Sailun",       is_sub_brand: true },
  RoadX:              { parent_company: "Sailun",       is_sub_brand: true },
  Rovelo:             { parent_company: "Sailun",       is_sub_brand: true },
  Atlas:              { parent_company: "Linglong",     is_sub_brand: true },
  Crosswind:          { parent_company: "Linglong",     is_sub_brand: true },
  Evoluxx:            { parent_company: "Linglong",     is_sub_brand: true },
  Infinity:           { parent_company: "Linglong",     is_sub_brand: true },
  Leao:               { parent_company: "Linglong",     is_sub_brand: true },
  Aplus:              { parent_company: "Linglong",     is_sub_brand: true },
  Delinte:            { parent_company: "Sentury",      is_sub_brand: true },
  Landsail:           { parent_company: "Sentury",      is_sub_brand: true },
  Alliance:           { parent_company: "Yokohama",     is_sub_brand: true },
  Galaxy:             { parent_company: "Yokohama",     is_sub_brand: true },
  Mitas:              { parent_company: "Yokohama",     is_sub_brand: true },
  Westlake:           { parent_company: "ZC Rubber",    is_sub_brand: false },
  Goodride:           { parent_company: "ZC Rubber",    is_sub_brand: false },
  Chaoyang:           { parent_company: "ZC Rubber",    is_sub_brand: false },
};

// ─── Seed mutation ────────────────────────────────────────────────

export const seedTireBrands = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0, updated = 0;

    for (const [brand, tier] of Object.entries(TIRE_TIERS)) {
      const parentInfo = PARENT_INFO[brand];
      const existing = await ctx.db
        .query("tire_brands")
        .withIndex("by_brand", (q) => q.eq("brand", brand))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          tier,
          parent_company: parentInfo?.parent_company ?? existing.parent_company,
          is_sub_brand: parentInfo?.is_sub_brand ?? existing.is_sub_brand,
        });
        updated++;
      } else {
        await ctx.db.insert("tire_brands", {
          brand,
          tier,
          parent_company: parentInfo?.parent_company,
          is_sub_brand: parentInfo?.is_sub_brand,
        });
        inserted++;
      }
    }

    return { inserted, updated, total: inserted + updated };
  },
});
