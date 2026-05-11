// =============================================================================
// Oto AI — Tool Dispatcher (Phase 1, v2 scaffold)
// =============================================================================
//
// Executes a single Anthropic `tool_use` block: looks up the tool by name,
// routes to a data query / render packager / navigation packager, and returns
// a Convex-style `tool_result` block ready to append to the next Anthropic call.
//
// Three categories (see convex/oto/tools.ts):
//   • data       — calls ctx.runQuery, sanitizes result, returns envelope
//   • render     — no DB call; packages args into a ChatMessage field. The
//                  chat action merges multiple render results into one
//                  assistant message envelope when assembling the final turn.
//   • navigation — Phase 1 only has navigate_to_payment. Packages a route
//                  directive the React Native client interprets.
//
// What this file IS:
//   • Switchboard the chat action calls per tool_use block.
//   • Identity-injection point: userId is server-resolved from ctx.auth and
//     passed in — the AI never sees it (State Contract §5).
//   • Sanitization point: strips stripe_*, labor_rate, email, reviewer PII,
//     internal flags before results enter AI context.
//
// What this file is NOT:
//   • The chat action itself. The full sendMessage action (prompt build,
//     Anthropic call, tool-use loop, persistence to ai_messages) is wired
//     separately per Runtime Architecture §6.
//   • Production-finished. Tools marked [NOT YET IMPLEMENTED] need backing
//     Convex queries first — see inventory.md Schema Gaps.
//
// Companions:
//   • convex/oto/tools.ts             — schemas (cached zone)
//   • docs/oto-ai/tool-inventory.md   — what maps to what, gaps, open Qs
//   • docs/oto-ai/handoff-addendum.md — locked Section 4.5 (the render-vs-
//                                       navigate principle + services taxonomy)
// =============================================================================

import { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { OTO_TOOL_CATEGORY, OTOPAIR_SERVICE_SLUGS } from "./tools";

// -----------------------------------------------------------------------------
// Types — Anthropic content blocks (mirrors the API surface; not imported from
// the SDK so this file stays Convex-runtime-friendly).
// -----------------------------------------------------------------------------

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string; // JSON-stringified envelope
  is_error?: boolean;
}

interface OkEnvelope<T> {
  status: "ok";
  data: T;
}

interface ErrorEnvelope {
  status: "error";
  code:
    | "unknown_tool"
    | "invalid_args"
    | "not_implemented"
    | "not_authorized"
    | "not_found"
    | "upstream_failure";
  message: string;
}

type Envelope<T> = OkEnvelope<T> | ErrorEnvelope;

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

