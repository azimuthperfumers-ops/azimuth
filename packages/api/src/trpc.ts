import { initTRPC } from "@trpc/server";
import { ZodError } from "zod";

import type { Context } from "./context";

// "shippingAddress.pincode" -> "Pincode"
function humanizeField(path: PropertyKey[]): string {
  const last = path[path.length - 1];
  if (last == null || typeof last !== "string") return "";
  const spaced = last
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Turn a Zod issue into plain English. Falls back to the issue's own message.
function friendlyIssue(issue: { code: string; message: string; path: PropertyKey[] }): string {
  const field = humanizeField(issue.path);
  const label = field || "This field";
  switch (issue.code) {
    case "invalid_type":
      return `${label} is required.`;
    case "too_small":
      return `${label} is too short.`;
    case "too_big":
      return `${label} is too long.`;
    case "invalid_format":
    case "invalid_string":
      return `Please enter a valid ${field ? field.toLowerCase() : "value"}.`;
    default:
      return field ? `${field}: ${issue.message}` : issue.message;
  }
}

const t = initTRPC.context<Context>().create({
  // Turn raw validation failures into a single human sentence so the frontend
  // never toasts a stringified Zod issue array. Field-level detail still ships
  // in data.zodError for forms that want to highlight inputs.
  errorFormatter({ shape, error }) {
    const zod = error.cause instanceof ZodError ? error.cause : null;
    if (zod) {
      const first = zod.issues[0];
      const message = first ? friendlyIssue(first) : "Please check the details and try again.";
      return {
        ...shape,
        message,
        data: { ...shape.data, zodError: zod.flatten() },
      };
    }
    // Never leak raw internal error text (DB/stack) to the UI — mask to a generic.
    if (error.code === "INTERNAL_SERVER_ERROR") {
      return { ...shape, message: "Something went wrong on our end. Please try again." };
    }
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
