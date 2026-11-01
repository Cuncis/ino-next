import AuthTwoFactorChallenge from "@/views/admin/AuthTwoFactorChallenge";
import { AdminAuthPage } from "../auth-page";

/** GET /admin/dua-faktor. Redirects (signed in already, nothing pending) happen in src/proxy.ts. */
export default function Page() {
  return (
    <AdminAuthPage>
      <AuthTwoFactorChallenge />
    </AdminAuthPage>
  );
}
