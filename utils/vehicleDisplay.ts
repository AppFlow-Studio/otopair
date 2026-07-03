export function formatEngineLiters(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;

  const liters = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(liters)) return null;

  return (Math.round((liters + Number.EPSILON) * 10) / 10).toFixed(1);
}
