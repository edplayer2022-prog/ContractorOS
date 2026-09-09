import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyStripeSignature(body: string, header: string | null, secret: string, now = Date.now()) {
 if (!header || !secret) return false;
 const parts = header.split(",").map(part => part.split("="));
 const timestamp = parts.find(([key]) => key === "t")?.[1];
 if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
 const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest();
 return parts.filter(([key]) => key === "v1").some(([, value]) => /^[a-f0-9]{64}$/i.test(value || "") && timingSafeEqual(expected, Buffer.from(value, "hex")));
}
