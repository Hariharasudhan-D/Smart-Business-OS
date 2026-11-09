export function customerStats(customerId, sales) {
  const mine = sales.filter((s) => s.customerId === customerId);
  return {
    totalOrders: mine.length,
    totalSpent: mine.reduce((sum, s) => sum + s.total, 0),
    lastPurchase: mine.reduce((latest, s) => (!latest || s.date > latest ? s.date : latest), null),
  };
}
