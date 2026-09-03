export type LineCalculationInput = {
  quantity: number;
  wastePercent: number;
  materialUnitCost: number;
  laborHoursPerUnit: number;
  laborRate: number;
  equipmentCost: number;
  subcontractorCost: number;
  otherDirectCost: number;
  overheadPercent: number;
  profitMarkupPercent: number;
  taxable: boolean;
};

export type LineCalculation = ReturnType<typeof calculateLine>;

export const roundMoney = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100 + Number.EPSILON) / 100;

export const safeNumber = (value: number, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, value));
};

export function calculateLine(input: LineCalculationInput) {
  const quantity = safeNumber(input.quantity);
  const wastePercent = safeNumber(input.wastePercent, 1000);
  const materialUnitCost = safeNumber(input.materialUnitCost);
  const laborHoursPerUnit = safeNumber(input.laborHoursPerUnit);
  const laborRate = safeNumber(input.laborRate);
  const equipmentCost = safeNumber(input.equipmentCost);
  const subcontractorCost = safeNumber(input.subcontractorCost);
  const otherDirectCost = safeNumber(input.otherDirectCost);
  const overheadPercent = safeNumber(input.overheadPercent, 1000);
  const profitMarkupPercent = safeNumber(input.profitMarkupPercent, 1000);

  const adjustedQuantity = safeNumber(quantity * (1 + wastePercent / 100));
  const materialCost = roundMoney(adjustedQuantity * materialUnitCost);
  const totalLaborHours = safeNumber(quantity * laborHoursPerUnit);
  const laborCost = roundMoney(totalLaborHours * laborRate);
  const directCost = roundMoney(materialCost + laborCost + equipmentCost + subcontractorCost + otherDirectCost);
  const overhead = roundMoney(directCost * overheadPercent / 100);
  const costAfterOverhead = roundMoney(directCost + overhead);
  const profit = roundMoney(costAfterOverhead * profitMarkupPercent / 100);
  const sellingPrice = roundMoney(costAfterOverhead + profit);

  return { adjustedQuantity, materialCost, totalLaborHours, laborCost, directCost, overhead, costAfterOverhead, profit, sellingPrice };
}

export function calculateTotals(
  lines: (LineCalculationInput & { sellingPrice?: number })[],
  discountType: "fixed" | "percent",
  discountValue: number,
  salesTaxPercent: number,
  depositPercent: number,
) {
  const amounts = lines.map((line) => safeNumber(line.sellingPrice ?? calculateLine(line).sellingPrice));
  const subtotal = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
  const safeDiscount = safeNumber(discountValue);
  const discountAmount = roundMoney(Math.min(subtotal, discountType === "percent" ? subtotal * safeDiscount / 100 : safeDiscount));
  const taxableSubtotal = roundMoney(lines.reduce((sum, line, index) => sum + (line.taxable ? amounts[index] : 0), 0));
  const taxableShare = subtotal > 0 ? taxableSubtotal / subtotal : 0;
  const taxableAfterDiscount = roundMoney(Math.max(0, taxableSubtotal - discountAmount * taxableShare));
  const salesTaxAmount = roundMoney(taxableAfterDiscount * safeNumber(salesTaxPercent, 100) / 100);
  const total = roundMoney(subtotal - discountAmount + salesTaxAmount);
  const depositRequired = roundMoney(total * safeNumber(depositPercent, 100) / 100);
  return { subtotal, discountAmount, taxableSubtotal, salesTaxAmount, total, depositRequired, remainingBalance: roundMoney(total - depositRequired) };
}

export function calculateInternalSummary(lines: LineCalculation[]) {
  const sum = (field: keyof LineCalculation) => roundMoney(lines.reduce((total, line) => total + Number(line[field]), 0));
  const materialCost = sum("materialCost");
  const laborCost = sum("laborCost");
  const directCost = sum("directCost");
  const overhead = sum("overhead");
  const profit = sum("profit");
  const sellingPrice = sum("sellingPrice");
  return { materialCost, laborCost, directCost, overhead, profit, sellingPrice, grossMarginPercent: sellingPrice > 0 ? roundMoney(profit / sellingPrice * 100) : 0 };
}
