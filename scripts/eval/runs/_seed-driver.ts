import { configFromEnv, seedTenants } from "../lib/multiTenantSetup";

(async () => {
  try {
    const cfg = configFromEnv();
    console.log("config: url=" + cfg.url + " authKey.length=" + cfg.authKey.length);
    const tenants = await seedTenants(cfg);
    console.log(JSON.stringify(tenants, null, 2));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("SEED FAILED:", msg);
    process.exit(1);
  }
})();
