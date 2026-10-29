import { asc, eq, isNull } from "drizzle-orm";
import { db, regions } from "@/db";
import { validate, validationErrorResponse } from "@/lib/validation";

/**
 * The Provinsi/Kota/Kecamatan/Kelurahan cascade on the address forms, read from the
 * self-hosted `regions` table. Provinsi has no parent; every other level needs `parent`.
 * Ported from Shop\RegionController.
 */
export async function GET(request: Request) {
  const result = validate<{ parent: string | null }>(Object.fromEntries(new URL(request.url).searchParams), {
    parent: ["nullable", "string", "max:13"],
  });

  if (result.errors) {
    return validationErrorResponse(result.errors);
  }

  const parent = result.data.parent;
  const rows = await db
    .select({ code: regions.code, name: regions.name, postalCode: regions.postalCode })
    .from(regions)
    .where(parent ? eq(regions.parentCode, parent) : isNull(regions.parentCode))
    .orderBy(asc(regions.name));

  return Response.json({ options: rows });
}
