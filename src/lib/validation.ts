import messages from "./validation-messages.id.json";

/**
 * Laravel-style request validation with the Laravel app's own Indonesian messages
 * (`lang/id/validation.php`, exported to validation-messages.id.json), so every error
 * a shopper or staff member sees reads exactly as before.
 *
 * Input is prepared like Laravel's global middleware first: strings are trimmed
 * (except passwords) and empty strings become null. Rules use Laravel's syntax:
 * `validate(input, { kode: ["required", "digits:5"] })`. An unknown rule throws rather
 * than passing silently; add it here when a form needs it.
 */
export type Rules = Record<string, string[]>;

export type ValidationErrors = Record<string, string[]>;

type Messages = Record<string, string | Record<string, string>>;

const MESSAGES = messages as unknown as Messages & { attributes: Record<string, string> };

/** Laravel's TrimStrings skips these. */
const UNTRIMMED = new Set(["password", "password_confirmation", "current_password"]);

/** Rules that run even when the field is missing or null. */
const IMPLICIT = new Set(["required", "required_with", "required_without", "required_if", "accepted"]);

export function prepareInput(input: unknown, key = ""): unknown {
  if (typeof input === "string") {
    const value = UNTRIMMED.has(key) ? input : input.trim();

    return value === "" ? null : value;
  }

  if (Array.isArray(input)) {
    return input.map((item) => prepareInput(item));
  }

  if (typeof input === "object" && input !== null) {
    return Object.fromEntries(Object.entries(input).map(([field, value]) => [field, prepareInput(value, field)]));
  }

  return input;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
}

function isNumeric(value: unknown): boolean {
  return (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
}

/** Laravel's getSize(): the number itself for numeric fields, else the length. */
function sizeOf(value: unknown, numeric: boolean): number {
  if (numeric && isNumeric(value)) {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.length;
  }

  return [...String(value ?? "")].length;
}

function sizeType(value: unknown, numeric: boolean): "numeric" | "array" | "string" {
  if (numeric && isNumeric(value)) {
    return "numeric";
  }

  return Array.isArray(value) ? "array" : "string";
}

function attributeName(field: string, attributes: Record<string, string>): string {
  return attributes[field] ?? MESSAGES.attributes[field] ?? field.replace(/_/g, " ");
}

function message(rule: string, field: string, attributes: Record<string, string>, replacements: Record<string, string>, type?: string): string {
  const entry = MESSAGES[rule];
  const template = typeof entry === "string" ? entry : entry?.[type ?? "string"];

  if (!template) {
    throw new Error(`Validation message missing for rule "${rule}"`);
  }

  const name = attributeName(field, attributes);
  const all: Record<string, string> = { ...replacements, attribute: name, Attribute: name.charAt(0).toUpperCase() + name.slice(1) };

  return template.replace(/:([A-Za-z_]+)/g, (match, key: string) => all[key] ?? match);
}

export type ValidationResult<T> = { data: T; errors: null } | { data: null; errors: ValidationErrors };

export function validate<T extends Record<string, unknown>>(
  rawInput: unknown,
  rules: Rules,
  attributes: Record<string, string> = {},
): ValidationResult<T> {
  const input = (prepareInput(rawInput) ?? {}) as Record<string, unknown>;
  const errors: ValidationErrors = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = input[field];
    const present = field in input && value !== undefined;
    const nullable = fieldRules.includes("nullable");
    const numeric = fieldRules.some((rule) => rule === "numeric" || rule === "integer");
    const fail = (text: string) => (errors[field] ??= []).push(text);

    for (const ruleText of fieldRules) {
      const colon = ruleText.indexOf(":");
      const rule = colon === -1 ? ruleText : ruleText.slice(0, colon);
      const parameterText = colon === -1 ? "" : ruleText.slice(colon + 1);
      const parameters = parameterText === "" ? [] : parameterText.split(",");

      if (rule === "nullable" || rule === "bail") {
        continue;
      }

      if (!IMPLICIT.has(rule) && (!present || (value === null && nullable))) {
        continue;
      }

      switch (rule) {
        case "required":
          if (isEmpty(value)) fail(message(rule, field, attributes, {}));
          break;
        case "required_with":
          if (parameters.some((other) => !isEmpty(input[other])) && isEmpty(value)) {
            fail(message(rule, field, attributes, { values: parameters.map((other) => attributeName(other, attributes)).join(" / ") }));
          }
          break;
        case "accepted":
          if (!["yes", "on", "1", 1, true, "true"].includes(value as never)) fail(message(rule, field, attributes, {}));
          break;
        case "string":
          if (typeof value !== "string") fail(message(rule, field, attributes, {}));
          break;
        case "numeric":
          if (!isNumeric(value)) fail(message(rule, field, attributes, {}));
          break;
        case "integer":
          if (!isNumeric(value) || !Number.isInteger(Number(value))) fail(message(rule, field, attributes, {}));
          break;
        case "boolean":
          if (![true, false, 0, 1, "0", "1"].includes(value as never)) fail(message(rule, field, attributes, {}));
          break;
        case "email":
          if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(message(rule, field, attributes, {}));
          break;
        case "digits":
          if (!/^\d+$/.test(String(value)) || String(value).length !== Number(parameters[0])) {
            fail(message(rule, field, attributes, { digits: parameters[0] }));
          }
          break;
        case "in":
          if (!parameters.includes(String(value))) fail(message(rule, field, attributes, {}));
          break;
        case "min": {
          if (sizeOf(value, numeric) < Number(parameters[0])) fail(message(rule, field, attributes, { min: parameters[0] }, sizeType(value, numeric)));
          break;
        }
        case "max": {
          if (sizeOf(value, numeric) > Number(parameters[0])) fail(message(rule, field, attributes, { max: parameters[0] }, sizeType(value, numeric)));
          break;
        }
        case "between": {
          const size = sizeOf(value, numeric);

          if (size < Number(parameters[0]) || size > Number(parameters[1])) {
            fail(message(rule, field, attributes, { min: parameters[0], max: parameters[1] }, sizeType(value, numeric)));
          }
          break;
        }
        default:
          throw new Error(`Validation rule "${rule}" is not supported yet`);
      }
    }
  }

  return Object.keys(errors).length === 0 ? { data: input as T, errors: null } : { data: null, errors };
}

/** Laravel's 422 JSON for a failed validation: `{ message, errors }`. */
export function validationErrorResponse(errors: ValidationErrors): Response {
  const all = Object.values(errors).flat();
  const others = all.length - 1;
  const text = others > 0 ? `${all[0]} (and ${others} more ${others === 1 ? "error" : "errors"})` : all[0];

  return Response.json({ message: text, errors }, { status: 422 });
}
