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
    expect(() => validate({ x: 1 }, { x: ["regex:/a/"] })).toThrow('Validation rule "regex" is not supported yet');
  });
});