export async function executeTool(
  ctx: ActionCtx,
  toolUse: ToolUseBlock,
  userId: Id<"users">,
): Promise<ToolResultBlock> {
  const category = OTO_TOOL_CATEGORY[toolUse.name];
  if (!category) {
    return errorResult(
      toolUse.id,
      "unknown_tool",
      `Tool "${toolUse.name}" is not registered. The schema and dispatcher are out of sync.`,
    );
  }

  try {
    if (category === "render") return packageRenderDirective(toolUse);
    if (category === "navigation") return packageNavigationIntent(toolUse);
    return await executeDataTool(ctx, toolUse, userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(toolUse.id, "upstream_failure", message);
  }
}

// =============================================================================
// DATA TOOL DISPATCH
// =============================================================================

async function executeDataTool(
  ctx: ActionCtx,
  toolUse: ToolUseBlock,
  userId: Id<"users">,
): Promise<ToolResultBlock> {
  const input = toolUse.input;

  switch (toolUse.name) {
    // -------------------------------------------------------------------------
    case "get_my_vehicles": {
      // vehicles.getMyVehicles is auth-scoped natively.
      const result = await ctx.runQuery(api.vehicles.getMyVehicles, {});
      const sanitized = (result ?? []).map((row: any) => ({
        vin: row.vin,
        is_primary: row.ownership?.is_primary === true,
        year: row.vehicle?.metadata?.year ?? null,
        make: row.vehicle?.metadata?.make ?? null,
        model: row.vehicle?.metadata?.model ?? null,
        trim: row.vehicle?.metadata?.trim ?? null,
        mileage: row.ownership?.current_mileage ?? null,
      }));
      return ok(toolUse.id, sanitized);
    }

    // -------------------------------------------------------------------------
    case "get_bookings": {
      const status = input.status_filter as "active" | "completed" | "all";
      const limit = (input.limit as number | undefined) ?? 5;

      const all = await ctx.runQuery(api.bookings.getByUserIdWithDetails, {
        userId,
      });
      const ACTIVE = new Set(["pending", "confirmed", "in_progress"]);
      const filtered = (all ?? []).filter((b: any) => {
        if (status === "all") return true;
        if (status === "active") return ACTIVE.has(b.status);
        return b.status === "completed";
      });
      return ok(
        toolUse.id,
        filtered.slice(0, limit).map((b: any) => ({
          id: b._id,
          status: b.status,
          service_names: b.serviceNames ?? [],
          shop_name: b.shopName ?? null,
          mechanic_name: b.mechanicName ?? null,
          scheduled_at: b.scheduled_at ?? null,
          vehicle_display: b.vehicleDisplay ?? null,
          // total_cost pending Open Question Q4 confirmation.
          total_cost: b.total_cost ?? null,
        })),
      );
    }

    // -------------------------------------------------------------------------
    case "get_due_services": {
      // [NOT YET IMPLEMENTED] — Schema Gap 1.
      // Needs: a public query on vehicle_service_states scoped by (userId, vin):
      //   1. Resolve vin → vehicle_owners._id for THIS userId (auth scoping)
      //   2. Read vehicle_service_states by vehicle_owner_id
      //   3. Join service_id → services to get slug + name
      //   4. Return [{ service_slug, service_name, urgency,
      //               due_at_mileage?, due_at_date?, quick_read_flag? }]
      //   5. Throw "not_authorized" if vin isn't owned by userId.
      return errorResult(
        toolUse.id,
        "not_implemented",
        "get_due_services requires a public query for vehicle_service_states scoped by (userId, vin). See inventory.md Schema Gap 1.",
      );
    }

    // -------------------------------------------------------------------------
    case "list_service_categories": {
      const categories = await ctx.runQuery(api.service_categories.list, {});
      const projected = (categories ?? [])
        .map((c: any) => ({
          id: c._id,
          name: c.name,
          icon_name: c.icon_name ?? null,
          display_order: c.display_order ?? 0,
        }))
        .sort((a: any, b: any) => a.display_order - b.display_order);
      return ok(toolUse.id, projected);
    }

    // -------------------------------------------------------------------------
    case "list_services_for_vehicle": {
      // [NOT YET IMPLEMENTED] — Schema Gap 4 (the headline gap).
      // Needs a query that:
      //   1. Resolves vin → vehicles → vehicle_configs → { engine, drivetrain,
      //      chassis_specs.steering_type, trim_specs.is_staggered, ... }
      //   2. Reads vehicle_owner_specs.confirmed_packages (impacts brake/tire)
      //   3. Loads all 23 services rows, applies requires_* filters:
      //      • requires_ice_engine        → exclude EVs
      //      • requires_timing_belt       → exclude chain-driven engines
      //      • requires_hydraulic_ps      → exclude electric power steering
      //      • requires_differential      → exclude FWD without differential
      //      • requires_rotatable_tires   → exclude staggered/non-symmetric
      //      • requires_state_inspection  → state-aware (Open Q6)
      //      • requires_emissions_test    → state-aware (Open Q6)
      //      • min_model_year             → vehicle.year < min_model_year
      //      • requires_serpentine_belt   → engines.has_serpentine_belt = false
      //   4. Optionally filter by category (joined from service_categories.name)
      //   5. Return [{ slug, name, description, category, default_labor_hours,
      //                parts_low?, parts_high?, has_options }]
      // See inventory.md Section 5 Gap 4 for the full join chain.
      const _vehicleId = input.vehicle_id as string;
      const _category = input.category as string | undefined;
      void _vehicleId;
      void _category;
      return errorResult(
        toolUse.id,
        "not_implemented",
        "list_services_for_vehicle requires a new query joining vehicles × vehicle_configs × engines × chassis_specs × trim_specs × services with requires_* filtering. See inventory.md Schema Gap 4 — this is the highest-value Phase 1 backend work.",
      );
    }

    // -------------------------------------------------------------------------
    case "get_service_details": {
      const slug = input.service_slug as string;
      if (!OTOPAIR_SERVICE_SLUGS.includes(slug as any)) {
        return errorResult(
          toolUse.id,
          "invalid_args",
          `Unknown service slug "${slug}". Valid slugs: ${OTOPAIR_SERVICE_SLUGS.join(", ")}.`,
        );
      }
      // services.list returns all 23; find by slug. A dedicated services.getBySlug
      // would be a tiny optimization — see inventory.md Schema Gap (TBD if needed).
      const all = await ctx.runQuery(api.services.list, {});
      const svc = (all ?? []).find((s: any) => s.slug === slug);
      if (!svc) return errorResult(toolUse.id, "not_found", `Service "${slug}" not in catalog.`);

      // Load options if applicable.
      let options: any[] = [];
      if (svc.has_options) {
        // [PARTIAL] service_options.getByServiceId not confirmed to exist — verify
        // and either call it or fold a query into services.list.
        try {
          options = await ctx.runQuery(api.service_options.getByServiceId as any, {
            service_id: svc._id,
          });
        } catch {
          options = [];
        }
      }

      return ok(toolUse.id, {
        slug: svc.slug,
        name: svc.name,
        description: svc.description ?? null,
        category: svc.category?.name ?? null,
        default_labor_hours: svc.default_labor_hours ?? null,
        has_options: svc.has_options === true,
        is_labor_only: svc.is_labor_only === true,
        parts_low: svc.default_parts_estimate?.low ?? null,
        parts_high: svc.default_parts_estimate?.high ?? null,
        options: options.map((o: any) => ({
          label: o.option_label,
          type: o.option_type ?? null,
          labor_hours: o.labor_hours ?? null,
          parts_low: o.parts_cost_low ?? null,
          parts_high: o.parts_cost_high ?? null,
        })),
      });
    }

    // -------------------------------------------------------------------------
    case "get_shop": {
      const shop = await ctx.runQuery(api.shops.getById, {
        id: input.shop_id as Id<"shops">,
      });
      if (!shop) return errorResult(toolUse.id, "not_found", `Shop ${input.shop_id} not found.`);
      return ok(toolUse.id, sanitizeShop(shop));
    }

    // -------------------------------------------------------------------------
    case "get_shop_services": {
      const offered = await ctx.runQuery(api.shop_services.getByShopId, {
        shopId: input.shop_id as Id<"shops">,
      });
      const projected = (offered ?? []).map((row: any) => ({
        service_slug: row.service?.slug ?? null,
        service_name: row.service?.name ?? null,
        is_offered: row.is_offered !== false,
      }));
      return ok(toolUse.id, projected);
    }

    // -------------------------------------------------------------------------
    case "get_shop_hours": {
      // [NOT YET IMPLEMENTED] — Schema Gap 2.
      // Needs shops_hours.getByShopId(shopId). shops_hours.list is too broad.
      return errorResult(
        toolUse.id,
        "not_implemented",
        "get_shop_hours requires shops_hours.getByShopId. See inventory.md Schema Gap 2.",
      );
    }

    // -------------------------------------------------------------------------
    case "get_mechanic": {
      const mechanic = await ctx.runQuery(api.mechanics.getById, {
        id: input.mechanic_id as Id<"mechanics">,
      });
      if (!mechanic) {
        return errorResult(toolUse.id, "not_found", `Mechanic ${input.mechanic_id} not found.`);
      }
      return ok(toolUse.id, sanitizeMechanic(mechanic));
    }

    // -------------------------------------------------------------------------
    case "get_my_mechanics": {
      const result = await ctx.runQuery(api.mechanics.getMyMechanicsForUser, {
        userId,
      });
      const project = (list: any[] | undefined) =>
        (list ?? []).map((m: any) => sanitizeMechanic(m));
      return ok(toolUse.id, {
        favorites: project(result?.favorites),
        recently_booked: project(result?.recentlyBooked),
        hidden: project(result?.hidden),
      });
    }

    // -------------------------------------------------------------------------
    case "get_reviews": {
      const targetType = input.target_type as "shop" | "mechanic";
      const targetId = input.target_id as string;
      const limit = (input.limit as number | undefined) ?? 5;

      const raw =
        targetType === "shop"
          ? await ctx.runQuery(api.reviews.getByShopId, { shopId: targetId as Id<"shops"> })
          : await ctx.runQuery(api.reviews.getByMechanicId, {
              mechanicId: targetId as Id<"mechanics">,
            });

      return ok(
        toolUse.id,
        (raw ?? []).slice(0, limit).map((r: any) => ({
          rating: r.rating,
          comment: r.comment ?? null,
          created_at: r.created_at ?? r._creationTime,
          // Reviewer PII stripped — see inventory Schema Gap 5.
          reviewer_initials: initialsOf(r.user?.name ?? r.user?.first_name ?? null),
        })),
      );
    }

    // -------------------------------------------------------------------------
    case "find_available_slots": {
      const slots = await ctx.runQuery(api.time_slots.getNextAvailableByShop, {
        shopId: input.shop_id as Id<"shops">,
        mechanicId: (input.mechanic_id as Id<"mechanics"> | undefined) ?? undefined,
        limit: (input.limit as number | undefined) ?? 5,
      });
      return ok(
        toolUse.id,
        (slots ?? []).map((s: any) => ({
          slot_id: s._id,
          date: s.date,
          start_time: s.start_time,
          mechanic_id: s.mechanic_id ?? null,
          mechanic_name: s.mechanicName ?? null,
        })),
      );
    }

    // -------------------------------------------------------------------------
    case "get_rewards_summary": {
      const [wallet, stats, tier] = await Promise.all([
        ctx.runQuery(api.rewards.getWallet, { userId }),
        ctx.runQuery(api.rewards.getMembershipStats, { userId }),
        ctx.runQuery(api.rewards.getPrimaryVehicleTier, { userId }),
      ]);
      return ok(toolUse.id, {
        credit_balance: wallet?.balance ?? 0,
        miles_safe: stats?.milesSafe ?? 0,
        services_completed: stats?.services ?? 0,
        shops_visited: stats?.shops ?? 0,
        vehicle_tier: tier?.tier ?? null,
      });
    }

    // -------------------------------------------------------------------------
    default:
      return errorResult(
        toolUse.id,
        "unknown_tool",
        `Tool "${toolUse.name}" is registered as a data tool but has no dispatcher branch.`,
      );
  }
}

// =============================================================================
// RENDER DIRECTIVE PACKAGING
// =============================================================================
//
// Each render tool produces a directive of the shape:
//   { type: "render", field: <ChatMessage key>, value: <field value> }
//
// The chat action collects all render directives emitted in one turn and
// merges them into the assistant ChatMessage envelope before persisting and
// returning to the client. Field names match services/ai/types.ts:ChatMessage
// 1:1.
//
// Gap 6 / Gap 7: `timeSlots` and `bookingSummary` are envelope EXTENSIONS not
// yet present on ChatMessage. Adding them is the lightest change needed to
// preserve the render-vs-navigate principle for the booking-confirmation
// stage. See inventory.md.

interface RenderDirective<T = unknown> {
  type: "render";
  field: string;
  value: T;
}

function packageRenderDirective(toolUse: ToolUseBlock): ToolResultBlock {
  switch (toolUse.name) {
    case "render_shop_carousel":
      return ok(toolUse.id, renderD("shops", toolUse.input.shops));

    case "render_service_picker":
      return ok(toolUse.id, {
        type: "render",
        // The chat handler sets `showServicePicker: true` and, if `services`
        // is passed, also sets `pickerServices: <list>` (envelope extension —
        // optional, current chat handler falls back to DEFAULT_SERVICES).
        directives: [
          { field: "showServicePicker", value: true },
          ...(toolUse.input.services ? [{ field: "pickerServices", value: toolUse.input.services }] : []),
        ],
      });

    case "render_time_selector":
      return ok(toolUse.id, {
        type: "render",
        // Envelope extension — see Gap 6.
        directives: [
          { field: "timeSlots", value: toolUse.input.slots },
          { field: "timeSlotsShopId", value: toolUse.input.shop_id },
        ],
      });

    case "render_booking_confirmation":
      return ok(toolUse.id, renderD("bookingSummary", toolUse.input.summary));

    case "render_quick_replies":
      return ok(toolUse.id, renderD("quickReplies", toolUse.input.replies));

    case "render_reasoning":
      return ok(toolUse.id, renderD("reasoning", toolUse.input.steps));

    case "render_sources":
      return ok(toolUse.id, renderD("sources", toolUse.input.sources));

    default:
      return errorResult(
        toolUse.id,
        "unknown_tool",
        `Render tool "${toolUse.name}" has no packager branch.`,
      );
  }
}

function renderD<T>(field: string, value: T): RenderDirective<T> {
  return { type: "render", field, value };
}

// =============================================================================
// NAVIGATION PACKAGING
// =============================================================================
//
// Phase 1 has exactly ONE navigation case: payment.
// Route matches `app/(main-tabs)/ai-chat/index.tsx:619`:
//   router.push(`/home/mechanic/${mechanic.id}/payment`)
// The chat action returns this intent in its response payload; the React
// Native client triggers the navigation after rendering the AI's prose.

function packageNavigationIntent(toolUse: ToolUseBlock): ToolResultBlock {
  if (toolUse.name !== "navigate_to_payment") {
    return errorResult(
      toolUse.id,
      "unknown_tool",
      `Navigation tool "${toolUse.name}" is not registered. Phase 1 only supports navigate_to_payment.`,
    );
  }

  const slug = toolUse.input.service_slug as string;
  if (!OTOPAIR_SERVICE_SLUGS.includes(slug as any)) {
    return errorResult(
      toolUse.id,
      "invalid_args",
      `Unknown service slug "${slug}". Must match the seeded services catalog.`,
    );
  }

  return ok(toolUse.id, {
    type: "navigate",
    target: "payment",
    route: `/home/mechanic/${toolUse.input.mechanic_id}/payment`,
    params: {
      mechanic_id: toolUse.input.mechanic_id,
      service_slug: slug,
      slot_id: toolUse.input.slot_id,
      vehicle_id: toolUse.input.vehicle_id,
    },
  });
}

// =============================================================================
// SANITIZERS — drop fields that should never reach the AI's context.
// =============================================================================

function sanitizeShop(shop: any) {
  return {
    id: shop._id,
    name: shop.name,
    address: shop.address ?? null,
    neighborhood: shop.neighborhood ?? null,
    lat: shop.location?.lat ?? shop.lat ?? null,
    lng: shop.location?.lng ?? shop.lng ?? null,
    avg_rating: shop.avg_rating ?? null,
    review_count: shop.review_count ?? 0,
    // EXCLUDED on purpose:
    //   stripe_connect_account_id, stripe_charges_enabled, stripe_payouts_enabled,
    //   stripe_requirements_currently_due, labor_rate, email, owner_user_id, phone
  };
}

function sanitizeMechanic(mech: any) {
  return {
    id: mech._id,
    name: mech.name ?? `${mech.first_name ?? ""} ${mech.last_name ?? ""}`.trim() || null,
    photo_url: mech.photoUrl ?? mech.photo ?? null,
    shop_id: mech.shop_id ?? null,
    shop_name: mech.shop?.name ?? null,
    avg_rating: mech.rating ?? null,
    review_count: mech.review_count ?? 0,
    // EXCLUDED: email, invitation/portal status, internal flags.
  };
}

function initialsOf(name: string | null): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? null;
  return `${parts[0][0]?.toUpperCase() ?? ""}.${parts[parts.length - 1][0]?.toUpperCase() ?? ""}.`;
}

