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

/** A field's value; `courier.courierCompany` reads inside `courier`, as Laravel's dot notation does. */
function valueAt(input: Record<string, unknown>, field: string): { present: boolean; value: unknown } {
  let current: unknown = input;

  for (const key of field.split(".")) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return { present: false, value: undefined };
    }

    current = (current as Record<string, unknown>)[key];
  }

  return { present: current !== undefined, value: current };
}

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
  // Laravel's Str::snake() then spaces: `pickupBranchId` reads "pickup branch id"
  return attributes[field] ?? MESSAGES.attributes[field] ?? field.replace(/(.)(?=[A-Z])/g, "$1_").toLowerCase().replace(/_/g, " ");
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

/**
 * @param messages per-rule overrides, Laravel's `['phone.regex' => '...']`
 * @param attributes display names for fields, Laravel's custom attributes
 */
export function validate<T extends Record<string, unknown>>(
  rawInput: unknown,
  rules: Rules,
  messages: Record<string, string> = {},
  attributes: Record<string, string> = {},
): ValidationResult<T> {
  const input = (prepareInput(rawInput) ?? {}) as Record<string, unknown>;
  const errors: ValidationErrors = {};
  const failedImplicit = new Set<string>();

  for (const [field, fieldRules] of Object.entries(rules)) {
    const { present, value } = valueAt(input, field);
    const nullable = fieldRules.includes("nullable");
    const numeric = fieldRules.some((rule) => rule === "numeric" || rule === "integer");
    const fail = (rule: string, text: string) => {
      (errors[field] ??= []).push(messages[`${field}.${rule}`] ?? text);

      if (IMPLICIT.has(rule)) {
        failedImplicit.add(field);
      }
    };

    for (const ruleText of fieldRules) {
      const colon = ruleText.indexOf(":");
      const rule = colon === -1 ? ruleText : ruleText.slice(0, colon);
      const parameterText = colon === -1 ? "" : ruleText.slice(colon + 1);
      // a regex may itself contain commas, so it is never split
      const parameters = parameterText === "" ? [] : rule === "regex" ? [parameterText] : parameterText.split(",");

      if (rule === "nullable" || rule === "bail") {
        continue;
      }

      if (!IMPLICIT.has(rule) && (!present || (value === null && nullable))) {
        continue;
      }

      // Laravel stops checking a field once a required-type rule has failed for it
      if (fieldRules.some((other) => IMPLICIT.has(other.split(":")[0])) && errors[field]?.length && failedImplicit.has(field)) {
        break;
      }

      switch (rule) {
        case "required":
          if (isEmpty(value)) fail(rule, message(rule, field, attributes, {}));
          break;
        case "required_with":
          if (parameters.some((other) => !isEmpty(input[other])) && isEmpty(value)) {
            fail(rule, message(rule, field, attributes, { values: parameters.map((other) => attributeName(other, attributes)).join(" / ") }));
          }
          break;
        case "required_if": {
          const other = valueAt(input, parameters[0]).value;

          if (parameters.slice(1).includes(String(other)) && isEmpty(value)) {
            fail(rule, message(rule, field, attributes, { other: attributeName(parameters[0], attributes), value: String(other) }));
          }
          break;
        }
        case "accepted":
          if (!["yes", "on", "1", 1, true, "true"].includes(value as never)) fail(rule, message(rule, field, attributes, {}));
          break;
        case "string":
          if (typeof value !== "string") fail(rule, message(rule, field, attributes, {}));
          break;
        case "array":
          // a JSON object is a PHP (associative) array too
          if (typeof value !== "object" || value === null) fail(rule, message(rule, field, attributes, {}));
          break;
        case "numeric":
          if (!isNumeric(value)) fail(rule, message(rule, field, attributes, {}));
          break;
        case "integer":
          if (!isNumeric(value) || !Number.isInteger(Number(value))) fail(rule, message(rule, field, attributes, {}));
          break;
        case "boolean":
          if (![true, false, 0, 1, "0", "1"].includes(value as never)) fail(rule, message(rule, field, attributes, {}));
          break;
        case "email":
          if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(rule, message(rule, field, attributes, {}));
          break;
        case "digits":
          if (!/^\d+$/.test(String(value)) || String(value).length !== Number(parameters[0])) {
            fail(rule, message(rule, field, attributes, { digits: parameters[0] }));
          }
          break;
        case "confirmed":
          if (value !== input[`${field}_confirmation`]) fail(rule, message(rule, field, attributes, {}));
          break;
        case "regex": {
          const match = /^\/([\s\S]*)\/([a-z]*)$/.exec(parameters[0] ?? "");

          if (!match) throw new Error(`Invalid regex rule for ${field}`);
          if (typeof value !== "string" || !new RegExp(match[1], match[2].replace(/[^imsu]/g, "")).test(value)) {
            fail(rule, message(rule, field, attributes, {}));
          }
          break;
        }
        case "in":
          if (!parameters.includes(String(value))) fail(rule, message(rule, field, attributes, {}));
          break;
        case "min": {
          if (sizeOf(value, numeric) < Number(parameters[0])) fail(rule, message(rule, field, attributes, { min: parameters[0] }, sizeType(value, numeric)));
          break;
        }
        case "max": {
          if (sizeOf(value, numeric) > Number(parameters[0])) fail(rule, message(rule, field, attributes, { max: parameters[0] }, sizeType(value, numeric)));
          break;
        }
        case "between": {
          const size = sizeOf(value, numeric);

          if (size < Number(parameters[0]) || size > Number(parameters[1])) {
            fail(rule, message(rule, field, attributes, { min: parameters[0], max: parameters[1] }, sizeType(value, numeric)));
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

/**
 * Laravel's ValidationException::withMessages(): thrown from deep inside a service (the
 * cart, checkout) and answered by the Route Handler as a 422, like a failed form.
 */
export class ValidationException extends Error {
  constructor(readonly errors: ValidationErrors) {
    super(Object.values(errors).flat()[0] ?? "The given data was invalid.");
  }

  static withMessages(messages: Record<string, string>): ValidationException {
    return new ValidationException(Object.fromEntries(Object.entries(messages).map(([field, text]) => [field, [text]])));
  }
}

/** Adds an error the way a failing rule would (for checks the validator can't run itself, such as `unique`). */
export function addError(errors: ValidationErrors | null, field: string, text: string): ValidationErrors {
  const next = { ...(errors ?? {}) };

  (next[field] ??= []).push(text);

  return next;
}

/** Laravel's `unique` message for a field. */
export function uniqueMessage(field: string, attributes: Record<string, string> = {}): string {
  return message("unique", field, attributes, {});
}

/** Laravel's 422 JSON for a failed validation: `{ message, errors }`. */
export function validationErrorResponse(errors: ValidationErrors): Response {
  const all = Object.values(errors).flat();
  const others = all.length - 1;
  const text = others > 0 ? `${all[0]} (and ${others} more ${others === 1 ? "error" : "errors"})` : all[0];

  return Response.json({ message: text, errors }, { status: 422 });
}

/** The 422 for a ValidationException thrown by a service; any other error is thrown on. */
export function validationExceptionResponse(error: unknown): Response {
  if (error instanceof ValidationException) {
    return validationErrorResponse(error.errors);
  }

  throw error;
}
