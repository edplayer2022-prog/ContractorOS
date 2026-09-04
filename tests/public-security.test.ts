import assert from "node:assert/strict";
import test from "node:test";
import { containsForbiddenPublicField,FORBIDDEN_PUBLIC_FIELDS,PUBLIC_TOKEN_PATTERN } from "../lib/public-document-types.ts";

test("accepts secure UUID public tokens and rejects estimate IDs",()=>{assert.equal(PUBLIC_TOKEN_PATTERN.test("32b0ca2c-4cc1-4e8f-9e8e-6c0bd2b9710f"),true);assert.equal(PUBLIC_TOKEN_PATTERN.test("12345"),false);});
test("customer payload rejects every internal financial field",()=>{for(const key of FORBIDDEN_PUBLIC_FIELDS)assert.equal(containsForbiddenPublicField({company:{name:"Safe"},nested:{[key]:10}}),true,key);});
test("customer-safe payload passes the exposure guard",()=>{assert.equal(containsForbiddenPublicField({company:{name:"Acme"},items:[{description:"Framing",quantity:10,unit:"linear_foot",amount:900}],summary:{subtotal:900,tax:63,total:963}}),false);});
test("public invoice exposes billing fields but no internal notes or profitability",()=>{const safe={kind:"invoice",invoice:{invoice_number:"INV-1",payment_terms:"Net 30"},items:[{description:"Project Deposit",quantity:1,unit_price:3000,amount:3000}],summary:{total:3000,amount_paid:1000,balance_due:2000}};assert.equal(containsForbiddenPublicField(safe),false);assert.equal(containsForbiddenPublicField({...safe,invoice:{...safe.invoice,internal_notes:"private"}}),true);assert.equal(containsForbiddenPublicField({...safe,projected_profit:1000}),true);});

