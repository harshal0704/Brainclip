import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

async function fixBucketCors() {
  const users = await sql`SELECT id, s3_bucket, s3_region FROM users WHERE s3_bucket IS NOT NULL`;
  
  console.log(`Found ${users.length} users with buckets`);
  
  for (const user of users) {
    const bucketName = user.s3_bucket;
    const region = user.s3_region || "us-east-1";
    
    try {
      const regionalClient = new S3Client({ region });
      await regionalClient.send(
        new PutBucketCorsCommand({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: ["*"],
                AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      console.log(`✅ CORS configured for bucket: ${bucketName}`);
    } catch (error) {
      console.error(`❌ Failed for bucket ${bucketName}:`, error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log("\nDone!");
}

fixBucketCors().catch(console.error);
