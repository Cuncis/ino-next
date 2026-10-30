import { and, asc, desc, eq, ne } from "drizzle-orm";
import { customerAddresses, db, regions } from "@/db";
import { fullAddress } from "./branches";

/**
 * A signed-in customer's saved addresses. Every read and write is scoped to that
 * customer; nobody reaches another customer's address by id. Ported from
 * Shop\AddressController and CustomerAddressPresenter.
 */
type Address = typeof customerAddresses.$inferSelect;

export function presentAddress(address: Address): SavedAddress {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine: address.addressLine,
    kelurahan: address.kelurahan,
    kecamatan: address.kecamatan,
    kota: address.kota,
    provinsi: address.provinsi,
    postalCode: address.postalCode,
    note: address.note,
    latitude: address.latitude !== null ? Number(address.latitude) : null,
    longitude: address.longitude !== null ? Number(address.longitude) : null,
    isDefault: address.isDefault,
    fullAddress: fullAddress(address),
  } as SavedAddress;
}

/** Default first, then newest. */
export async function customerAddressList(customerId: number): Promise<SavedAddress[]> {
  const rows = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.id));

  return rows.map(presentAddress);
}

export async function findCustomerAddress(customerId: number, addressId: number): Promise<Address | null> {
  const [address] = await db
    .select()
    .from(customerAddresses)
    .where(and(eq(customerAddresses.customerId, customerId), eq(customerAddresses.id, addressId)))
    .limit(1);

  return address ?? null;
}

/** The Provinsi dropdown's options, sent with the page (Kota and below are fetched from /wilayah). */
export async function provinceOptions(): Promise<{ code: string; name: string }[]> {
  return db.select({ code: regions.code, name: regions.name }).from(regions).where(eq(regions.level, 1)).orderBy(asc(regions.name));
}

export async function makeDefaultAddress(customerId: number, addressId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(customerAddresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(customerAddresses.customerId, customerId), ne(customerAddresses.id, addressId)));
    await tx.update(customerAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(customerAddresses.id, addressId));
  });
}
