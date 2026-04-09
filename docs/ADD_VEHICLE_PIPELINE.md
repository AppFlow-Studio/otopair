# Add Vehicle Pipeline

**Full documentation:** [VEHICLE_PIPELINE_GUIDE.md](./VEHICLE_PIPELINE_GUIDE.md) — single reference for NHTSA decode, AI enrichment, schema, and all pipeline details.

---

Quick reference:

- **Entry:** Manual VIN (`add-vehicle.tsx`) or Smartcar Connect (`add-vehicle-review.tsx`)
- **Stages:** NHTSA decode → AI enrichment (Call 1A, Call 1B, gap fill, Call 2)
- **Tables:** `makes`, `models`, `trims`, `engines`, `engine_specs`, `vehicle_specs`, `trim_specs`, `service_vehicle_specs`
