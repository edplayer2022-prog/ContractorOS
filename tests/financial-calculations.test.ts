import test from "node:test";
import assert from "node:assert/strict";
import { calculateInvoice, depositAmount, finalInvoiceAmount, invoicePaymentStatus, projectFinancials } from "../lib/financial-calculations.ts";

test("30% deposit on a $10,000 contract is $3,000",()=>assert.equal(depositAmount(10000,30),3000));
test("partial payment leaves balance and partial status",()=>{const value=calculateInvoice([{quantity:1,unitPrice:3000,taxable:false}],0,0,1000);assert.equal(value.balanceDue,2000);assert.equal(invoicePaymentStatus(value.total,value.amountPaid,"sent"),"partial");});
test("full payment marks invoice paid",()=>assert.equal(invoicePaymentStatus(3000,3000,"partial"),"paid"));
test("approved change orders increase current contract value",()=>assert.equal(projectFinancials(10000,2500,0,0,0).currentContractValue,12500));
test("progress billing tracks unbilled amount",()=>assert.equal(projectFinancials(20000,0,5000,0,0).unbilledAmount,15000));
test("final invoice is remaining billable amount",()=>assert.equal(finalInvoiceAmount(20000,15000),5000));
test("past-due unpaid sent invoice is overdue",()=>assert.equal(invoicePaymentStatus(1000,0,"sent","2025-01-01","2025-01-02"),"overdue"));
test("voided payment can restore sent status",()=>assert.equal(invoicePaymentStatus(3000,0,"partial"),"partial"));
test("invoice calculation clamps invalid values and rounds currency",()=>{const value=calculateInvoice([{quantity:Number.NaN,unitPrice:12,taxable:true},{quantity:3,unitPrice:10.005,taxable:true}],1,7.25);assert.equal(value.subtotal,30.03);assert.equal(value.total,31.13);});
test("project balances use contract, invoices, and payments",()=>assert.deepEqual(projectFinancials(10000,2000,8000,3000,4500),{originalContractValue:10000,approvedChangeOrders:2000,currentContractValue:12000,totalInvoiced:8000,totalPaid:3000,outstandingBalance:5000,unbilledAmount:4000,projectedProfit:7500}));

