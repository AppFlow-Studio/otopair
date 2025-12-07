
/**
 * AverageInspection
 *
 * PURPOSE: Ask average users when their last New York State inspection was.
 *
 * USED IN: app/(onboarding)/average-inspection.tsx
 *
 * PROPS:
 *   - progressTotal: The total number of steps in the onboarding process
 *   - progressFilled: The number of steps that have been completed
 *
 * NOTES:
 *   - This screen reuses BeginnerInspection component to avoid code duplication.
 *   - The progressTotal and progressFilled props are passed to the BeginnerInspection component to update the progress bar.
 * 
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

import { BeginnerInspection } from './BeginnerInspection';

export function AverageInspection() {
  return <BeginnerInspection progressTotal={6} progressFilled={5} />;
}