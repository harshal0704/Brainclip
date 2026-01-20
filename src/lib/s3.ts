import {
  BucketLocationConstraint,
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketAclCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketOwnershipControlsCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq, or } from "drizzle-orm";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { users } from "@/db/schema";
import { db } from "@/lib/db";

const DEFAULT_REGION = process.env.AWS_REGION ?? "ap-south-1";

const getS3Client = (region = DEFAULT_REGION) => {
  return new S3Client({ region });
};

export const createUserBucket = async (userId: string, region = DEFAULT_REGION) => {
  const bucketName = `svgen-${userId}`;
  const client = getS3Client(region);
  const locationConstraint = region as BucketLocationConstraint;

  await client.send(
    new CreateBucketCommand({
      Bucket: bucketName,
      ...(region === "us-east-1"
        ? {}
        : {
            CreateBucketConfiguration: {
              LocationConstraint: locationConstraint,
            },
          }),
    }),
  );

  await client.send(
    new PutBucketOwnershipControlsCommand({
      Bucket: bucketName,
      OwnershipControls: {
        Rules: [{ ObjectOwnership: "BucketOwnerPreferred" }],
      },
    }),
  );

  await client.send(
    new PutBucketAclCommand({
      Bucket: bucketName,
      ACL: "private",
    }),
  );

  await client.send(
    new PutBucketVersioningCommand({
      Bucket: bucketName,
      VersioningConfiguration: {
        Status: "Enabled",
      },
    }),
  );

  await client.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "expire-audio-and-transcripts",
            Status: "Enabled",
            Filter: {
              Prefix: "audio/",
            },
            Expiration: {
              Days: 30,
            },
          },
          {
            ID: "expire-transcripts",
            Status: "Enabled",
            Filter: {
              Prefix: "transcripts/",
            },
            Expiration: {
              Days: 30,
            },
          },
          {
            ID: "expire-videos",
            Status: "Enabled",
            Filter: {
              Prefix: "videos/",
            },
            Expiration: {
              Days: 7,
            },
          },
        ],
      },
    }),
  );

  return {
    bucketName,
    region,
  };
};

type ProvisionUserInput = {
  googleId: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export const provisionUser = async ({ googleId, email, name, image }: ProvisionUserInput) => {
  const normalizedEmail = email.trim().toLowerCase();

  const [existingUser] = await db
    .select()
    .from(users)
    .where(or(eq(users.googleId, googleId), eq(users.email, normalizedEmail)))
    .limit(1);

  if (existingUser?.s3Bucket) {
    if (existingUser.googleId !== googleId || existingUser.name !== name || existingUser.image !== image) {
      const [updatedUser] = await db
        .update(users)
        .set({
          googleId,
          email: normalizedEmail,
          name: name ?? existingUser.name,
          image: image ?? existingUser.image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      return {
        created: false,
        user: updatedUser,
      };
    }

    return {
      created: false,
      user: existingUser,
    };
  }

  const userId = existingUser?.id ?? crypto.randomUUID();
  const { bucketName, region } = await createUserBucket(userId, DEFAULT_REGION);

  if (existingUser) {
    const [updatedUser] = await db
      .update(users)
      .set({
        googleId,
        email: normalizedEmail,
        name: name ?? existingUser.name,
        image: image ?? existingUser.image,
        s3Bucket: bucketName,
        s3Region: region,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    return {
      created: false,
      user: updatedUser,
    };
  }

  try {
    const [createdUser] = await db
      .insert(users)
      .values({
        id: userId,
        googleId,
        email: normalizedEmail,
        name: name ?? null,
        image: image ?? null,
        s3Bucket: bucketName,
        s3Region: region,
      })
      .returning();

    return {
      created: true,
      user: createdUser,
    };
  } catch (_error) {
    const [racedUser] = await db
      .select()
      .from(users)
      .where(or(eq(users.googleId, googleId), eq(users.email, normalizedEmail)))
      .limit(1);

    if (!racedUser) {
      throw _error;
    }

    return {
      created: false,
      user: racedUser,
    };
  }
};

type SignedUrlParams = {
  bucket: string;
  key: string;
  expiresIn?: number;
  contentType?: string;
  region?: string;
};

export const presignedPut = async ({
  bucket,
  key,
  expiresIn = 900,
  contentType,
  region,
}: SignedUrlParams) => {
  const client = getS3Client(region);

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
};

export const presignedGet = async ({ bucket, key, expiresIn = 3600, region }: SignedUrlParams) => {
  const client = getS3Client(region);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn },
  );
};

export const deleteObject = async ({ bucket, key, region }: Pick<SignedUrlParams, "bucket" | "key" | "region">) => {
  const client = getS3Client(region);

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
};

export const headObject = async ({ bucket, key, region }: Pick<SignedUrlParams, "bucket" | "key" | "region">) => {
  const client = getS3Client(region);
  return client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
};

export const getObjectJson = async <T>({
  bucket,
  key,
  region,
}: Pick<SignedUrlParams, "bucket" | "key" | "region">): Promise<T> => {
  const client = getS3Client(region);
  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );

  const body = await result.Body?.transformToString();

  if (!body) {
    throw new Error(`Missing body for ${bucket}/${key}`);
  }

  return JSON.parse(body) as T;
};

export const putObjectFromBuffer = async ({
  bucket,
  key,
  body,
  contentType,
  region,
}: Pick<SignedUrlParams, "bucket" | "key" | "contentType" | "region"> & { body: Buffer | Uint8Array | string }) => {
  const client = getS3Client(region);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

export const copyObject = async ({
  sourceBucket,
  sourceKey,
  destinationBucket,
  destinationKey,
  region,
  contentType,
}: {
  sourceBucket: string;
  sourceKey: string;
  destinationBucket: string;
  destinationKey: string;
  region?: string;
  contentType?: string;
}) => {
  const client = getS3Client(region);
  const encodedSource = `${sourceBucket}/${sourceKey.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;

  await client.send(
    new CopyObjectCommand({
      Bucket: destinationBucket,
      Key: destinationKey,
      CopySource: encodedSource,
      ContentType: contentType,
      MetadataDirective: contentType ? "REPLACE" : undefined,
    }),
  );
};
