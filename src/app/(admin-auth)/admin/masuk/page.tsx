import AuthSignIn from "@/views/admin/AuthSignIn";
import { AdminAuthPage } from "../auth-page";

/** GET /admin/masuk. Redirects (signed in already, nothing pending) happen in src/proxy.ts. */
export default function Page() {
  return (
    <AdminAuthPage>
      <AuthSignIn />
    </AdminAuthPage>
  );
}
