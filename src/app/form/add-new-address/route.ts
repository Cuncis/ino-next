import { count, eq } from "drizzle-orm";
import { customerAddresses, db } from "@/db";
import { jsonBody, redirectTo } from "@/lib/http";
import { validate, validationErrorResponse } from "@/lib/validation";
import { customerForAction } from "@/server/shop/customer-guard";

type AddressInput = {
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string;
  provinsi: string;
  postalCode: string | null;
  note: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
};

/** POST /add-new-address (customer). Ported from Shop\AddressController::store(). */
export async function POST(request: Request) {
  const { customer, response } = await customerForAction(request);

  if (response) {
    return response;
  }

  const result = validate<AddressInput>(
    await jsonBody(request),
    {
      label: ["required", "string", "max:60"],
      recipientName: ["required", "string", "max:255"],
      phone: ["required", "string", "max:30"],
      addressLine: ["required", "string", "max:255"],
      kelurahan: ["nullable", "string", "max:255"],
      kecamatan: ["nullable", "string", "max:255"],
      kota: ["required", "string", "max:255"],
      provinsi: ["required", "string", "max:255"],
      postalCode: ["nullable", "string", "max:10"],
      note: ["nullable", "string", "max:255"],
      latitude: ["nullable", "numeric", "between:-90,90"],
      longitude: ["nullable", "numeric", "between:-180,180"],
    },
    {},
    { label: "label alamat", recipientName: "nama penerima", addressLine: "alamat lengkap", kota: "kota/kabupaten", provinsi: "provinsi" },
  );

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const data = result.data;
  const [{ existing }] = await db.select({ existing: count() }).from(customerAddresses).where(eq(customerAddresses.customerId, customer.id));
  const now = new Date();

  await db.insert(customerAddresses).values({
    customerId: customer.id,
    label: data.label,
    recipientName: data.recipientName,
    phone: data.phone,
    addressLine: data.addressLine,
    kelurahan: data.kelurahan ?? null,
    kecamatan: data.kecamatan ?? null,
    kota: data.kota,
    provinsi: data.provinsi,
    postalCode: data.postalCode ?? null,
    note: data.note ?? null,
    latitude: data.latitude === null || data.latitude === undefined ? null : String(data.latitude),
    longitude: data.longitude === null || data.longitude === undefined ? null : String(data.longitude),
    // the first address becomes the default
    isDefault: existing === 0,
    createdAt: now,
    updatedAt: now,
  });

  return redirectTo(request, "/my-address", { success: "Alamat berhasil ditambahkan." });
}
