import { notFound } from "next/navigation";
import BranchDetail from "@/views/shop/BranchDetail";
import { branchPage } from "@/server/shop/branches";

/** Each apotek's own page, linked from its homepage card. */
export default async function Page({ params }: PageProps<"/apotek/[slug]">) {
  const page = await branchPage((await params).slug);

  if (!page) {
    notFound();
  }

  return <BranchDetail branch={page.branch} nearby={page.nearby} />;
}
