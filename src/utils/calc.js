export const round2 = (n) => Math.round(n * 100) / 100;
export const purchaseLineTotal = (i) => round2(i.qty * i.unitCost);
export const purchaseTotals = (items, taxRate) => {
  const subtotal = round2(items.reduce((s, i) => s + purchaseLineTotal(i), 0));
  const tax = round2((subtotal * taxRate) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
};
export const saleLineGross = (i) => round2(i.qty * i.price);
export const saleLineTotal = (i) => round2(i.qty * i.price * (1 - i.discount / 100));
export const saleTotals = (items) => {
  const subtotal = round2(items.reduce((s, i) => s + saleLineGross(i), 0));
  const total = round2(items.reduce((s, i) => s + saleLineTotal(i), 0));
  return { subtotal, discount: round2(subtotal - total), total };
};
