/**
 * serviceCopy — customer-facing language for every service, at three
 * tiers of detail.
 *
 * Sourced verbatim from the OTOPAIR Service Guide · Three Levels of
 * Detail (Internal Handoff, May 2026). The doc defines three audience
 * tiers and the onboarding question
 * `useOnboardingStore.data.carKnowledgeLevel` (1 / 2 / 3) is what
 * decides which tier a given customer sees:
 *
 *   level 1 — "I prefer things explained to me"  → `simple`
 *   level 2 — "I know some stuff"                → `intermediate`
 *   level 3 — "I'm car-savvy"                    → `technician`
 *
 * The mapping is computed in `lib/serviceCopyTier.ts` and consumed by
 * `hooks/useServiceCopyTier.ts`. The same level also grounds Oto AI's
 * tone via `convex/oto/envelope.ts:knowledgeLabel`, so the InfoSheet
 * and chat always speak in the same voice for a given user.
 *
 * Slugs that aren't in `SERVICE_COPY` (currently only
 * `pre_purchase_inspection`, which the guide doesn't cover) fall back
 * to the legacy `entry.subtitle` rendering in `ServiceInfoSheet`.
 *
 * IMPORTANT: do not paraphrase. This file is the source of truth for
 * three surfaces (info sheet, AI grounding, future advisor tools). If
 * a line reads awkwardly, fix it in the guide and re-sync, not here.
 */

export interface ServiceTierCopy {
  whatItIs: string;
  whyItMatters: string;
  signs: string;
}

export interface ServiceCopy {
  /** 3-line teaser at the top of the info sheet. Same line set for
   *  every tier — the guide's quick summary is intentionally
   *  audience-agnostic. Stored as a tuple so the renderer can't
   *  accidentally drop a line. */
  quickSummary: readonly [string, string, string];
  /** Customer who picked "I prefer things explained to me". */
  simple: ServiceTierCopy;
  /** Customer who picked "I know some stuff". Doc-mapped from the
   *  INTERMEDIATE tier (originally written for service advisors). */
  intermediate: ServiceTierCopy;
  /** Customer who picked "I'm car-savvy". Doc-mapped from the
   *  TECHNICIAN tier (originally written for mechanics / training). */
  technician: ServiceTierCopy;
}

export type ServiceCopyTier = "simple" | "intermediate" | "technician";

