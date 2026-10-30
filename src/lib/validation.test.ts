import { describe, expect, it } from "vitest";
import { prepareInput, validate } from "./validation";

// Expected messages come from the Laravel app's validator with lang/id/validation.php
describe("validate", () => {
  const locationRules = {
    lat: ["nullable", "numeric", "between:-90,90", "required_with:lng"],
    lng: ["nullable", "numeric", "between:-180,180", "required_with:lat"],
    provinsi: ["nullable", "string", "max:80"],
    kota: ["nullable", "string", "max:80", "required_with:provinsi"],
  };

  it("reports Laravel's Indonesian messages", () => {
    expect(validate({ lat: "abc", lng: 200, kota: "x".repeat(81) }, locationRules).errors).toEqual({
      lat: ["Kolom lat harus berupa angka."],
      lng: ["Kolom lng harus bernilai antara -180 sampai 180."],
      kota: ["Kolom kota tidak boleh lebih dari 80 karakter."],
    });
    expect(validate({ lng: 10, provinsi: "DKI" }, locationRules).errors).toEqual({
      lat: ["Kolom lat wajib diisi bila terdapat lng."],
      kota: ["Kolom kota wajib diisi bila terdapat provinsi."],
    });
    expect(validate({ kode: "12" }, { kode: ["required", "digits:5"] }).errors).toEqual({ kode: ["Kolom kode harus terdiri dari 5 angka."] });
    expect(validate({}, { kode: ["required", "digits:5"] }).errors).toEqual({ kode: ["Kolom kode wajib diisi."] });
  });

  it("checks confirmation, regex and custom messages like the sign-up form", () => {
    const rules = {
      phone: ["required", "string", "max:30", "regex:/^[0-9+\\-\\s()]+$/"],
      email: ["required", "email", "max:255"],
      password: ["required", "confirmed", "min:8"],
      consent: ["accepted"],
    };
    const messages = {
      "phone.regex": "Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( ).",
      "consent.accepted": "Anda harus menyetujui Kebijakan Privasi untuk mendaftar.",
    };

    expect(validate({ phone: "abc", email: "bukan-email", password: "pendek", password_confirmation: "lain", consent: false }, rules, messages).errors).toEqual({
      phone: ["Nomor telepon hanya boleh berisi angka, spasi, dan tanda + - ( )."],
      email: ["Kolom email harus berupa alamat email yang valid."],
      password: ["Konfirmasi kolom kata sandi tidak cocok.", "Kolom kata sandi harus terdiri dari minimal 8 karakter."],
      consent: ["Anda harus menyetujui Kebijakan Privasi untuk mendaftar."],
    });
    expect(validate({ phone: "+62 812-3456 (7)", email: "a@b.co", password: "rahasia123", password_confirmation: "rahasia123", consent: true }, rules, messages).errors).toBeNull();
  });

  it("uses custom attribute names", () => {
    expect(validate({}, { recipientName: ["required"] }, {}, { recipientName: "nama penerima" }).errors).toEqual({
      recipientName: ["Kolom nama penerima wajib diisi."],
    });
  });

  it("passes valid input and skips nullable fields that are empty", () => {
    expect(validate({ lat: -6.2, lng: "106.85", provinsi: "  ", kota: "" }, locationRules)).toEqual({
      data: { lat: -6.2, lng: "106.85", provinsi: null, kota: null },
      errors: null,
    });
  });

  it("trims strings and turns empty ones into null, except passwords", () => {
    expect(prepareInput({ name: "  Ani  ", note: "", password: " rahasia ", items: [" a ", ""] })).toEqual({
      name: "Ani",
      note: null,
      password: " rahasia ",
      items: ["a", null],
    });
  });

  it("refuses rules it does not know rather than passing them", () => {
    expect(() => validate({ x: 1 }, { x: ["uuid"] })).toThrow('Validation rule "uuid" is not supported yet');
  });
});

describe("stopping after a required rule fails", () => {
  it("shows only the required message for an empty field, like Laravel", () => {
    expect(validate({ name: "", consent: null }, { name: ["required", "string", "max:255"], consent: ["accepted"] }).errors).toEqual({
      name: ["Kolom nama wajib diisi."],
      consent: ["Kolom consent wajib disetujui."],
    });
  });
});
