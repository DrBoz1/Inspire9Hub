export type PaymentRow = {
  amount: number | null;
  refunded_amount: number | null;
  payment_status: string | null;
  payment_date?: string | null;
};

export type FinancialSummary = {
  totalPaid: number;
  totalRefunded: number;
  netSpend: number;
};

export function summarizePayments(payments: PaymentRow[]): FinancialSummary {
  let totalPaid = 0;
  let totalRefunded = 0;
  let netSpend = 0;

  for (const p of payments) {
    const amount = Number(p.amount) || 0;
    if (p.payment_status === "paid") {
      totalPaid += amount;
      netSpend += amount;
    } else if (p.payment_status === "refunded") {
      const refunded = Number(p.refunded_amount ?? p.amount) || 0;
      totalPaid += amount;
      totalRefunded += refunded;
      netSpend += amount - refunded;
    } else if (p.payment_status === "refund_failed") {
      totalPaid += amount;
      netSpend += amount;
    }
  }

  return { totalPaid, totalRefunded, netSpend };
}
