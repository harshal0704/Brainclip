import "dotenv/config";
import { db } from "../src/lib/db";
import { jobs } from "../src/db/schema";
import { desc } from "drizzle-orm";
import { getRenderProgress } from "@remotion/lambda/client";

async function main() {
  const latestJobs = await db.query.jobs.findMany({
    orderBy: [desc(jobs.updatedAt)],
    limit: 5,
  });

  console.log(`Found ${latestJobs.length} recent jobs.`);

  for (const job of latestJobs) {
    console.log(`\nJob ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Render ID: ${job.lambdaRenderId}`);
    console.log(`Bucket: ${job.lambdaBucket}`);
    console.log(`Progress Pct in DB: ${job.progressPct}%`);
    console.log(`Updated At: ${job.updatedAt}`);

    if (job.lambdaRenderId && job.lambdaBucket) {
      try {
        const progress = await getRenderProgress({
          region: process.env.AWS_REGION as any || "us-east-1",
          functionName: process.env.REMOTION_FUNCTION_NAME || "remotion-render-function",
          bucketName: job.lambdaBucket,
          renderId: job.lambdaRenderId,
        });

        console.log(`\n--- Remotion API Status for Render ${job.lambdaRenderId} ---`);
        console.log(`Overall Progress: ${Math.round(progress.overallProgress * 100)}%`);
        console.log(`Done: ${progress.done}`);
        console.log(`Fatal Error Encountered: ${progress.fatalErrorEncountered}`);
        if (progress.errors && progress.errors.length > 0) {
          console.log(`Errors:`, JSON.stringify(progress.errors, null, 2));
        }
        if (progress.outputFile) {
          console.log(`Output File URL: ${progress.outputFile}`);
        }
      } catch (err) {
        console.error(`Error fetching render progress:`, err);
      }
    }
  }

  process.exit(0);
}

main().catch(console.error);