const BASE64URL = {
  encode(value) {
    return Buffer.from(value, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  },
  decode(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (normalized.length % 4 || 4)) % 4;
    return Buffer.from(normalized + "=".repeat(padding), "base64").toString("utf8");
  },
};

export const X402_HEADERS = {
  PAYMENT_REQUIRED: "payment-required",
  PAYMENT_SIGNATURE: "payment-signature",
  PAYMENT_RESPONSE: "payment-response",
};

export function decodePaymentRequired(value) {
  if (!value) return null;
  return JSON.parse(BASE64URL.decode(value));
}

export function encodePaymentPayload(value) {
  return BASE64URL.encode(JSON.stringify(value));
}

export function decodePaymentResponse(value) {
  if (!value) return null;
  try {
    return JSON.parse(BASE64URL.decode(value));
  } catch {
    return null;
  }
}
