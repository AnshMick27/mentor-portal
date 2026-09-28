import { z } from "zod";

/** Admin and browser SDK Timestamps both have `toDate()`; duck-typing keeps schemas usable on both sides. */
export const timestampLike = z.custom<{ toDate: () => Date }>(
  (value) => typeof value === "object" && value !== null && typeof Reflect.get(value, "toDate") === "function",
);
