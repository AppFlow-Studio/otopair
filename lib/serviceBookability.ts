import { HANDOFF_SLUGS } from "../constants/serviceTaxonomy";

interface CanSelectServiceForVehicleArgs {
  ownershipId: string | null | undefined;
  serviceId: string;
  serviceSlug: string | null | undefined;
  bookableIds: Set<string>;
}

interface ServiceLike {
  id: string;
  slug?: string | null;
}

interface FilterSelectableServicesForVehicleArgs {
  ownershipId: string | null | undefined;
  bookableIds: Set<string> | null | undefined;
}

export function canSelectServiceForVehicle({
  ownershipId,
  serviceId,
  serviceSlug,
  bookableIds,
}: CanSelectServiceForVehicleArgs): boolean {
  if (!ownershipId) return true;
  if (serviceSlug && HANDOFF_SLUGS.has(serviceSlug)) return true;
  return bookableIds.has(serviceId);
}

export function filterSelectableServicesForVehicle<T extends ServiceLike>(
  services: T[],
  { ownershipId, bookableIds }: FilterSelectableServicesForVehicleArgs,
): T[] {
  if (!ownershipId) return services;
  if (!bookableIds) return [];
  return services.filter((service) =>
    canSelectServiceForVehicle({
      ownershipId,
      serviceId: service.id,
      serviceSlug: service.slug,
      bookableIds,
    }),
  );
}
