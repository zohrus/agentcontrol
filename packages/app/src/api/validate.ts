import { validator } from "hono/validator";
import type { z } from "zod";
import { ApiFailure } from "./errors.ts";

type Target = "json" | "query" | "param";

/** A Hono validator that checks one part of the request with a zod schema. */
export function validate<T extends Target, S extends z.ZodType>(target: T, schema: S) {
  return validator(target, (value): z.output<S> => {
    const checked = schema.safeParse(value);
    if (checked.success) return checked.data;
    throw new ApiFailure(400, { code: "invalid-request", message: checked.error.message });
  });
}
