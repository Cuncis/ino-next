import AuthResetPassword from "@/views/admin/AuthResetPassword";
import { AdminAuthPage } from "../../auth-page";

/** GET /admin/atur-ulang-sandi/{token}?email=… (AdminAuthController::showResetPassword()). */
export default async function Page({ params, searchParams }: PageProps<"/admin/atur-ulang-sandi/[token]">) {
  const email = (await searchParams).email;

  return (
    <AdminAuthPage>
      <AuthResetPassword token={(await params).token} email={typeof email === "string" ? email : ""} />
    </AdminAuthPage>
  );
}
