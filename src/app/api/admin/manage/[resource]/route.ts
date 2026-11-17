import { NextRequest } from "next/server";
import { z } from "zod";
import {
  institutionApi,
  jsonInput,
  READ_ROLES,
  EDIT_ROLES,
  REVIEW_ROLES,
  ALL_ROLES,
  ApiProblem,
} from "@/lib/institutionApi";
import { readManagement, writeManagement } from "@/lib/management";
type Context = { params: Promise<{ resource: string }> };
export async function GET(req: NextRequest, { params }: Context) {
  const { resource } = await params;
  const roles = ["users", "settings", "keys", "recovery"].includes(resource)
    ? (["admin"] as const)
    : resource === "terminals"
      ? ALL_ROLES
      : ["review", "audit"].includes(resource)
        ? REVIEW_ROLES
        : READ_ROLES;
  return institutionApi(req, [...roles], (u, c) =>
    readManagement(c, u, resource, req.nextUrl),
  );
}
export async function POST(req: NextRequest, { params }: Context) {
  const { resource } = await params;
  const roles = [
    "users",
    "terminals",
    "settings",
    "keys",
    "schedules",
    "calendar",
  ].includes(resource)
    ? (["admin"] as const)
    : resource === "notifications"
      ? READ_ROLES
      : EDIT_ROLES;
  return institutionApi(req, [...roles], async (u, c) => {
    const value = await jsonInput(req, z.unknown(), 65536);
    try {
      return await writeManagement(c, u, resource, value);
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new ApiProblem(
          400,
          "INVALID_INPUT",
          error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .slice(0, 3)
            .join("; "),
        );
      throw error;
    }
  });
}
