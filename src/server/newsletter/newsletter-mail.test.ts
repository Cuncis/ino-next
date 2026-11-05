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

  it("writes the editor's HTML out as Filament's sanitizer did, and drops a missing image's src", () => {
    // captured from the Laravel app's NewsletterRenderer::body() (newsletters/a.png doesn't exist)
    const content = "<h2>Judul &amp; \"kutip\" 'satu' a=b + c@d `x` é</h2><p>Halo <strong>tebal</strong> <em>miring</em> &amp; &lt;teks&gt; &#039;kutip&#039; é 100% = ok + plus @ at</p><ol start=\"1\"><li><p>x</p></li></ol><p><a href=\"https://inofarma.com/shop?a=1&amp;b=2+3@x\" target=\"_blank\">Tautan</a> <a href=\"/shop\">rel</a></p><p><img src=\"http://localhost:8000/storage/newsletters/a.png\" alt=\"A=b\" data-id=\"newsletters/a.png\"></p><div data-type=\"customBlock\" data-config=\"{&quot;label&quot;:&quot;Belanja &amp; Hemat&quot;,&quot;url&quot;:&quot;https:\\/\\/inofarma.com\\/promo?x=1&amp;y=2&quot;}\" data-id=\"button\"></div><p style=\"text-align: center;\">tengah</p><p></p><blockquote><p>q</p></blockquote>";
    const expected = "<h2>Judul &amp; &#34;kutip&#34; &#039;satu&#039; a&#61;b &#43; c&#64;d &#96;x&#96; é</h2><p>Halo <strong>tebal</strong> <em>miring</em> &amp; &lt;teks&gt; &#039;kutip&#039; é 100% &#61; ok &#43; plus &#64; at</p><ol start=\"1\"><li><p>x</p></li></ol><p><a href=\"https://inofarma.com/shop?a&#61;1&amp;b&#61;2&#43;3&#64;x\" target=\"_blank\">Tautan</a> <a href=\"https://inofarma.test/shop\">rel</a></p><p><img alt=\"A&#61;b\" data-id=\"newsletters/a.png\" /></p><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:24px auto;\">\n    <tr>\n        <td align=\"center\" style=\"background-color:#24CE30;border-radius:2px;\">\n            <a href=\"https://inofarma.com/promo?x=1&amp;y=2\" target=\"_blank\" style=\"display:inline-block;padding:14px 32px;background-color:#24CE30;border-radius:2px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;\">Belanja &amp; Hemat</a>\n        </td>\n    </tr>\n</table><p style=\"text-align: center;\">tengah</p><p></p><blockquote><p>q</p></blockquote>";

    expect(renderEditorContent(content)).toBe(expected);
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
