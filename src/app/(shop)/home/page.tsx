import { HomePage } from "../home-page";

// Laravel's developer screen list rendered Home here without its data; show the real homepage instead
export default function Page({ searchParams }: PageProps<"/home">) {
  return <HomePage searchParams={searchParams} />;
}
