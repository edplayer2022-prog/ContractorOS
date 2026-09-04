import assert from "node:assert/strict";
import test from "node:test";
import { containsForbiddenPublicField,FORBIDDEN_PUBLIC_FIELDS,PUBLIC_TOKEN_PATTERN } from "../lib/public-document-types.ts";

test("accepts secure UUID public tokens and rejects estimate IDs",()=>{assert.equal(PUBLIC_TOKEN_PATTERN.test("32b0ca2c-4cc1-4e8f-9e8e-6c0bd2b9710f"),true);assert.equal(PUBLIC_TOKEN_PATTERN.test("12345"),false);});
test("customer payload rejects every internal financial field",()=>{for(const key of FORBIDDEN_PUBLIC_FIELDS)assert.equal(containsForbiddenPublicField({company:{name:"Safe"},nested:{[key]:10}}),true,key);});
test("customer-safe payload passes the exposure guard",()=>{assert.equal(containsForbiddenPublicField({company:{name:"Acme"},items:[{description:"Framing",quantity:10,unit:"linear_foot",amount:900}],summary:{subtotal:900,tax:63,total:963}}),false);});
