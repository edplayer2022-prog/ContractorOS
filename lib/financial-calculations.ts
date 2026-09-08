const money = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(0, number) * 100) / 100 : 0;
};

export type InvoiceLineInput = { quantity: number; unitPrice: number; taxable: boolean };

export function calculateInvoice(lines: InvoiceLineInput[], discount = 0, taxPercent = 0, amountPaid = 0) {
  const rows = lines.map((line) => ({ ...line, amount: money(money(line.quantity) * money(line.unitPrice)) }));
  const subtotal = money(rows.reduce((sum, row) => sum + row.amount, 0));
  const safeDiscount = Math.min(subtotal, money(discount));
  const taxableSubtotal = money(rows.filter((row) => row.taxable).reduce((sum, row) => sum + row.amount, 0));
  const taxableRatio = subtotal > 0 ? taxableSubtotal / subtotal : 0;
  const taxableAfterDiscount = money(Math.max(0, taxableSubtotal - safeDiscount * taxableRatio));
  const tax = money(taxableAfterDiscount * money(taxPercent) / 100);
  const total = money(subtotal - safeDiscount + tax);
  const paid = money(amountPaid);
  return { rows, subtotal, discount: safeDiscount, tax, total, amountPaid: paid, balanceDue: money(Math.max(0, total - paid)), overpayment: money(Math.max(0, paid - total)) };
}

export function invoicePaymentStatus(total: number, paid: number, previous: "draft"|"sent"|"viewed"|"partial"|"paid"|"overdue"|"void", dueDate?: string, today = new Date().toISOString().slice(0,10)) {
  if (previous === "void") return "void" as const;
  const safeTotal = money(total), safePaid = money(paid);
  if (safePaid >= safeTotal && safeTotal > 0) return "paid" as const;
  if (safePaid > 0) return "partial" as const;
  if (dueDate && dueDate < today && previous !== "draft") return "overdue" as const;
  return previous === "overdue" ? "sent" as const : previous;
}

export function projectFinancials(original: number, approvedChanges: number, invoiced: number, paid: number, actualCost: number) {
  const originalContractValue = money(original);
  const approvedChangeOrders = money(approvedChanges);
  const currentContractValue = money(originalContractValue + approvedChangeOrders);
  const totalInvoiced = money(invoiced);
  const totalPaid = money(paid);
  const outstandingBalance = money(Math.max(0, totalInvoiced - totalPaid));
  const unbilledAmount = money(Math.max(0, currentContractValue - totalInvoiced));
  const projectedProfit = money(currentContractValue - money(actualCost));
  return { originalContractValue, approvedChangeOrders, currentContractValue, totalInvoiced, totalPaid, outstandingBalance, unbilledAmount, projectedProfit };
}

export function depositAmount(contractValue: number, percent: number) { return money(money(contractValue) * money(percent) / 100); }
export function finalInvoiceAmount(contractValue: number, previouslyInvoiced: number) { return money(Math.max(0, money(contractValue) - money(previouslyInvoiced))); }
