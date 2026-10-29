import { HomePage } from "./home-page";

export default function Page({ searchParams }: PageProps<"/">) {
  return <HomePage searchParams={searchParams} />;
}
