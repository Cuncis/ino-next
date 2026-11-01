import type { Metadata } from "next";
import { AdminShell, adminContext } from "@/components/admin/filament/AdminShell";
import { findStaff } from "@/server/admin/staff-auth";
import { securityState } from "@/server/admin/two-factor";
import SecurityPage from "@/views/admin/SecurityActions";

export const metadata: Metadata = { title: "Keamanan - Inofarma" };

/** GET /admin/keamanan: the staff member's own 2FA (App\Filament\Pages\Security). */
export default async function Page() {
  const context = await adminContext();
  const { t } = context;
  const staff = (await findStaff(context.staff.id)) ?? context.staff;

  return (
    <AdminShell context={context} pathname="/admin/keamanan">
      <div className="fi-page">
        <div className="fi-page-header-main-ctn">
          <SecurityPage
            state={await securityState(staff)}
            labels={{
              heading: t("Keamanan"),
              activate: t("Aktifkan 2FA"),
              confirm: t("Konfirmasi"),
              regenerate: t("Buat Kode Pemulihan Baru"),
              disable: t("Nonaktifkan 2FA"),
              code: t("Kode Authenticator"),
              submit: t("Kirim"),
              cancel: t("Batal"),
              close: t("Tutup"),
              sure: t("Apakah Anda yakin ingin melakukan ini?"),
              confirmButton: context.locale === "en" ? "Confirm" : "Konfirmasi",
              codesHeading: t("Simpan kode pemulihan ini di tempat aman. Setiap kode hanya bisa dipakai sekali."),
              intro: t('Pindai kode QR ini dengan aplikasi authenticator Anda (Google Authenticator, Authy, dll), lalu masukkan kode 6 digit yang muncul lewat tombol "Konfirmasi" di atas.'),
              manual: t("Tidak bisa memindai? Masukkan kunci ini secara manual:"),
              enabled: t("Autentikasi dua faktor aktif untuk akun Anda."),
              notEnabled: t('Autentikasi dua faktor belum aktif untuk akun Anda. Tekan "Aktifkan 2FA" di atas untuk memulai.'),
            }}
          />
        </div>
      </div>
    </AdminShell>
  );
}
