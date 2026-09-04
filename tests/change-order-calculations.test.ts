import assert from "node:assert/strict";
import test from "node:test";
import { calculateChangeOrder } from "../lib/change-order-calculations.ts";

test("calculates taxable and non-taxable change order items",()=>{const result=calculateChangeOrder([{quantity:2,unitPrice:100,taxable:true},{quantity:1,unitPrice:50,taxable:false}],8,1000,200);assert.deepEqual(result.rows.map(row=>row.amount),[200,50]);assert.equal(result.subtotal,250);assert.equal(result.tax,16);assert.equal(result.total,266);assert.equal(result.newContractValue,1466);});
test("new contract value excludes unapproved future changes",()=>{const result=calculateChangeOrder([{quantity:1,unitPrice:500,taxable:false}],0,10000,750);assert.equal(result.newContractValue,11250);});
test("invalid negative values are clamped",()=>{const result=calculateChangeOrder([{quantity:-2,unitPrice:100,taxable:true}],8,-100,-50);assert.equal(result.total,0);assert.equal(result.newContractValue,0);});
