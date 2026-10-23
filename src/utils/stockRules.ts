import type { StockLevel, StockUnit } from "../types";
export interface StockLine {
  variantId: string;
  quantity: number;
  stockUnitId?: string;
}

/** All validation happens before a result is returned; caller data is never mutated. */
export function changeStock(
  levels: StockLevel[],
  locationId: string,
  lines: StockLine[],
  direction: 1 | -1,
): StockLevel[] {
  if (!locationId || locationId === "ALL" || !lines.length)
    throw new Error("Choose a location and at least one item.");
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (
      !line.variantId ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0
    )
      throw new Error("Stock quantities must be positive whole numbers.");
    totals.set(
      line.variantId,
      (totals.get(line.variantId) || 0) + line.quantity,
    );
  }
  const result = levels.map((row) => {
    if (row.locationId !== locationId || !totals.has(row.variantId)) return row;
    const onHand = row.onHand + direction * totals.get(row.variantId)!;
    if (onHand < row.reserved || onHand < 0)
      throw new Error(
        "Insufficient available stock. Refresh the item and try again.",
      );
    totals.delete(row.variantId);
    return { ...row, onHand };
  });
  if (direction === -1 && totals.size)
    throw new Error("An item has no stock at this location.");
  for (const [variantId, quantity] of totals)
    result.push({
      id: `sl-${locationId}-${variantId}`,
      variantId,
      locationId,
      onHand: quantity,
      reserved: 0,
      reorderLevel: 0,
    });
  return result;
}
export function validateDevices(
  units: StockUnit[],
  locationId: string,
  lines: StockLine[],
): void {
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.stockUnitId) continue;
    if (seen.has(line.stockUnitId))
      throw new Error("The same device cannot appear twice.");
    seen.add(line.stockUnitId);
    const unit = units.find((u) => u.id === line.stockUnitId);
    if (
      !unit ||
      unit.locationId !== locationId ||
      unit.variantId !== line.variantId ||
      unit.status !== "IN_STOCK" ||
      line.quantity !== 1
    )
      throw new Error("A selected device is unavailable at this location.");
  }
}
