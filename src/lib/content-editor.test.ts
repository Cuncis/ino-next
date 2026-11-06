import { describe, expect, it } from "vitest";
import { validateEditor, valueAt, withValue, type EditorMessages, type EditorNode } from "./content-editor";

const messages: EditorMessages = {
  required: (attribute) => `Kolom ${attribute} wajib diisi.`,
  max: (attribute, max) => `Kolom ${attribute} tidak boleh lebih dari ${max} karakter.`,
  regex: (attribute) => `Format kolom ${attribute} tidak valid.`,
  email: (attribute) => `Kolom ${attribute} harus berupa alamat surel yang valid.`,
  minItems: (attribute, min) => `Kolom ${attribute} harus memiliki setidaknya ${min} item.`,
  maxItems: (attribute, max) => `Kolom ${attribute} tidak boleh memiliki lebih dari ${max} item.`,
};

const nodes: EditorNode[] = [
  {
    type: "section",
    columns: { default: 1 },
    children: [
      { type: "text", name: "company.email", label: "Email", email: true },
      { type: "text", name: "phone", label: "Telepon", regex: "^[0-9+ ]+$" },
      { type: "image", name: "logo", label: "Logo", required: true, accept: ["image/png"], maxSizeKb: 100 },
      {
        type: "repeater",
        name: "items",
        label: "",
        hiddenLabel: true,
        min: 1,
        max: 2,
        addLabel: "Tambah",
        children: [
          { type: "text", name: "question", label: "Pertanyaan", required: true, maxLength: 5 },
          { type: "textarea", name: "answer", label: "Jawaban", required: true },
        ],
      },
    ],
  },
];

describe("validateEditor", () => {
  it("keys errors by the full path and names hidden labels by the field", () => {
    const errors = validateEditor(nodes, { company: { email: "nope" }, phone: "abc", logo: "", items: [{ question: "Terlalu panjang", answer: " " }, {}, {}] }, messages);

    expect(errors).toEqual({
      "company.email": "Kolom email harus berupa alamat surel yang valid.",
      phone: "Format kolom telepon tidak valid.",
      logo: "Kolom logo wajib diisi.",
      items: "Kolom items tidak boleh memiliki lebih dari 2 item.",
      "items.0.question": "Kolom pertanyaan tidak boleh lebih dari 5 karakter.",
      "items.0.answer": "Kolom jawaban wajib diisi.",
      "items.1.question": "Kolom pertanyaan wajib diisi.",
      "items.1.answer": "Kolom jawaban wajib diisi.",
      "items.2.question": "Kolom pertanyaan wajib diisi.",
      "items.2.answer": "Kolom jawaban wajib diisi.",
    });
  });

  it("counts characters as mb_strlen does and accepts a file waiting to upload", () => {
    expect(validateEditor(nodes, { logo: "upload:a", items: [{ question: "😀😀😀😀😀", answer: "ok" }] }, messages)).toEqual({});
    expect(validateEditor(nodes, { logo: "x", items: [] }, messages)).toEqual({ items: "Kolom items harus memiliki setidaknya 1 item." });
  });
});

describe("state paths", () => {
  it("reads and writes dotted paths through objects and lists without changing the original", () => {
    const state = { items: [{ question: "a" }], company: { name: "x" } };
    const next = withValue(state, "items.0.question", "b");

    expect(valueAt(next, "items.0.question")).toBe("b");
    expect(Array.isArray(next.items)).toBe(true);
    expect(state.items[0].question).toBe("a");
    expect(valueAt(withValue(state, "company.email", "e"), "company")).toEqual({ name: "x", email: "e" });
  });
});
