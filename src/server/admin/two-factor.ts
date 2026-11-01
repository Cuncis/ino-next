import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db, users } from "@/db";
import { encryptString } from "@/lib/laravel-crypt";
import { randomString } from "@/lib/random";
import { generateSecret, otpauthUrl, verifyTotp } from "@/lib/totp";
import { auditLog } from "@/server/audit";
import { findStaff, hasEnabledTwoFactor, twoFactorSecret, type Staff } from "./staff-auth";

/**
 * A staff member's own 2FA setup, ported from App\Filament\Pages\Security. "Aktifkan"
 * makes a secret and recovery codes without enforcing them; "Konfirmasi" turns 2FA on
 * once a code from the authenticator app proves it scans correctly.
 */
export type SecurityState = { enabled: boolean; pending: boolean; qrSvg: string | null; secret: string | null };

export async function securityState(staff: Staff): Promise<SecurityState> {
  const secret = twoFactorSecret(staff);
  const pending = Boolean(secret && !staff.twoFactorConfirmedAt);

  return {
    enabled: hasEnabledTwoFactor(staff),
    pending,
    // Google2FA::getQRCodeInline(): a 200px SVG of the otpauth:// link
    qrSvg: pending && secret ? await QRCode.toString(otpauthUrl("Inofarma Admin", staff.email, secret), { type: "svg", width: 200, margin: 0 }) : null,
    secret: pending ? secret : null,
  };
}

/** Eight codes like `K7Q2-PX9D` (Str::upper(Str::random(4).'-'.Str::random(4))). */
function newRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => `${randomString(4)}-${randomString(4)}`.toUpperCase());
}

async function save(staff: Staff, changes: Partial<typeof users.$inferInsert>) {
  await db
    .update(users)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(users.id, staff.id));
}

export async function activateTwoFactor(staff: Staff): Promise<string[]> {
  const codes = newRecoveryCodes();

  await save(staff, { twoFactorSecret: encryptString(generateSecret()), twoFactorRecoveryCodes: encryptString(JSON.stringify(codes)), twoFactorConfirmedAt: null });

  return codes;
}

/** True when the code matches the pending secret, and 2FA is now on. */
export async function confirmTwoFactor(staff: Staff, code: string): Promise<boolean> {
  const fresh = (await findStaff(staff.id)) ?? staff;
  const secret = twoFactorSecret(fresh);

  if (!secret || !verifyTotp(secret, code)) {
    return false;
  }

  await save(fresh, { twoFactorConfirmedAt: new Date() });
  await auditLog({ action: "2fa_confirmed", auditable: { type: "App\\Models\\User", id: staff.id }, userId: staff.id, branchId: staff.branchId });

  return true;
}

export async function regenerateRecoveryCodes(staff: Staff): Promise<string[]> {
  const codes = newRecoveryCodes();

  await save(staff, { twoFactorRecoveryCodes: encryptString(JSON.stringify(codes)) });

  return codes;
}

export async function disableTwoFactor(staff: Staff): Promise<void> {
  await save(staff, { twoFactorSecret: null, twoFactorRecoveryCodes: null, twoFactorConfirmedAt: null });
  await auditLog({ action: "2fa_disabled", auditable: { type: "App\\Models\\User", id: staff.id }, userId: staff.id, branchId: staff.branchId });
}
