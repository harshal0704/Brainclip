import { z } from "zod";

import { AppError } from "@/lib/errors";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API_URL = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3";

export const driveExportSchema = z.object({
  videoUrl: z.string().url(),
  fileName: z.string().min(1).max(255),
  folderId: z.string().optional(),
  description: z.string().max(500).optional(),
});

export type DriveExportInput = z.infer<typeof driveExportSchema>;

type DriveTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
};

/**
 * Refresh Google OAuth access token using refresh token
 */
export const refreshDriveAccessToken = async (refreshToken: string): Promise<DriveTokens> => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new AppError(
      "drive_not_configured",
      "Google OAuth not configured",
      "Google Drive integration is not set up on this server.",
      500,
    );
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new AppError(
      "drive_token_refresh_failed",
      error,
      "Failed to refresh Google Drive access. Please reconnect your account.",
      401,
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Keep old if not provided
    expiresAt: Date.now() + data.expires_in * 1000,
  };
};

/**
 * List folders in Google Drive (for folder picker)
 */
export const listDriveFolders = async (
  accessToken: string,
  parentId?: string,
): Promise<Array<{ id: string; name: string }>> => {
  const query = parentId
    ? `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    : `'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const params = new URLSearchParams({
    q: query,
    fields: "files(id, name)",
    orderBy: "name",
    pageSize: "100",
  });

  const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new AppError(
      "drive_list_failed",
      error,
      "Could not list Google Drive folders.",
      502,
    );
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Create a folder in Google Drive
 */
export const createDriveFolder = async (
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<DriveFile> => {
  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(`${GOOGLE_DRIVE_API_URL}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new AppError(
      "drive_folder_create_failed",
      error,
      "Could not create folder in Google Drive.",
      502,
    );
  }

  return response.json();
};

/**
 * Upload a video file to Google Drive using resumable upload
 * This handles large files by streaming from S3 presigned URL
 */
export const uploadVideoToDrive = async ({
  accessToken,
  videoUrl,
  fileName,
  folderId,
  description,
  onProgress,
}: {
  accessToken: string;
  videoUrl: string;
  fileName: string;
  folderId?: string;
  description?: string;
  onProgress?: (bytesUploaded: number, totalBytes: number) => void;
}): Promise<DriveFile> => {
  // Step 1: Fetch video from S3
  const videoResponse = await fetch(videoUrl);

  if (!videoResponse.ok) {
    throw new AppError(
      "video_fetch_failed",
      `Failed to fetch video: ${videoResponse.status}`,
      "Could not retrieve your video for export.",
      500,
    );
  }

  const contentLength = videoResponse.headers.get("content-length");
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  // Step 2: Create file metadata
  const metadata: Record<string, unknown> = {
    name: fileName.endsWith(".mp4") ? fileName : `${fileName}.mp4`,
    mimeType: "video/mp4",
    description: description || `Exported from svgen on ${new Date().toISOString()}`,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  // Step 3: Initialize resumable upload
  const initResponse = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_URL}/files?uploadType=resumable`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
        ...(totalBytes && { "X-Upload-Content-Length": totalBytes.toString() }),
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!initResponse.ok) {
    const error = await initResponse.text();
    throw new AppError(
      "drive_upload_init_failed",
      error,
      "Could not initialize upload to Google Drive.",
      502,
    );
  }

  const uploadUri = initResponse.headers.get("location");

  if (!uploadUri) {
    throw new AppError(
      "drive_upload_no_uri",
      "No upload URI returned",
      "Google Drive did not provide an upload location.",
      502,
    );
  }

  // Step 4: Stream video to Drive
  const videoBuffer = await videoResponse.arrayBuffer();

  const uploadResponse = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": videoBuffer.byteLength.toString(),
    },
    body: videoBuffer,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new AppError(
      "drive_upload_failed",
      error,
      "Failed to upload video to Google Drive.",
      502,
    );
  }

  const uploadedFile = (await uploadResponse.json()) as DriveFile;

  // Step 5: Get file details with sharing links
  const fileResponse = await fetch(
    `${GOOGLE_DRIVE_API_URL}/files/${uploadedFile.id}?fields=id,name,mimeType,webViewLink,webContentLink`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (fileResponse.ok) {
    return fileResponse.json();
  }

  return uploadedFile;
};

/**
 * Make a Drive file shareable (anyone with link can view)
 */
export const shareDriveFile = async (
  accessToken: string,
  fileId: string,
): Promise<{ webViewLink: string }> => {
  // Create public permission
  await fetch(`${GOOGLE_DRIVE_API_URL}/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      type: "anyone",
    }),
  });

  // Get the file with sharing link
  const response = await fetch(
    `${GOOGLE_DRIVE_API_URL}/files/${fileId}?fields=webViewLink`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new AppError(
      "drive_share_failed",
      await response.text(),
      "Could not generate shareable link.",
      502,
    );
  }

  return response.json();
};

/**
 * Check if Drive token needs refresh
 */
export const isDriveTokenExpired = (expiresAt: number): boolean => {
  // Refresh 5 minutes before expiry
  return Date.now() > expiresAt - 5 * 60 * 1000;
};
