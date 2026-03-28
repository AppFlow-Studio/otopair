/**
 * lib/vehicleDatabases.ts — Vehicle Databases API client
 *
 * Primary VIN decode source. Returns structured vehicle specs including
 * engine code, tire sizes, pressures, battery CCA, brake dimensions,
 * transmission details — data NHTSA doesn't provide.
 *
 * Confidence: 0.90 (paid structured source)
 * Fallback: NHTSA (free, always available)
 */

const VDB_BASE = "https://api.vehicledatabases.com";

export async function advancedVinDecode(vin: string): Promise<any | null> {
  // Check local cache first (saves credits, works when quota exhausted)
  const { VDB_CACHE } = await import("./vdbCache");
  const cached = VDB_CACHE[vin.toUpperCase()];
  if (cached) {
    console.log(`[vdb] Cache hit for ${vin}`);
    return cached;
  }

  const apiKey = process.env.VEHICLE_DATABASES_API_KEY;
  if (!apiKey) {
    console.log("[vdb] No API key, falling back to NHTSA only");
    return null;
  }

  try {
    const response = await fetch(`${VDB_BASE}/advanced-vin-decode/v2/${vin}`, {
      headers: { "x-AuthKey": apiKey },
    });

    if (!response.ok) {
      console.log(`[vdb] API error: ${response.status} — falling back to NHTSA`);
      return null;
    }

    const json = await response.json();
    if (json.status !== "success") {
      console.log(`[vdb] Decode failed: ${json.status}`);
      return null;
    }

    return json.data;
  } catch (err) {
    console.log(`[vdb] Failed: ${err}`);
    return null;
  }
}

export function extractVDBFields(data: any) {
  const specs = data.specifications || [];

  const findSpec = (title: string) => {
    const found = specs.find((s: any) => Object.keys(s)[0] === title);
    return found ? found[title] : {};
  };

  const dims = data.dimensions || [];

  const engineSpec = findSpec("engine");
  const tireSpec = findSpec("tires");
  const brakingSpec = findSpec("braking");
  const electricalSpec = findSpec("electrical");
  const steeringSpec = findSpec("steering");
  const fuelSpec = findSpec("fuel");

  const wheelDims = dims.find((d: any) => d.wheels)?.wheels || [];
  const brakingDims = dims.find((d: any) => d.braking)?.braking || [];

  const getWheelVal = (key: string) => {
    const entry = wheelDims.find((w: any) => w[key]);
    return entry?.[key]?.[0]?.value || null;
  };

  const getBrakeVal = (key: string) => {
    const entry = brakingDims.find((b: any) => b[key]);
    return entry?.[key]?.[0]?.value || null;
  };

  // Engine description from standard options
  const engineDescription =
    data.standard_options?.find((o: any) => o.name === "Engine")?.description || null;

  // Cylinders from dimensions
  const engineDims = dims.find((d: any) => d.engine)?.engine || [];
  const cylindersRaw = engineDims.find((e: any) => e.engine_size)?.engine_size?.[0]?.value;

  return {
    // Identity
    year: data.year ? parseInt(data.year) : null,
    make: data.make || null,
    model: data.model || null,
    trim: data.trim || null,
    bodyType: data.vehicle?.body_type || null,
    doors: data.vehicle?.doors ? parseInt(data.vehicle.doors) : null,

    // Engine
    engineCode: engineSpec.code || null,
    engineDescription,
    cylinders: cylindersRaw ? parseFloat(cylindersRaw) : null,
    displacement: engineSpec.displacement ? engineSpec.displacement / 1000 : null,
    camType: engineSpec.cam_type || null,
    blockType: engineSpec.block_type || null,
    drivetrain: engineSpec.drivetype || null,
    fuelType: fuelSpec?.type || null,

    // Transmission
    transType: data.transmission?.type || null,
    transSpeeds: data.transmission?.number_of_speeds
      ? parseInt(data.transmission.number_of_speeds)
      : null,
    transDescription: data.transmission?.description || null,

    // Tires
    frontTireSize: tireSpec.front_tire_size || null,
    rearTireSize: tireSpec.rear_tire_size || null,
    frontTirePressure: tireSpec.front_tire_pressure_psi
      ? parseInt(tireSpec.front_tire_pressure_psi)
      : null,
    rearTirePressure: tireSpec.rear_tire_pressure_psi
      ? parseInt(tireSpec.rear_tire_pressure_psi)
      : null,

    // Wheels
    wheelTorque: getWheelVal("wheel_torque")
      ? parseFloat(getWheelVal("wheel_torque"))
      : null,

    // Battery
    cca: electricalSpec.cold_cranking_capacity_amps
      ? parseInt(electricalSpec.cold_cranking_capacity_amps)
      : null,

    // Brakes
    frontRotorDia: getBrakeVal("front_brake_rotor_dia")
      ? parseFloat(getBrakeVal("front_brake_rotor_dia"))
      : null,
    rearRotorDia: getBrakeVal("rear_brake_rotor_dia")
      ? parseFloat(getBrakeVal("rear_brake_rotor_dia"))
      : null,
    brakeType: brakingSpec.type || null,

    // Steering
    steeringType: steeringSpec?.type || null,
  };
}
