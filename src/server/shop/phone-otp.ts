import type { Customer } from "./customer-auth";

/**
 * There is no SMS gateway yet, so outside production the phone code is written to the
 * server log and shown in the flash banner, letting a tester finish the flow. In
 * production neither happens: a leaked code would be an account-takeover risk.
 */
export function otpThrottleKey(customerId: number): string {
  return `phone-otp:${customerId}`;
}

export function logOtp(customer: Pick<Customer, "phone">, code: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.info(`OTP untuk ${customer.phone}: ${code}`);
  }
}

export function otpFlashMessage(code: string, resent = false): string {
  const sent = resent ? "Kode OTP baru telah dikirim." : "Kode OTP telah dikirim.";

  return process.env.NODE_ENV === "production" ? sent : `${sent} (mode pengembangan, tanpa SMS gateway: ${code})`;
}