export const SERVICE_COPY: Record<string, ServiceCopy> = {
  // ── #1 · Diagnostic Scan ──
  diagnostic_scan: {
    quickSummary: [
      "Your car has a brain that remembers problems.",
      "We hook up a computer and ask it what's wrong.",
      "Now we know what to fix.",
    ],
    simple: {
      whatItIs:
        "Your car has a little brain. When something goes wrong, it remembers. We hook up a small computer and ask the car's brain what's wrong.",
      whyItMatters:
        "It helps us find the problem fast, so we fix the right thing and you don't waste money.",
      signs:
        "A warning light pops up. The car feels weird. You want to know why a light came on.",
    },
    intermediate: {
      whatItIs:
        "The car's computer (ECU) watches dozens of sensors and saves a code whenever something reads abnormal. We plug a scan tool into the port under the dash and download those codes to see which system reported trouble.",
      whyItMatters:
        "It lets the mechanic start in the right place instead of taking parts off to look around. It also catches quiet problems before you can feel them.",
      signs:
        "A warning light is on, the car feels off (hesitating, shaking, weak), a light came and went, or you're checking a used car.",
    },
    technician: {
      whatItIs:
        "Connect a scan tool to the OBD-II port and pull diagnostic trouble codes (DTCs), freeze-frame data, and live PIDs from the ECU/PCM and other modules (ABS, TCM, SRS, BCM). On CAN-bus vehicles a full-system scan reads every module, not just powertrain.",
      whyItMatters:
        "DTCs localize the fault domain and freeze-frame captures the operating conditions when the code set, guiding pinpoint testing instead of parts-swapping. Catches pending/intermittent codes and monitor-readiness status before they become hard faults or inspection failures.",
      signs:
        "Illuminated MIL or other warning lamps, driveability complaints, intermittent faults, or a pre-purchase / pre-inspection readiness check.",
    },
  },

  // ── #3 · Check Engine Light Diagnosis ──
  check_engine_light: {
    quickSummary: [
      "A light on your dashboard turned on.",
      "We find the real reason behind it.",
      "Then you know what to fix.",
    ],
    simple: {
      whatItIs:
        "One dashboard light is the 'check engine' light. It can mean many things. We dig in and find the real reason it turned on.",
      whyItMatters:
        "It can mean something tiny or something big. Finding the reason early stops a small problem from becoming a costly one.",
      signs:
        "The light is glowing. If it's blinking, that's more serious — drive gently. The car may shake, feel weak, or use more gas.",
    },
    intermediate: {
      whatItIs:
        "A scan gives a code, but a code only points to a general area. We use it as a starting clue and test the actual parts — sensors, hoses, wiring, pressures — until we find the one true cause.",
      whyItMatters:
        "The light can mean something tiny (loose gas cap) or serious. Finding the real cause avoids both ignoring danger and replacing good parts.",
      signs:
        "Check engine light on or blinking (blinking is urgent), rough running, weak power, more fuel use, occasional stalling.",
    },
    technician: {
      whatItIs:
        "Code-directed pinpoint diagnosis. Starting from the stored DTC(s), perform circuit and component testing — fuel-trim (STFT/LTFT) analysis, scope/meter on sensor and actuator circuits, smoke test for EVAP/vacuum leaks, fuel pressure, compression/leak-down as needed — to isolate root cause rather than the symptom code.",
      whyItMatters:
        "A single code (e.g., P0171 lean bank 1) can stem from a vacuum leak, dirty MAF, weak fuel pump, or failing O2 sensor. Pinpointing prevents misdiagnosis and protects downstream components such as the catalytic converter.",
      signs:
        "MIL steady or flashing (flashing = active misfire, cat-damage risk — reduce load), rough running, reduced power, poor economy, intermittent stalling.",
    },
  },

  // ── #4 · State Inspection ──
  state_inspection: {
    quickSummary: [
      "New York wants your car checked once a year.",
      "We make sure the safety parts work.",
      "You get a sticker that says you're okay to drive.",
    ],
    simple: {
      whatItIs:
        "Once a year, New York wants someone to check your car is safe. We look at the brakes, lights, tires, and more. If it's all good, you get a sticker.",
      whyItMatters:
        "It's the law. It also keeps your car safe for you and everyone around you.",
      signs:
        "Your sticker is old or about to run out. You just got the car. It's that time of year.",
    },
    intermediate: {
      whatItIs:
        "A yearly safety check New York requires. A licensed shop goes through a set list — brakes, lights, tires, steering, seatbelts, wipers, horn, mirrors. Pass and you get a sticker.",
      whyItMatters:
        "It's the law, and it's a safety net that catches fading brakes or a dead light before you do.",
      signs:
        "Sticker expired or near expiring, you just bought the car, or it's that time of year.",
    },
    technician: {
      whatItIs:
        "NYS DMV-mandated annual safety inspection (Part 79): brakes, steering/suspension, tires/wheels, lighting, wipers, horn, mirrors, seatbelts, chassis, and fuel-system integrity, performed at a licensed station with sticker issuance through the DMV system.",
      whyItMatters:
        "Statutory requirement and a structured safety audit that surfaces wear — brake thickness, ball-joint play, tread depth, lamp output — the owner may not notice.",
      signs:
        "Sticker expiring/expired, ownership change or new registration, or the annual cycle.",
    },
  },

  // ── #5 · Emissions Test ──
  emissions_test: {
    quickSummary: [
      "When cars run, gas comes out the back.",
      "We make sure yours isn't too dirty.",
      "It keeps the air clean and follows the law.",
    ],
    simple: {
      whatItIs:
        "When a car runs, smoke and gas come out the back. We check that yours isn't making too much dirty air.",
      whyItMatters:
        "It keeps the air clean, it's the law, and it can catch hidden engine problems.",
      signs:
        "Done with your yearly check. If your check engine light is on, the car can fail. You see smoke from the back.",
    },
    intermediate: {
      whatItIs:
        "When a car burns fuel, exhaust leaves the tailpipe. On newer cars the test reads the car's emissions computer rather than sniffing the pipe. In NY it's bundled with the yearly inspection.",
      whyItMatters:
        "It keeps the air cleaner and flags engine problems you may not feel. A car can't pass inspection without passing this.",
      signs:
        "It's inspection time, the check engine light is on (can auto-fail), or smoke/smell from the tailpipe.",
    },
    technician: {
      whatItIs:
        "NY emissions inspection — OBD-II readiness/MIL check on 1996+ light-duty vehicles, verifying emissions monitors have run and no emissions DTCs/MIL are present. Older or heavy vehicles may require tailpipe/opacity testing.",
      whyItMatters:
        "Confirms the emissions-control system (catalytic converter, EVAP, O2/AFR sensors, EGR) functions within Federal/State limits; mandatory and bundled with the NY safety inspection.",
      signs:
        "Inspection due, MIL illuminated (automatic fail), incomplete readiness monitors after a battery disconnect/clear, visible smoke.",
    },
  },

  // ── #6 · Oil Change ──
  oil_change: {
    quickSummary: [
      "Oil keeps the parts inside your engine slippery.",
      "Old oil gets dirty and stops working.",
      "We swap it for fresh, clean oil.",
    ],
    simple: {
      whatItIs:
        "Inside your engine, metal parts rub together fast. Oil is the slippery juice that stops them grinding. It gets dirty over time. We drain it and add fresh oil, plus a new filter that catches dirt.",
      whyItMatters:
        "Oil is like lotion for your engine. Without it the parts scrape and overheat, and the engine can break — which costs a lot.",
      signs:
        "It's been a while or lots of miles. A little oil-can light pops up. The oil looks black, not golden.",
    },
    intermediate: {
      whatItIs:
        "Many fast-moving metal parts inside the engine rub together. Oil keeps them slippery and cool. Over time it gets dirty and thick. We drain the old oil, replace the filter, and add fresh oil of the right type.",
      whyItMatters:
        "Oil is like lotion for the engine. Old oil turns to sludge and lets metal grind on metal, which can destroy the engine — a very expensive repair.",
      signs:
        "Mileage or time is up, the oil light is on, the oil looks black, or the engine sounds rougher.",
    },
    technician: {
      whatItIs:
        "Drain the crankcase, replace the oil filter (cartridge or spin-on), refill with OEM-spec viscosity and approval (e.g., 0W-20 API SP / ILSAC GF-6, or ACEA/OEM approvals like LL-01, 508/509, MB 229.x). Replace the drain-plug crush washer where specified; torque plug and filter to spec; reset the oil-life monitor.",
      whyItMatters:
        "Maintains the lubricating film and detergency that control wear, deposits, and thermal breakdown; protects bearings, timing components, and turbo journal bearings. Out-of-spec oil and extended intervals promote sludge and LSPI risk on DI turbo engines.",
      signs:
        "Interval reached (mileage or oil-life algorithm), low-oil or oil-life warning, dark/contaminated oil on the dipstick, ticking on cold start.",
    },
  },

  // ── #7 · Filter Replacement (air + cabin) ──
  filter_replacement: {
    quickSummary: [
      "Your car has filters that catch dirt.",
      "We put in fresh, clean ones.",
      "The engine and your air both feel better.",
    ],
    simple: {
      whatItIs:
        "Your car has filters that catch dirt. One cleans the air your engine breathes. One cleans the air you breathe inside. We put in fresh ones.",
      whyItMatters:
        "A dirty engine filter is like breathing through a stuffy nose. A dirty cabin filter makes the inside air dusty and smelly.",
      signs:
        "The car feels weak or uses more gas. Vent air is weak or smells. The filters look dark.",
    },
    intermediate: {
      whatItIs:
        "Your car uses filters like strainers. The engine air filter cleans air going into the engine; the cabin filter cleans the air you breathe inside. We replace both.",
      whyItMatters:
        "A clogged engine filter chokes power and wastes gas. A dirty cabin filter weakens your heat and AC and lets dust and smells in.",
      signs:
        "Weak power or more gas use, weak/smelly vent air, or filters that look dark and full.",
    },
    technician: {
      whatItIs:
        "Replace the engine intake air filter and the cabin (HVAC/pollen) filter. Inspect airbox sealing and MAF cleanliness; confirm cabin-filter orientation (airflow arrow) and full seating to avoid bypass.",
      whyItMatters:
        "A restricted intake filter reduces volumetric efficiency and can skew MAF readings and fuel trims; a clogged cabin filter cuts HVAC airflow and can ice the evaporator. Clean filtration protects the MAF and blower motor.",
      signs:
        "Service interval, reduced airflow at the vents, musty odor, dusty cabin, slight loss of throttle response.",
    },
  },

  // ── #8 · Spark Plugs ──
  spark_plugs: {
    quickSummary: [
      "Tiny parts make sparks to run your engine.",
      "Old ones wear out and spark weakly.",
      "We put in new ones so it runs smooth.",
    ],
    simple: {
      whatItIs:
        "Your car runs on tiny explosions. Spark plugs make the spark that starts each one — like a lighter's click. They wear out. We put in new ones.",
      whyItMatters:
        "Good sparks mean a smooth, strong car that saves gas. Worn ones make it shake, feel weak, and hard to start.",
      signs:
        "The engine shakes or stutters. Hard to start. Feels slow or uses more gas. A warning light.",
    },
    intermediate: {
      whatItIs:
        "The engine runs on tiny explosions; spark plugs make the spark that lights each one — one per cylinder. The tips wear and foul over time. We replace them with fresh plugs set to the right gap.",
      whyItMatters:
        "Strong sparks mean smooth power, easy starts, and good mileage. Worn plugs misfire, waste fuel, and can stress other parts.",
      signs:
        "Engine shakes/misfires, hard starting, more gas use, sluggish, check engine light.",
    },
    technician: {
      whatItIs:
        "Replace spark plugs with the OEM heat range and electrode type (copper/platinum/iridium), set or verify gap to spec, apply anti-seize/dielectric only where specified, and torque to spec. On coil-on-plug systems inspect coils and boots; on V-engines or DI, intake/plenum removal may be required for access.",
      whyItMatters:
        "Worn plugs widen the gap and raise the required firing voltage, causing misfire, incomplete combustion, higher emissions, and coil stress. The correct heat range prevents fouling and pre-ignition.",
      signs:
        "Misfire codes (P030x), rough idle, hesitation, hard start, reduced economy, MIL.",
    },
  },

  // ── #9 · Timing Belt (belt-driven engines only) ──
  timing_belt: {
    quickSummary: [
      "A belt keeps your engine parts moving in time.",
      "If it snaps, the engine can break badly.",
      "We replace it before that happens.",
    ],
    simple: {
      whatItIs:
        "Engine parts at the top and bottom must move together, like two people clapping at the same time. A rubber belt keeps them in sync. It can wear and snap, so we replace it first. (Some cars use a metal chain instead.)",
      whyItMatters:
        "If the belt snaps while driving, the engine parts crash and break — costing thousands. Changing it on time is way cheaper.",
      signs:
        "Mostly about miles — usually 60,000 to 100,000 (your manual says). Sometimes a ticking sound.",
    },
    intermediate: {
      whatItIs:
        "The top and bottom of the engine must move in perfect step. A toothed rubber belt keeps them in sync. Because it's rubber, it wears and can snap, so we replace it on schedule — usually with the tensioner, pulleys, and often the water pump. (Some engines use a chain and skip this.)",
      whyItMatters:
        "If the belt snaps, engine parts collide and can be ruined — thousands to fix. On-time replacement is far cheaper.",
      signs:
        "Mostly mileage (about 60,000–100,000 miles, per your manual). Sometimes a ticking noise.",
    },
    technician: {
      whatItIs:
        "Replace the timing belt and associated wear items — tensioner, idler pulleys, cam/crank seals, and (if belt-driven) the water pump and coolant; often the accessory belt too. Set cam/crank timing to TDC marks and verify tension to spec. On interference engines, correct timing is mandatory or valve-to-piston contact occurs.",
      whyItMatters:
        "The belt is a service-life rubber component; failure on an interference engine causes valve, piston, and head damage. Replacing the kit on interval avoids catastrophic, costly failure. Timing-chain engines are N/A.",
      signs:
        "Mileage/age interval (~60k–100k mi or ~7 yr per OEM), ticking/squeal, oil seepage from cam/crank seals, or belt cracking on inspection.",
    },
  },

  // ── #10 · Coolant Flush ──
  coolant_flush: {
    quickSummary: [
      "Coolant keeps your hot engine cool.",
      "Over time it gets old and weak.",
      "We swap it for fresh coolant.",
    ],
    simple: {
      whatItIs:
        "Engines get very hot. Coolant is a liquid that soaks up the heat, like a wet towel. It gets old and stops working. We drain it and add fresh.",
      whyItMatters:
        "Without good coolant the engine gets too hot and can break. Old coolant also rusts the parts inside.",
      signs:
        "The heat gauge climbs or the engine runs hot. Steam under the hood (stop driving!). Coolant looks dirty or rusty.",
    },
    intermediate: {
      whatItIs:
        "Coolant flows through the engine and carries heat away, like a wet towel cooling you. It also stops freezing and rust. Over time it breaks down. We drain it, refill with fresh coolant, then bleed out the air.",
      whyItMatters:
        "Without good coolant the engine overheats and can warp or crack. Old coolant turns acidic and eats metal and rubber parts.",
      signs:
        "Temp gauge climbs or engine runs hot, steam under the hood (stop driving), or dirty/rusty coolant.",
    },
    technician: {
      whatItIs:
        "Drain and refill the cooling system with OEM-spec coolant chemistry (IAT/OAT/HOAT — e.g., G12/G13, Dex-Cool, Toyota SLLC) at the correct concentration; bleed air per procedure (vacuum-fill or bleed valves). Inspect thermostat, hoses, and cap; check for combustion gases if overheating.",
      whyItMatters:
        "Coolant additives deplete, lowering corrosion/cavitation protection and pH buffering; degraded coolant promotes electrolysis, scale, water-pump and heater-core damage, and overheating. Mixing incompatible chemistries can gel.",
      signs:
        "Service interval, high coolant temp/overheating, discolored or contaminated coolant, low level, loss of heater performance.",
    },
  },

  // ── #11 · Transmission Service ──
  transmission_service: {
    quickSummary: [
      "Your car uses fluid to change gears smoothly.",
      "That fluid gets dirty over time.",
      "We replace it so shifting stays smooth.",
    ],
    simple: {
      whatItIs:
        "Your car changes 'gears' to go faster or slower, like gears on a bike. Inside is a fluid that keeps it shifting smoothly. It gets dirty. We drain it and add fresh (sometimes a filter too).",
      whyItMatters:
        "This part is very expensive to fix. Clean fluid keeps shifting smooth and stops it wearing out. Old fluid makes it jerk and slip.",
      signs:
        "Changing speeds feels rough, slow, or jerky. Fluid is dark or smells burnt. Lots of miles.",
    },
    intermediate: {
      whatItIs:
        "The transmission turns engine power into the right speed for the wheels — it shifts gears like a bike. A special fluid keeps it cool and smooth. We drain old fluid and add fresh, and often a filter and pan gasket.",
      whyItMatters:
        "It's one of the priciest parts to replace. Clean fluid keeps shifts smooth and protects it; old fluid causes rough or slipping shifts and wear.",
      signs:
        "Rough, slow, or slipping shifts, dark/burnt fluid, or high mileage.",
    },
    technician: {
      whatItIs:
        "Drain-and-fill or full service of ATF/CVT/DCT fluid to exact OEM spec; replace internal filter and pan gasket where serviceable (or external filter + O-ring on some CVTs). Many require a fill-to-level at a specified fluid-temperature window, sometimes set with a scan tool.",
      whyItMatters:
        "Fluid provides hydraulic control, clutch friction characteristics, and cooling; oxidized fluid degrades shift quality and clutch life. Wrong-spec fluid causes shudder or failure. Correct level and fill temperature are critical to durability.",
      signs:
        "Harsh/slipping/delayed shifts, shudder, burnt-smelling dark fluid, service interval (especially severe/tow use), stored TCM codes.",
    },
  },

  // ── #12 · Tire Rotation ──
  tire_rotation: {
    quickSummary: [
      "Tires wear unevenly in their spots.",
      "We move them around the car.",
      "This helps them all last longer.",
    ],
    simple: {
      whatItIs:
        "Your four tires wear down at different speeds depending on their spot. We move them around (like front to back) so they wear evenly. Nothing is replaced.",
      whyItMatters:
        "It makes your tires last longer and saves money, and keeps the car driving evenly.",
      signs:
        "Usually done on a schedule, often with your oil change. Some tires look more worn.",
    },
    intermediate: {
      whatItIs:
        "Tires wear at different rates by position (fronts usually faster). We move them to new spots in the correct pattern so wear evens out. Nothing is replaced.",
      whyItMatters:
        "Even wear makes the whole set last longer and keeps grip balanced and safe.",
      signs:
        "On schedule, often with oil changes; some tires look more worn than others.",
    },
    technician: {
      whatItIs:
        "Reposition tires per the correct pattern for drivetrain and tire type (forward-cross, rearward-cross, X-pattern; front-to-back for directional; side-specific for staggered/asymmetric). Set pressures to placard and reset position-based TPMS.",
      whyItMatters:
        "Equalizes wear from drive-axle torque, steering scrub, and weight bias to maximize tread life and keep grip/handling balanced. Staggered or directional fitments constrain the legal pattern.",
      signs:
        "Interval (often each oil change / ~5–7k mi), front-to-rear wear disparity, slight vibration.",
    },
  },

  // ── #13 · Tire Balance ──
  tire_balance: {
    quickSummary: [
      "Wheels can wobble if one spot is heavier.",
      "We add little weights to even them out.",
      "Your ride gets nice and smooth.",
    ],
    simple: {
      whatItIs:
        "Every wheel has one spot that's a little heavier. At fast speeds that makes it wobble. We add tiny weights to even it out so it spins smooth.",
      whyItMatters:
        "Balanced wheels give a smooth ride and last longer. Wobbly wheels shake the car and wear out tires.",
      signs:
        "The car or steering wheel shakes when you go fast. New tires. A tire wearing oddly.",
    },
    intermediate: {
      whatItIs:
        "Every wheel has a slightly heavy spot that makes it wobble at speed. On a machine we find it and add small weights to even it out so it spins smooth.",
      whyItMatters:
        "Balanced wheels ride smooth and wear evenly; unbalanced ones shake the car and wear tires and suspension faster.",
      signs:
        "Shaking at higher speeds, new tires just installed, or odd cupped tire wear.",
    },
    technician: {
      whatItIs:
        "Spin-balance each tire/wheel assembly, correcting static and dynamic imbalance with clip-on or adhesive weights in the correct planes. Road-force balancing addresses tire/wheel runout and stiffness variation beyond simple mass imbalance.",
      whyItMatters:
        "Imbalance creates speed-dependent vibration that accelerates cupping and wears hub bearings, tie rods, and shocks. Proper balance improves ride quality and tread life.",
      signs:
        "Speed-related steering/seat/floor vibration, new tire mount, cupped wear pattern, a thrown wheel weight.",
    },
  },

  // ── #14 · Wheel Alignment ──
  wheel_alignment: {
    quickSummary: [
      "Your wheels need to point straight.",
      "We measure and adjust them.",
      "The car drives straight and tires last longer.",
    ],
    simple: {
      whatItIs:
        "Your wheels need to point straight. Potholes and bumps knock them crooked. We use a machine to measure and adjust them back to straight. Nothing is replaced.",
      whyItMatters:
        "Crooked wheels make the car pull and wear tires out fast. Straight wheels keep it driving straight and tires lasting.",
      signs:
        "The car pulls to one side. The steering wheel (the round wheel you turn) sits crooked. One tire edge is worn. You hit a big pothole.",
    },
    intermediate: {
      whatItIs:
        "The wheels must point at the right angles. Bumps and potholes knock them crooked. On a machine we measure each wheel's angle and adjust them back to factory spec. Nothing is replaced.",
      whyItMatters:
        "Crooked wheels make the car pull and chew through tires fast. Straight wheels drive true and protect the tires.",
      signs:
        "Car pulls to one side, wheel sits crooked when straight, one tire edge worn, or you hit a pothole.",
    },
    technician: {
      whatItIs:
        "Measure and adjust suspension geometry — camber, caster, toe, and thrust angle — to OEM spec on an alignment rack (typically a 4-wheel alignment). Adjust via tie rods, cam bolts, or shims; verify steering-wheel centering and reset the steering-angle sensor where required.",
      whyItMatters:
        "Out-of-spec angles cause directional pull, off-center steering, and rapid/uneven tread wear (feathering, shoulder wear). Correct geometry preserves tires, handling, and stability-control accuracy.",
      signs:
        "Pull/drift, off-center wheel, edge/feathered tire wear, after impact (pothole/curb), or after suspension work.",
    },
  },

  // ── #15 · Tire Replacement (separate tire flow) ──
  tire_replacement: {
    quickSummary: [
      "Tires wear down and lose their grip.",
      "We put on fresh new ones.",
      "You get safe stopping and a smooth ride.",
    ],
    simple: {
      whatItIs:
        "Tires are the round rubber parts that touch the road. Their grooves grip the ground. When they wear down or get damaged, we take off the old ones and put on brand-new tires.",
      whyItMatters:
        "Tires are the ONLY part touching the ground. Worn ones can't grip or stop and slide in rain. New ones keep you safe.",
      signs:
        "Grooves look worn or smooth. A flat, leak, or bubble. Old, cracked tires. The car slides in rain.",
    },
    intermediate: {
      whatItIs:
        "Tires are the rubber that touches the road; their grooves grip and shed water. When tread wears down or a tire is damaged, we remove the old ones and mount new tires with fresh valve parts, then balance them.",
      whyItMatters:
        "Tires are the only contact with the road. Worn ones can't grip or stop well and slide in rain. New ones restore safety.",
      signs:
        "Low/worn tread, flat/leak/bulge, cracked old tires, or slipping in the rain.",
    },
    technician: {
      whatItIs:
        "Dismount worn/damaged tires, mount new tires of correct size, load, and speed rating, rebuild the valve/TPMS service kit (grommet, core, nut, cap or sensor seal), balance, and set pressure to placard. Observe directional/asymmetric mounting and perform TPMS relearn.",
      whyItMatters:
        "Tread depth governs wet traction and hydroplaning resistance; below ~2/32\" (and degraded by age/dry rot) braking and grip fall sharply. Correct rating and working TPMS are safety- and spec-critical.",
      signs:
        "Tread at/near wear bars (2/32\"), puncture / sidewall bulge / repair-ineligible damage, age cracking, wet-traction loss.",
    },
  },

  // ── #16 · Brake Pad Replacement (per axle) ──
  brake_pad_replacement: {
    quickSummary: [
      "Pads squeeze to stop your car.",
      "They slowly wear down every time you brake.",
      "We put in new ones so you can stop safely.",
    ],
    simple: {
      whatItIs:
        "To stop, two pads squeeze a spinning part at each wheel — like pinching a spinning plate. The pads wear away each time you brake. We put in new ones.",
      whyItMatters:
        "Brakes are how you stop, so this matters for safety. Fresh pads stop you fast; worn ones take longer and can damage other parts.",
      signs:
        "Squeaky or screechy braking. Grinding (check right away). Longer stops. A brake light.",
    },
    intermediate: {
      whatItIs:
        "Brakes work by squeezing pads against a spinning disc at each wheel. The pads wear away with use. We fit new pads, fresh hardware clips, and grease the contact points; wear sensors are replaced on cars that have them.",
      whyItMatters:
        "Brakes are your top safety system. Fresh pads stop you fast; worn pads stop slowly and can grind into and ruin the rotors.",
      signs:
        "Squealing then grinding, longer stops, a brake light, or a shaky pedal.",
    },
    technician: {
      whatItIs:
        "Replace friction pads (NAO/ceramic or semi-metallic per application), fit new abutment/anti-rattle hardware, lubricate slides and contact points with high-temp synthetic brake grease, retract and inspect caliper pistons and guide pins, set the electronic parking brake to service mode where applicable, and bed-in. Replace wear sensors on equipped vehicles.",
      whyItMatters:
        "Pad friction material is consumable; worn pads lengthen stopping distance and, once through the backing, score rotors and cut braking sharply. Fresh hardware prevents noise, uneven wear, and caliper bind.",
      signs:
        "Wear-indicator squeal, grinding (metal-on-metal), longer pedal travel/stopping distance, brake warning, pulsation, low measured pad thickness.",
    },
  },

  // ── #17 · Rotor Replacement (per axle, pads together) ──
  rotor_replacement: {
    quickSummary: [
      "Brake pads squeeze a spinning part called a rotor.",
      "Rotors wear out or bend over time.",
      "We replace them for safe, smooth stops.",
    ],
    simple: {
      whatItIs:
        "Remember the spinning part the pads squeeze? That's the rotor. Over time it wears thin or warps (bends from heat). We replace it, and usually the pads too.",
      whyItMatters:
        "Smooth rotors mean safe, smooth stops. Worn or bent ones make brakes shake or feel weak.",
      signs:
        "The pedal or steering wheel shakes when slowing. Grinding sounds. Deep scratches on the metal part.",
    },
    intermediate: {
      whatItIs:
        "The brake pads squeeze a metal disc called the rotor. Over time it wears thin or warps from heat. We replace the rotors, and usually the pads too, since they work as a pair.",
      whyItMatters:
        "Smooth rotors mean safe, smooth stops. Worn or warped ones make braking shaky or weak and can ruin new pads.",
      signs:
        "Pedal or wheel shakes when stopping, grinding, deep grooves on the disc, weak braking.",
    },
    technician: {
      whatItIs:
        "Replace brake rotors (or machine if within minimum-thickness spec) when below discard thickness or beyond lateral-runout / thickness-variation (DTV) tolerance; replace pads concurrently, clean the hub face to control runout, torque to spec, and bed-in.",
      whyItMatters:
        "Rotors below spec or with excessive DTV/runout cause pedal pulsation, reduced thermal capacity (fade), and compromised braking. Hub cleanliness and proper torque prevent induced runout.",
      signs:
        "Pedal/steering pulsation under braking, grinding, visible scoring or heat-checking, measured thickness below spec, edge lip.",
    },
  },

  // ── #18 · Brake Fluid Flush ──
  brake_fluid_flush: {
    quickSummary: [
      "Your brakes work by pushing fluid through tubes.",
      "That fluid gets watery and weak over time.",
      "We swap it so your brakes stay strong.",
    ],
    simple: {
      whatItIs:
        "When you push the brake pedal, you push a liquid through tubes that squeezes the brakes. That liquid soaks up water and gets weak. We remove the old and add fresh.",
      whyItMatters:
        "This liquid turns your foot-push into stopping power. Old, watery fluid makes the pedal soft and brakes weak — right when you need them.",
      signs:
        "The pedal feels soft or squishy. Brakes feel weak. It's been about 2 to 3 years.",
    },
    intermediate: {
      whatItIs:
        "Pressing the brake pedal pushes fluid through tubes that squeeze the brakes. Over time the fluid soaks up water and weakens. We remove all the old fluid and add fresh, bleeding each wheel.",
      whyItMatters:
        "This fluid turns your foot-push into stopping power. Watery old fluid can boil and go spongy when you need it most. Fresh fluid keeps stopping strong.",
      signs:
        "Soft/spongy pedal, weak brakes, about 2–3 years since the last flush, or dark fluid.",
    },
    technician: {
      whatItIs:
        "Flush the hygroscopic brake fluid (DOT 3/4/4 LV or DOT 5.1 per spec) through the full hydraulic circuit, bleeding each corner in sequence (or via ABS-module bleed with a scan tool) until clean fluid and correct boiling-point/moisture readings are achieved. Do not use silicone DOT 5 in ABS systems unless specified.",
      whyItMatters:
        "Brake fluid absorbs moisture over time, lowering its wet boiling point and risking vapor lock (pedal fade) under heat; moisture also corrodes ABS and caliper internals. A periodic flush restores boiling point and protects components.",
      signs:
        "Soft/spongy or sinking pedal, fade under heavy/downhill braking, ~2–3 yr interval, dark fluid, brake/ABS warning.",
    },
  },

  // ── #19 · Battery Test ──
  battery_test: {
    quickSummary: [
      "We check how strong your battery still is.",
      "This warns you before it dies.",
      "You don't get stuck by surprise.",
    ],
    simple: {
      whatItIs:
        "The battery gives your car power to start, like big remote-control batteries. We use a tool to check how strong it still is. Nothing is replaced — just a check-up.",
      whyItMatters:
        "Batteries die with little warning, usually at a bad time. Testing tells you it's getting weak before it leaves you stuck.",
      signs:
        "The car is slow to start. Lights look dim. Battery is a few years old. It died once before.",
    },
    intermediate: {
      whatItIs:
        "The battery gives the car power to start and run electronics. We use a tool to measure how strong it still is and whether the car is charging it properly. Nothing is replaced.",
      whyItMatters:
        "Batteries die with little warning, usually at the worst time. Testing warns you while there's still time to plan.",
      signs:
        "Slow starts, dim lights, battery a few years old, or it died once before.",
    },
    technician: {
      whatItIs:
        "Conductance/load test the battery (measured CCA vs. rated), verify state-of-charge and resting voltage, and test the charging system — alternator output, ripple, and voltage drop across cables/grounds. Check for parasitic draw if discharge is suspected.",
      whyItMatters:
        "Quantifies remaining capacity and charging health to predict failure before a no-start, and distinguishes a weak battery from a charging-system or parasitic-draw fault.",
      signs:
        "Slow crank, dim lights, battery age over ~3 yr, prior jump-starts, seasonal temperature extremes.",
    },
  },

  // ── #20 · Battery Replacement ──
  battery_replacement: {
    quickSummary: [
      "The battery gives your car power to start.",
      "Old ones run out of power and die.",
      "We put in a fresh one so it starts every time.",
    ],
    simple: {
      whatItIs:
        "The battery is the box that gives your car power to start and run its lights. After a few years it wears out. We take out the old one and put in a fresh one.",
      whyItMatters:
        "A good battery starts your car every time. A dead one leaves you stuck. A fresh one fixes that.",
      signs:
        "Starts slowly or not at all. Dim lights. Fast clicking at the key. Old battery.",
    },
    intermediate: {
      whatItIs:
        "The battery stores the power to start the car and run its electronics. After a few years it stops holding a charge. We remove the old one and install a fresh one (some cars also need it 'registered' to the computer — that's labor).",
      whyItMatters:
        "A good battery starts the car every time; a dead one strands you. A fresh one keeps electronics steady.",
      signs:
        "Slow or no start, dim lights, rapid clicking at the key, an old battery, or a failed test.",
    },
    technician: {
      whatItIs:
        "Replace with the correct group size and chemistry (flooded/EFB/AGM) and rating; on many European and start-stop vehicles perform battery registration/coding (BMS) so charging adapts to the new battery. Maintain memory power during the swap, clean terminals, and protect against corrosion.",
      whyItMatters:
        "A battery that no longer holds charge causes no-start and voltage instability affecting modules. Correct type and registration are required for the start-stop charging strategy and battery longevity.",
      signs:
        "No-start/slow crank, dim lights, rapid clicking, failed battery test, age, charging warning.",
    },
  },

  // ── #21 · Power Steering Flush (N/A on electric steering) ──
  power_steering_flush: {
    quickSummary: [
      "Some cars use fluid to make steering easy.",
      "That fluid gets dirty over time.",
      "We replace it so the wheel turns easily.",
    ],
    simple: {
      whatItIs:
        "Turning the steering wheel (the round wheel you hold to steer) is made easy by a helper fluid. It gets dirty over time. We swap it for fresh. (Some newer cars use an electric helper and don't need this.)",
      whyItMatters:
        "Clean fluid keeps the wheel turning easily. Old, dirty fluid makes it hard to turn and can whine.",
      signs:
        "The wheel is hard to turn, especially parking. A whine when you turn. Dark fluid.",
    },
    intermediate: {
      whatItIs:
        "On many cars a pressurized fluid does the heavy work of turning the wheel. The fluid gets dirty over time. We remove the old and add fresh, then bleed out air. (Newer electric-steering cars don't use fluid.)",
      whyItMatters:
        "Clean fluid keeps steering light and protects the pump and rack — expensive parts. Old fluid makes steering hard and noisy.",
      signs:
        "Hard-to-turn wheel (especially parking), whine when turning, or dark fluid.",
    },
    technician: {
      whatItIs:
        "On hydraulic power-steering systems, evacuate and replace the PS fluid to OEM spec (ATF or dedicated PSF), cycle lock-to-lock to purge, and bleed air; replace the reservoir filter/screen where fitted. Electric power steering (EPS/EPAS) has no fluid and is N/A.",
      whyItMatters:
        "Degraded/contaminated fluid abrades the pump and rack seals and causes hard or notchy steering and whine; fresh fluid preserves the pump and rack — both costly to replace.",
      signs:
        "Heavy/notchy steering (especially low speed), whine/groan on turning, dark fluid, foaming/aeration.",
    },
  },

  // ── #22 · Differential Service ──
  differential_service: {
    quickSummary: [
      "Special gears help your wheels turn corners.",
      "Thick oil keeps those gears safe.",
      "We replace the oil to protect them.",
    ],
    simple: {
      whatItIs:
        "When your car turns a corner, the outside wheels spin a bit faster than the inside ones. A set of gears makes that work. They sit in thick, gooey oil. We drain the old oil and add fresh.",
      whyItMatters:
        "The gears work hard, and the thick oil keeps them from wearing out. Old oil leads to noise and costly damage.",
      signs:
        "A whining or humming sound under the car. Lots of miles. Old or low oil.",
    },
    intermediate: {
      whatItIs:
        "When you turn, the outside wheels spin faster than the inside ones; a set of gears (the differential) makes that work. The gears sit in thick oil. We drain the old oil and add fresh (plus a friction additive on limited-slip types).",
      whyItMatters:
        "Those gears take heavy loads, and the thick oil keeps them from wearing out. Old oil causes whining and, eventually, costly damage.",
      signs:
        "Whining/humming that changes with speed, high mileage, or old/low fluid.",
    },
    technician: {
      whatItIs:
        "Drain and refill the differential(s)/transfer case with the correct GL-5 hypoid gear-oil viscosity (and LSD friction modifier if limited-slip and not pre-blended); replace fill/drain plug crush washers, or reseal the cover with RTV where applicable. Inspect for metal contamination and backlash/whine indications.",
      whyItMatters:
        "Hypoid gear sets run high tooth-sliding loads needing EP additives; depleted oil causes scoring, whine, and bearing/gear failure. LSD units chatter without the proper friction modifier.",
      signs:
        "Drivetrain whine/howl varying with speed, clunk on turn/accel, service interval (especially tow/off-road), contaminated or low fluid.",
    },
  },

  // ── #23 · Fuel System / Induction Service (scales with depth) ──
  fuel_system_cleaning: {
    quickSummary: [
      "Gunk builds up where gas and air go in.",
      "We clean it all out.",
      "Your engine runs smoother and saves gas.",
    ],
    simple: {
      whatItIs:
        "Your engine needs fuel (gas) and air mixed to run. Over time sticky gunk builds up on the parts that handle the gas and air. We clean it out.",
      whyItMatters:
        "When those parts are clean, the engine runs smooth, starts easy, and saves gas. Gunky parts run rough and waste fuel.",
      signs:
        "The engine shakes when sitting still. Feels weak or jerky. Uses more gas. Hard to start.",
    },
    intermediate: {
      whatItIs:
        "The engine needs fuel and air mixed to run. Over time sticky carbon builds up on the injectors, throttle, and intake. We clean that buildup out (on some engines this means cleaning the intake valves directly).",
      whyItMatters:
        "Clean parts mean smooth running, easy starts, good power, and better mileage. Gunk makes it run rough and waste fuel.",
      signs:
        "Rough idle, hesitation, weak power, more gas use, hard starting, check engine light.",
    },
    technician: {
      whatItIs:
        "Decarbonize the air/fuel path: injector cleaning (additive, on-vehicle, or bench), throttle-body and intake cleaning, and on GDI engines intake-valve carbon removal (chemical/induction or walnut-blast media), since port-injection detergents don't reach the valves. Reset adaptations as needed.",
      whyItMatters:
        "Deposits on injectors, throttle plate, and (GDI) intake valves disrupt spray pattern and airflow, causing rough idle, misfire, hesitation, and lost economy/power. Cleaning restores fuel atomization and airflow.",
      signs:
        "Rough/unstable idle, hesitation/stumble, reduced power and economy, cold-start difficulty, misfire/MIL — common on direct-injection engines.",
    },
  },
};

/** Lookup helper — returns undefined when the slug has no entry in
 *  the guide (e.g. `pre_purchase_inspection`). Callers should fall
 *  back to the legacy taxonomy `subtitle` line in that case. */
export function getServiceCopy(slug: string | undefined): ServiceCopy | undefined {
  if (!slug) return undefined;
  return SERVICE_COPY[slug];
}

/** Resolve a service-copy entry to a single tier block. Centralized so
 *  callers can do `pick(copy, tier).whatItIs` without redoing the
 *  switch. */
export function pickServiceCopyTier(
  copy: ServiceCopy,
  tier: ServiceCopyTier,
): ServiceTierCopy {
  switch (tier) {
    case "technician":
      return copy.technician;
    case "intermediate":
      return copy.intermediate;
    case "simple":
    default:
      return copy.simple;
  }
}
