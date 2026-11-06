/**
 * The Konten Website editors described once, for both sides: the browser draws the
 * form from it (Filament's schema components) and the server validates the submitted
 * state against it, so the two never disagree. Field names may be dotted paths
 * (`headings.recommended`, `company.email`), relative to the item they sit in.
 */
type FieldBase = { name: string; label: string; required?: boolean; helper?: string; full?: boolean };

export type EditorNode =
  | { type: "section"; heading?: string; description?: string; columns: { default: number; lg?: number; md?: number }; children: EditorNode[] }
  | { type: "tabs"; queryKey: string; tabs: { key: string; label: string; icon: string; children: EditorNode[] }[] }
  | { type: "grid"; columns: { default: number; md?: number; lg?: number; "2xl"?: number }; span?: { md?: number }; children: EditorNode[] }
  | { type: "note"; text: string }
  | (FieldBase & { type: "text"; maxLength?: number; placeholder?: string; prefix?: string; regex?: string; email?: boolean })
  | (FieldBase & { type: "textarea"; maxLength?: number; rows?: number })
  | (FieldBase & { type: "select"; options: { value: string; label: string }[]; placeholder: string })
  | (FieldBase & { type: "image"; previewHeight?: number; avatar?: boolean; accept: string[]; maxSizeKb: number })
  | (FieldBase & {
      type: "repeater";
      hiddenLabel?: boolean;
      itemLabel?: string;
      itemNumbers?: boolean;
      collapsible?: boolean;
      collapsed?: boolean;
      grid?: { default: number; md?: number; lg?: number; xl?: number; "2xl"?: number };
      columns?: number;
      min?: number;
      max?: number;
      addLabel: string;
      children: EditorNode[];
    });

export type EditorField = Extract<EditorNode, { name: string }>;

/** A value in the state by dotted path. */
export function valueAt(state: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => (typeof current === "object" && current !== null ? (current as Record<string, unknown>)[key] : undefined), state);
}

/** The state with one dotted path set (copied, not changed in place). */
export function withValue<T>(state: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const current = (typeof state === "object" && state !== null ? state : {}) as Record<string, unknown>;

  if (Array.isArray(current)) {
    const copy = [...current];

    copy[Number(head)] = rest.length ? withValue(copy[Number(head)], rest.join("."), value) : value;

    return copy as T;
  }

  return { ...current, [head]: rest.length ? withValue(current[head], rest.join("."), value) : value } as T;
}

/** Every field directly in this list of nodes (through sections, tabs and grids, not into repeaters). */
export function fieldsOf(nodes: EditorNode[]): EditorField[] {
  return nodes.flatMap((node) => {
    switch (node.type) {
      case "section":
      case "grid":
        return fieldsOf(node.children);
      case "tabs":
        return node.tabs.flatMap((tab) => fieldsOf(tab.children));
      case "note":
        return [];
      default:
        return [node];
    }
  });
}

/** PHP's mb_strlen. */
const length = (value: string) => [...value].length;

export type EditorMessages = {
  required: (attribute: string) => string;
  max: (attribute: string, max: number) => string;
  regex: (attribute: string) => string;
  email: (attribute: string) => string;
  minItems: (attribute: string, min: number) => string;
  maxItems: (attribute: string, max: number) => string;
};

const lcfirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Filament's validation of the state: the first failing rule of each field, keyed by
 * its full path (`items.2.question`). Images count as filled when they hold a path,
 * a URL or a file waiting to be uploaded.
 */
export function validateEditor(nodes: EditorNode[], state: unknown, messages: EditorMessages, prefix = ""): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fieldsOf(nodes)) {
    const path = `${prefix}${field.name}`;
    const value = valueAt(state, field.name);
    // a hidden label still names the field in messages: Filament falls back to the field's name
    const attribute = lcfirst(field.label || field.name.split(".").at(-1)!);

    if (field.type === "repeater") {
      const items = Array.isArray(value) ? value : [];

      if (field.min !== undefined && items.length < field.min) {
        errors[path] = messages.minItems(attribute, field.min);
      } else if (field.max !== undefined && items.length > field.max) {
        errors[path] = messages.maxItems(attribute, field.max);
      }

      items.forEach((item, index) => Object.assign(errors, validateEditor(field.children, item, messages, `${path}.${index}.`)));
      continue;
    }

    const text = value === null || value === undefined ? "" : String(value);

    if (text.trim() === "") {
      if (field.required) errors[path] = messages.required(attribute);
      continue;
    }

    if (field.type === "image" || field.type === "select") {
      continue;
    }

    if (field.maxLength !== undefined && length(text) > field.maxLength) {
      errors[path] = messages.max(attribute, field.maxLength);
    } else if (field.type === "text" && field.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      errors[path] = messages.email(attribute);
    } else if (field.type === "text" && field.regex && !new RegExp(field.regex).test(text)) {
      errors[path] = messages.regex(attribute);
    }
  }

  return errors;
}
