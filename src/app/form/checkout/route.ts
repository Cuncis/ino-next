import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { customers, db } from "@/db";
import { nextCode } from "@/lib/code-sequence";
import { csrfMismatchResponse, isSameOrigin, jsonBody, redirectTo, wantsJson } from "@/lib/http";
import { throttle } from "@/lib/rate-limit";
import { addError, prepareInput, validate, validationErrorResponse, validationExceptionResponse, ValidationException, type Rules } from "@/lib/validation";
import { createPaymentForOrder } from "@/server/payments/doku-payment";
import { quoteShipping, ShippingUnavailableError, type CourierQuote } from "@/server/shipping/quote";
import { assertWithinPurchaseLimit, CartManager, deliveryBranch } from "@/server/shop/cart";
import {
  draftAddressIsComplete,
  makeDraftAddress,
  pickupBranchFor,
  placeOrder,
  saveDraftAddress,
  type AddressFields,
  type DraftAddress,
} from "@/server/shop/checkout";
import { CONSENT_VERSION, currentCustomer, hashPassword, loginCustomer, sendEmailVerification, type Customer } from "@/server/shop/customer-auth";
import { PHONE_REGEX_MESSAGE } from "@/server/shop/phone-rules";

type CheckoutInput = AddressFields & {
  fulfilment: "antar" | "ambil";
  paymentMethod: string;
  pickupBranchId: string | null;
  courier: { courierCompany?: string | null; courierType?: string | null } | null;
  note: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
};

