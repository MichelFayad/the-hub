import { randomUUID } from "crypto";

// Payment-provider abstraction (scope §7, §10). The real gateway
// (2Checkout/Verifone) is blocked on Lebanon merchant-account approval —
// the same risk gate as the SMS OTP provider — so boost checkout is
// isolated behind this interface per the scope doc's own recommendation,
// letting the provider swap in later without touching boosts.ts.

export interface ChargeRequest {
  amountCents: number;
  currency: "USD";
  description: string;
}

export interface ChargeResult {
  success: true;
  transactionId: string;
}

export interface PaymentProvider {
  charge(req: ChargeRequest): Promise<ChargeResult>;
}

/** Stand-in provider until a real gateway is approved and wired in. */
export const manualPaymentProvider: PaymentProvider = {
  async charge(_req) {
    return { success: true, transactionId: `manual_${randomUUID()}` };
  },
};
