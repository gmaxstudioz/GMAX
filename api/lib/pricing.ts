export function calculateGrandTotal(
    service: { price: unknown; salePrice?: unknown | null },
    addons: { price: unknown; salePrice?: unknown | null }[],
    sessionCount: number,
): number {
    const servicePrice = Number(service.salePrice ?? service.price ?? 0);
    const addonsTotal = addons.reduce(
        (sum, a) => sum + Number(a.salePrice ?? a.price ?? 0),
        0,
    );
    return servicePrice * sessionCount + addonsTotal;
}