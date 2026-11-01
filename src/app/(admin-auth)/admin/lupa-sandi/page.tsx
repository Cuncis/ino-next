import AuthPassword from "@/views/admin/AuthPassword";
import { AdminAuthPage } from "../auth-page";

/** GET /admin/lupa-sandi. Redirects (signed in already, nothing pending) happen in src/proxy.ts. */
export default function Page() {
  return (
    <AdminAuthPage>
      <AuthPassword />
    </AdminAuthPage>
  );
}
