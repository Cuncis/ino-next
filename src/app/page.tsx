import Icon from "@/components/shop/Icon";

// Temporary: shows the ported fonts, palette and icons until step 2 brings over Shop/Home.
export default function Home() {
  return (
    <main className="mx-auto max-w-app space-y-6 p-6">
      <h1 className="font-display text-2xl text-brand">Inofarma</h1>
      <p className="font-shop text-muted">Fondasi Next.js: font, warna dan ikon dari aplikasi Laravel.</p>
      <div className="flex flex-wrap gap-2">
        {["bg-brand", "bg-brand-lift", "bg-success", "bg-warning", "bg-danger", "bg-info", "bg-ink", "bg-blush"].map((color) => (
          <span key={color} className={`${color} size-10 rounded-lg shadow-card`} title={color} />
        ))}
      </div>
      <div className="flex gap-3 text-ink">
        <Icon name="home" />
        <Icon name="cart" />
        <Icon name="heart" />
        <Icon name="user" />
        <Icon name="search" />
      </div>
    </main>
  );
}
