import { describe, expect, it } from "vitest";
import { validateChatSettings } from "./inbox";

/** Pengaturan Chat's rules, with the Laravel app's messages. */
describe("validateChatSettings", () => {
  it("asks for what each quick question's type needs, and a link that starts with / or http(s)://", () => {
    const result = validateChatSettings(
      {
        welcome_message: "",
        quick_questions: [
          { type: "message", question: "Promo", url: "ftp://x" },
          { type: "auto_reply", question: "Jam buka?", answer: "" },
          { type: "whatsapp", question: "WA", phone: "abc" },
        ],
      },
      "id",
    );

    expect(result.errors).toEqual({
      welcome_message: ["Kolom pesan sambutan wajib diisi."],
      "quick_questions.0.url": ["Tautan harus diawali / atau https://."],
      "quick_questions.1.answer": ["Kolom jawaban wajib diisi."],
      "quick_questions.2.phone": ["Format kolom nomor telepon / WhatsApp tidak valid."],
    });
  });

  it("passes a valid form", () => {
    expect(validateChatSettings({ welcome_message: "Halo", quick_questions: [{ type: "message", question: "Belanja", url: "/shop" }] }, "id").errors).toBeNull();
  });
});
