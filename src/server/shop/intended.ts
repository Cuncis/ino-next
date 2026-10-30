/**
 * Where to go after signing in: the protected page a visitor was sent away from
 * (Laravel's `customer_intended` session value). Set by src/proxy.ts, read by /signin.
 */
export const INTENDED_COOKIE = "customer_intended";
