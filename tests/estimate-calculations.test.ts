import assert from "node:assert/strict";
import test from "node:test";
import { calculateInternalSummary, calculateLine, calculateTotals, type LineCalculationInput } from "../lib/estimate-calculations.ts";

const base: LineCalculationInput = {
  quantity: 100, wastePercent: 5, materialUnitCost: 2, laborHoursPerUnit: 0.1, laborRate: 50,
  equipmentCost: 0, subcontractorCost: 0, otherDirectCost: 0, overheadPercent: 10,
  profitMarkupPercent: 20, taxable: true,
};

test("100 LF framing with waste, labor, overhead and markup", () => {
  assert.deepEqual(calculateLine(base), { adjustedQuantity: 105, materialCost: 210, totalLaborHours: 10, laborCost: 500, directCost: 710, overhead: 71, costAfterOverhead: 781, profit: 156.2, sellingPrice: 937.2 });
});

test("labor-only service", () => {
  const result = calculateLine({ ...base, quantity: 8, wastePercent: 0, materialUnitCost: 0, laborHoursPerUnit: 1, overheadPercent: 0, profitMarkupPercent: 0 });
  assert.equal(result.materialCost, 0); assert.equal(result.laborCost, 400); assert.equal(result.sellingPrice, 400);
});

test("subcontractor service", () => {
  const result = calculateLine({ ...base, quantity: 1, wastePercent: 0, materialUnitCost: 0, laborHoursPerUnit: 0, subcontractorCost: 1000, overheadPercent: 10, profitMarkupPercent: 20 });
  assert.equal(result.sellingPrice, 1320);
});

test("tax applies only to taxable line items", () => {
  const taxable = { ...base, quantity: 1, wastePercent: 0, materialUnitCost: 100, laborHoursPerUnit: 0, overheadPercent: 0, profitMarkupPercent: 0, taxable: true };
  const result = calculateTotals([taxable, { ...taxable, taxable: false }], "fixed", 0, 10, 0);
  assert.equal(result.salesTaxAmount, 10);
  assert.equal(result.total, 210);
});

test("fixed discount is allocated proportionally to taxable items", () => {
  const taxable = { ...base, quantity: 1, wastePercent: 0, materialUnitCost: 100, laborHoursPerUnit: 0, overheadPercent: 0, profitMarkupPercent: 0, taxable: true };
  const result = calculateTotals([taxable, { ...taxable, taxable: false }], "fixed", 20, 10, 0);
  assert.equal(result.discountAmount, 20);
  assert.equal(result.salesTaxAmount, 9);
  assert.equal(result.total, 189);
});

test("deposit percentage and remaining balance", () => {
  const labor = { ...base, quantity: 2, wastePercent: 0, materialUnitCost: 0, laborHoursPerUnit: 1, laborRate: 50, overheadPercent: 0, profitMarkupPercent: 0, taxable: false };
  const result = calculateTotals([labor], "fixed", 0, 0, 30);
  assert.equal(result.total, 100);
  assert.equal(result.depositRequired, 30);
  assert.equal(result.remainingBalance, 70);
});

test("negative and invalid values never produce NaN", () => {
  const line = calculateLine({ ...base, quantity: Number.NaN, materialUnitCost: -10, laborRate: Number.POSITIVE_INFINITY });
  assert.equal(line.sellingPrice, 0); assert.equal(calculateInternalSummary([line]).grossMarginPercent, 0);
});
