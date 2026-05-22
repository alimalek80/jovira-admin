export type FieldErrorMap = Record<string, string>;

export function mapBackendValidationErrors(errorBody: unknown): FieldErrorMap {
  if (!errorBody || typeof errorBody !== "object") {
    return {};
  }

  const raw = errorBody as Record<string, unknown>;
  const mapped: FieldErrorMap = {};

  for (const [field, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      const firstMessage = value.find((item) => typeof item === "string");
      if (typeof firstMessage === "string") {
        mapped[field] = firstMessage;
      }
      continue;
    }

    if (typeof value === "string") {
      mapped[field] = value;
      continue;
    }

    if (value && typeof value === "object") {
      const nestedMessage = Object.values(value as Record<string, unknown>).find((item) => typeof item === "string");
      if (typeof nestedMessage === "string") {
        mapped[field] = nestedMessage;
      }
    }
  }

  return mapped;
}