// =============================================================================
// Result envelope helpers
// =============================================================================

function ok<T>(toolUseId: string, data: T): ToolResultBlock {
  const envelope: Envelope<T> = { status: "ok", data };
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify(envelope),
  };
}

function errorResult(
  toolUseId: string,
  code: ErrorEnvelope["code"],
  message: string,
): ToolResultBlock {
  const envelope: ErrorEnvelope = { status: "error", code, message };
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify(envelope),
    is_error: true,
  };
}

// =============================================================================
// CONTRACT NOTE FOR THE CHAT ACTION
// =============================================================================
//
// The chat action (separate file, per Runtime Architecture §6) is responsible
// for collecting render directives from multiple tool_result blocks in one
// turn and merging them into the final assistant ChatMessage envelope. The
// merge logic is approximately:
//
//   const directives = toolResults
//     .filter(r => !r.is_error)
//     .map(r => JSON.parse(r.content).data)
//     .filter(d => d?.type === "render");
//
//   const envelope: Partial<ChatMessage> = {};
//   for (const d of directives) {
//     if (Array.isArray(d.directives)) {
//       for (const sub of d.directives) envelope[sub.field] = sub.value;
//     } else {
//       envelope[d.field] = d.value;
//     }
//   }
//
// The navigation intent (if any) is returned alongside the envelope, NOT
// merged into it — the client navigates after rendering.
