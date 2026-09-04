import { roundMoney, safeNumber } from "./estimate-calculations.ts";

export type ChangeOrderCalculationItem={quantity:number;unitPrice:number;taxable:boolean};
export function calculateChangeOrder(items:ChangeOrderCalculationItem[],salesTaxPercent:number,originalApprovedEstimate:number,previousApprovedChanges:number){
  const rows=items.map(item=>({amount:roundMoney(safeNumber(item.quantity)*safeNumber(item.unitPrice)),taxable:item.taxable}));
  const subtotal=roundMoney(rows.reduce((sum,row)=>sum+row.amount,0));
  const taxableSubtotal=roundMoney(rows.filter(row=>row.taxable).reduce((sum,row)=>sum+row.amount,0));
  const tax=roundMoney(taxableSubtotal*safeNumber(salesTaxPercent,100)/100);
  const total=roundMoney(subtotal+tax);
  return{rows,subtotal,tax,total,newContractValue:roundMoney(safeNumber(originalApprovedEstimate)+safeNumber(previousApprovedChanges)+total)};
}