/**
 * POST /checkout (throttle:10,1; rewritten here by src/proxy.ts). Ported from
 * Shop\CheckoutController::store(). One form for everyone: a guest also says who they
 * are and agrees to the privacy policy, and anyone without a saved address types one in.
 * A guest becomes a real account only once everything that can be refused has been.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return csrfMismatchResponse();
  }

  const limited = await throttle("checkout", 10, 1);

  if (limited) {
    return limited;
  }

  try {
    return await checkout(request);
  } catch (error) {
    return validationExceptionResponse(error);
  }
}

async function checkout(request: Request): Promise<Response> {
  let customer = await currentCustomer();
  let cart = new CartManager(customer);
  const data = await cart.current();

  if (!data.branch || data.lines.length === 0) {
    return redirectTo(request, "/cart", { error: "Keranjang Anda masih kosong." });
  }

  const isGuest = !customer;
  const needsAddress = !data.address;
  const body = await jsonBody(request);
  const fulfilmentInput = (prepareInput(body) as Record<string, unknown>).fulfilment;
  const addressRequired = needsAddress && fulfilmentInput === "antar" ? ["required"] : [];
  const guestRequired = isGuest ? ["required"] : [];

  const rules: Rules = {
    fulfilment: ["required", "in:antar,ambil"],
    paymentMethod: ["required", "in:online"],
    pickupBranchId: ["required_if:fulfilment,ambil", "nullable", "string"],
    courier: ["nullable", "array"],
    "courier.courierCompany": ["nullable", "string"],
    "courier.courierType": ["nullable", "string"],
    note: ["nullable", "string", "max:500"],
    name: [...guestRequired, "nullable", "string", "max:255"],
    phone: [...guestRequired, "nullable", "string", "max:30", "regex:/^[0-9+\\-\\s()]+$/"],
    email: [...guestRequired, "nullable", "email", "max:255"],
    consent: isGuest ? ["accepted"] : ["nullable"],
    addressLine: [...addressRequired, "nullable", "string", "max:255"],
    kelurahan: ["nullable", "string", "max:255"],
    kecamatan: ["nullable", "string", "max:255"],
    kota: [...addressRequired, "nullable", "string", "max:255"],
    provinsi: [...addressRequired, "nullable", "string", "max:255"],
    postalCode: ["nullable", "string", "max:10"],
    latitude: ["nullable", "numeric", "between:-90,90"],
    longitude: ["nullable", "numeric", "between:-180,180"],
  };
  const result = validate<CheckoutInput>(
    body,
    rules,
    { "phone.regex": PHONE_REGEX_MESSAGE, "consent.accepted": "Anda harus menyetujui Kebijakan Privasi untuk melanjutkan." },
    { addressLine: "alamat lengkap", kota: "kota/kabupaten", provinsi: "provinsi" },
  );
  let errors = result.errors;
  const email = (prepareInput(body) as Record<string, unknown>).email;

  // `unique:customers,email` runs whenever an email was given, even after another rule failed
  if (typeof email === "string" && (await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1)).length) {
    errors = addError(errors, "email", "Email ini sudah terdaftar. Silakan masuk untuk melanjutkan.");
  }

  if (errors || !result.data) {
    return validationErrorResponse(errors ?? {});
  }

  const input = result.data;

  assertWithinPurchaseLimit(data.lines);

  let address: (typeof data)["address"] | DraftAddress = data.address;

  if (!address && draftAddressIsComplete(input)) {
    address = await makeDraftAddress({ ...input, recipientName: customer?.name ?? input.name, recipientPhone: customer?.phone ?? input.phone });
  }

  let branch = data.branch;
  let courierQuote: CourierQuote | undefined;

  if (input.fulfilment === "antar") {
    const origin = await deliveryBranch(branch, data.lines);

    if (!origin) {
      throw ValidationException.withMessages({ fulfilment: "Pesanan ini belum bisa diantar. Pilih ambil di toko." });
    }

    branch = origin;

    if (!address) {
      throw ValidationException.withMessages({ address: "Isi alamat pengiriman terlebih dahulu." });
    }

    if (!input.courier?.courierCompany || !input.courier.courierType) {
      throw ValidationException.withMessages({ courier: "Pilih kurir terlebih dahulu." });
    }

    // Quoted again rather than trusted from the browser: a price seen a minute ago may
    // no longer be the cheapest, or exist at all.
    let quotes: CourierQuote[];

    try {
      quotes = await quoteShipping(branch, address, data.lines);
    } catch (error) {
      console.error(error);

      if (error instanceof ShippingUnavailableError) {
        throw ValidationException.withMessages({ courier: error.customerMessage });
      }

      quotes = [];
    }

    courierQuote = quotes.find((quote) => quote.courierCompany === input.courier!.courierCompany && quote.courierType === input.courier!.courierType);

    if (!courierQuote) {
      throw ValidationException.withMessages({ courier: "Pilihan kurir tidak lagi tersedia, muat ulang halaman checkout." });
    }
  } else {
    // Pickup is chosen here: the order is placed at the branch the shopper collects from,
    // which may not be the branch the cart was started with.
    branch = await pickupBranchFor(input.pickupBranchId);
  }

  await cart.assertCouponStillUsable(data.coupon, branch, data.lines);

  if (!customer) {
    customer = await registerGuest(cart, input);
    cart = new CartManager(customer);
  }

  // A typed address is saved to the account now; the order keeps the point it was quoted from.
  const orderAddress = address && address.id === undefined ? await saveDraftAddress(customer, address) : address;

  if (orderAddress) {
    await cart.setAddress(orderAddress);
  }

  // The quoted address, not a reloaded one: a saved address without a map point was
  // located from its postal code in memory only, and the order must keep that point.
  const order = await placeOrder({
    customer,
    data: { ...(await cart.current()), address: orderAddress },
    branch,
    fulfilment: input.fulfilment,
    paymentMethod: input.paymentMethod,
    note: input.note,
    courierQuote,
  });

  await cart.clear();

  let checkoutUrl: string | null;

  try {
    checkoutUrl = (await createPaymentForOrder(order)).checkoutUrl;
  } catch (error) {
    console.error(error);

    return redirectTo(request, `/pesanan/${order.number}`, {
      error: `Pesanan #${order.number} berhasil dibuat, tapi gagal membuka halaman pembayaran. Coba lagi dari halaman ini.`,
    });
  }

  // Inertia::location(): the browser leaves for DOKU's payment page
  return wantsJson(request) ? Response.json({ location: checkoutUrl }, { status: 409 }) : Response.redirect(checkoutUrl ?? "/", 303);
}

/**
 * A guest checkout quietly creates a real account (a random password nobody sees; "Lupa
 * kata sandi" sets one later) and signs it in, so payment, tracking and order history
 * treat the order like any other. The guest's cart comes along.
 */
async function registerGuest(guestCart: CartManager, input: CheckoutInput): Promise<Customer> {
  const now = new Date();
  const [customer] = await db
    .insert(customers)
    .values({
      code: await nextCode({ table: customers, column: customers.code, prefix: "CUS-" }),
      name: input.name!,
      phone: input.phone,
      email: input.email!,
      password: await hashPassword(randomBytes(30).toString("base64url").slice(0, 40)),
      status: "aktif",
      consentAt: now,
      consentVersion: CONSENT_VERSION,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await loginCustomer(customer);
  await guestCart.mergeGuestIntoCustomer(customer);
  await sendEmailVerification(customer);

  return customer;
}
