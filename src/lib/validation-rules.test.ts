import { describe, expect, it } from "vitest";
import { translate } from "@/lib/admin-i18n";
import { validate } from "./validation";

describe("rules added for the inventory forms, with Laravel's messages", () => {
  it("not_in, different and after:today", () => {
    const attributes = { delta: "jumlah Penyesuaian", to: "cabang Tujuan", from: "cabang Asal", expires: "tanggal Kedaluwarsa" };
    const { errors } = validate({ delta: "0", from: "2", to: "2", expires: "2020-01-01" }, { delta: ["not_in:0"], to: ["different:from"], expires: ["required", "after:today"] }, {}, attributes);

    expect(errors).toEqual({
      delta: ["Kolom jumlah Penyesuaian yang dipilih tidak valid."],
      to: ["Kolom cabang Tujuan dan cabang Asal harus berbeda."],
      expires: ["Kolom tanggal Kedaluwarsa harus berisi tanggal setelah today."],
    });
    expect(validate({ expires: "2999-01-01" }, { expires: ["after:today"] }).errors).toBeNull();
  });

  it("fills the longest placeholder first, so :name doesn't eat :name2", () => {
    expect(translate("id", ':quantity ":name" diterima di :name2.', { quantity: 5, name: "Obat", name2: "Cabang A" })).toBe('5 "Obat" diterima di Cabang A.');
  });
});
