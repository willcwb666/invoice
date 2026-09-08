import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, SessionPayload } from "./auth";
import {
  hasPermission,
  DEFAULT_ROLE_PERMISSIONS,
  Role,
  ScreenId,
  ActionId,
  RolePermissionsMatrix,
} from "./rbac";

export type PermissionCheck =
  | { session: SessionPayload; response?: undefined }
  | { session: null; response: NextResponse };

/**
 * Resolves the current session and enforces that its role has `action`
 * permission on `screen`, per the admin-editable RBAC matrix (see
 * PUT /api/v1/roles). ADMIN always passes without a DB round-trip.
 *
 * Usage:
 *   const check = await requirePermission(req, "clients", "read");
 *   if (check.response) return check.response;
 *   const { session } = check;
 */
export async function requirePermission(
  req: NextRequest,
  screen: ScreenId,
  action: ActionId
): Promise<PermissionCheck> {
  const session = await getSessionUser(req);
  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 }),
    };
  }

  if (session.role === "ADMIN") {
    return { session };
  }

  const company = await prisma.companyProfile.findFirst({
    select: { rolePermissions: true },
  });
  const matrix =
    (company?.rolePermissions as unknown as RolePermissionsMatrix | null) ||
    DEFAULT_ROLE_PERMISSIONS;

  if (!hasPermission(session.role as Role, screen, action, matrix)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Você não tem permissão para executar esta ação." },
        { status: 403 }
      ),
    };
  }

  return { session };
}
