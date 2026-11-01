import { describe, expect, it } from "vitest";
import { newsletterEmail, renderCustomHtml, renderEditorContent } from "./newsletter-mail";

process.env.APP_URL = "https://inofarma.test";

describe("newsletter rendering", () => {
  it("turns the editor's button block into the email button, and site links into full ones", () => {
    const html = renderEditorContent(
      '<p><a href="/shop">Belanja</a></p><div data-type="customBlock" data-id="button" data-config="{&quot;label&quot;:&quot;Lihat &lt;Promo&gt;&quot;,&quot;url&quot;:&quot;https://inofarma.com/shop?a=1&amp;b=2&quot;}"></div>',
    );

    expect(html).toContain('<a href="https://inofarma.test/shop">Belanja</a>');
    expect(html).toContain('href="https://inofarma.com/shop?a=1&amp;b=2"');
    expect(html).toContain(">Lihat &lt;Promo&gt;</a>");
    expect(html).not.toContain("customBlock");
  });

  it("keeps pasted HTML but drops scripts and handlers, and lifts its styles to the head", () => {
    expect(renderCustomHtml('<html><head><style>p{}</style></head><body><p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:x">y</a></body></html>')).toEqual({
      body: '<p>Hi</p><a href="#">y</a>',
      styles: "<style>p{}</style>\n",
    });
  });

  it("gives each person their own unsubscribe link and the one-click headers", () => {
    const mail = newsletterEmail(
      { id: 1, name: "n", subject: "Promo", previewText: "Hemat", content: "<p>Halo</p>", customHtml: null, status: "mengirim", sentAt: null, recipientCount: 0, successCount: 0, failedCount: 0, createdAt: null, updatedAt: null },
      { id: 9, email: "a@b.c", status: "berlangganan", subscribedAt: null, unsubscribedAt: null, unsubscribeToken: "T".repeat(64), createdAt: null, updatedAt: null },
    );

    expect(mail.subject).toBe("Promo");
    expect(mail.headers).toEqual({ "List-Unsubscribe": `<https://inofarma.test/newsletter/berhenti/${"T".repeat(64)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    expect(mail.html).toContain('<div class="nl"><p>Halo</p></div>');
    expect(mail.html).toContain(">Hemat</div>");
  });
});
