/** Explicit wire boundary: persisted/API quotes are paise; UI prices are rupees. */
export function quoteForDisplay(quote) {
  if (!quote || quote.moneyUnit !== 'PAISE') return quote;
  const range = quote.estimateRange || {};
  const details = quote.checkoutDetails || {};
  return {
    ...quote,
    moneyUnit: 'INR',
    subtotal: quote.subtotal / 100,
    gstAmount: quote.gstAmount / 100,
    total: quote.total / 100,
    items: (quote.items || []).map((item) => ({ ...item, price: item.price / 100 })),
    estimateRange: { ...range, low: range.low / 100, mid: range.mid / 100, high: range.high / 100 },
    checkoutDetails: {
      ...details,
      amountPaid: (details.amountPaid || 0) / 100,
      pendingOrderAmount: (details.pendingOrderAmount || 0) / 100,
    },
  };
}
