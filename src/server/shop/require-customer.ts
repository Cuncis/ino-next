import { redirect } from "next/navigation";
import { currentCustomer, type Customer } from "./customer-auth";

/**
 * For pages behind Laravel's `customer` middleware. src/proxy.ts already sent signed-out
 * visitors to /signin (remembering where they were going); this checks again, as every
 * protected page and action should.
 */
export async function requireCustomer(): Promise<Customer> {
  const customer = await currentCustomer();

  if (!customer || customer.status !== "aktif") {
    redirect("/signin");
  }

  return customer;
}
