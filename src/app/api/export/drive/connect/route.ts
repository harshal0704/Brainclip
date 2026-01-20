import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { users } from "@/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { requireUserFromRequest } from "@/lib/session";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const connectSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
});

const disconnectSchema = z.object({
  confirm: z.literal(true),
});

/**
 * GET /api/export/drive/connect
 * Get Drive connection status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);

    const isConnected = Boolean(user.driveRefreshToken);
    let connectionValid = false;

    if (isConnected) {
      // Try to verify the token is still valid
      const refreshToken = decryptSecret(user.driveRefreshToken);
      if (refreshToken) {
        try {
          const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID || "",
              client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
              refresh_token: refreshToken,
              grant_type: "refresh_token",
            }),
          });
          connectionValid = response.ok;
        } catch {
          connectionValid = false;
        }
      }
    }

    // Generate OAuth URL for connecting
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const oauthUrl = clientId
      ? `https://accounts.google.com/o/oauth2/v2/auth?` +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/export/drive/callback`,
          response_type: "code",
          scope: DRIVE_SCOPE,
          access_type: "offline",
          prompt: "consent",
          state: user.id,
        }).toString()
      : null;

    return NextResponse.json({
      isConnected,
      connectionValid,
      oauthUrl,
      scopes: [DRIVE_SCOPE],
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/export/drive/connect
 * Exchange OAuth code for tokens and save
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = connectSchema.parse(await request.json());

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new AppError(
        "drive_not_configured",
        "Google OAuth not configured",
        "Google Drive integration is not available.",
        500,
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: body.code,
        grant_type: "authorization_code",
        redirect_uri: body.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new AppError(
        "oauth_exchange_failed",
        error,
        "Failed to complete Google authorization. Please try again.",
        400,
      );
    }

    const tokens = await tokenResponse.json();

    if (!tokens.refresh_token) {
      throw new AppError(
        "no_refresh_token",
        "No refresh token in response",
        "Google did not provide offline access. Please reconnect and grant all permissions.",
        400,
      );
    }

    // Save encrypted refresh token
    await db
      .update(users)
      .set({
        driveRefreshToken: encryptSecret(tokens.refresh_token),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: "Google Drive connected successfully!",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * DELETE /api/export/drive/connect
 * Disconnect Google Drive
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const body = disconnectSchema.parse(await request.json());

    await db
      .update(users)
      .set({
        driveRefreshToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: "Google Drive disconnected.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
