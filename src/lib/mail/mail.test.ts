import { describe, expect, it } from "vitest";
import { renderNotification } from "./index";

describe("notification emails in Laravel's layout", () => {
  const mail = {
    subject: "Pemulihan Kata Sandi — Inofarma",
    greeting: "Halo, Kirana <Wijaya>!",
    introLines: ["Klik tombol di bawah untuk mengatur ulang kata sandi Anda."],
    action: { text: "Atur Ulang Kata Sandi", url: "http://localhost:3000/new-password?token=T&email=a%40b.c" },
    outroLines: ["Baris satu.", "Baris dua."],
  };

  it("fills every placeholder and escapes text in the HTML", () => {
    const { html } = renderNotification(mail);

    expect(html).not.toContain("PLACEHOLDER");
    expect(html).not.toContain("invalid");
    expect(html).toContain("Halo, Kirana &lt;Wijaya&gt;!");
    expect(html).toContain('href="http://localhost:3000/new-password?token=T&amp;email=a%40b.c"');
    expect(html).toContain("Baris satu.");
    expect(html).toContain("Baris dua.");
    expect(html).toMatch(/© 20\d\d Inofarma\. All rights reserved\./);
  });

  it("matches Laravel's plain-text version", () => {
    const { text } = renderNotification(mail);

    expect(text).toContain("# Halo, Kirana <Wijaya>!");
    expect(text).toContain("Atur Ulang Kata Sandi: http://localhost:3000/new-password?token=T&email=a%40b.c");
    expect(text).toContain("Baris satu.\n\nBaris dua.");
    expect(text).toContain("Regards,\nInofarma");
    expect(text).toContain('If you\'re having trouble clicking the "Atur Ulang Kata Sandi" button');
  });
});
