import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { users } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { listDriveFolders, createDriveFolder, refreshDriveAccessToken } from "@/lib/drive";
import { AppError, toErrorResponse } from "@/lib/errors";
import { requireUserFromRequest } from "@/lib/session";

/**
 * GET /api/export/drive/folders
 * List folders in Google Drive (for folder picker)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const url = new URL(request.url);
    const parentId = url.searchParams.get("parentId") || undefined;

    if (!user.driveRefreshToken) {
      throw new AppError(
        "drive_not_connected",
        "User has no Drive connection",
        "Connect your Google Drive account first.",
        400,
      );
    }

    const refreshToken = decryptSecret(user.driveRefreshToken);
    if (!refreshToken) {
      throw new AppError(
        "drive_token_invalid",
        "Invalid refresh token",
        "Your Google Drive connection needs to be re-established.",
        401,
      );
    }

    const tokens = await refreshDriveAccessToken(refreshToken);
    const folders = await listDriveFolders(tokens.accessToken, parentId);

    return NextResponse.json({
      folders,
      parentId: parentId || "root",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/export/drive/folders
 * Create a new folder in Google Drive
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = await request.json();
    const { name, parentId } = body as { name: string; parentId?: string };

    if (!name || typeof name !== "string" || name.length < 1) {
      throw new AppError(
        "invalid_folder_name",
        "Invalid folder name",
        "Please provide a valid folder name.",
        400,
      );
    }

    if (!user.driveRefreshToken) {
      throw new AppError(
        "drive_not_connected",
        "User has no Drive connection",
        "Connect your Google Drive account first.",
        400,
      );
    }

    const refreshToken = decryptSecret(user.driveRefreshToken);
    if (!refreshToken) {
      throw new AppError(
        "drive_token_invalid",
        "Invalid refresh token",
        "Your Google Drive connection needs to be re-established.",
        401,
      );
    }

    const tokens = await refreshDriveAccessToken(refreshToken);
    const folder = await createDriveFolder(tokens.accessToken, name, parentId);

    return NextResponse.json({
      folder,
      message: `Folder "${name}" created successfully.`,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
