import { execFileSync } from "node:child_process";

import {
  AttachRolePolicyCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import {
  GetFunctionCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
} from "@aws-sdk/client-lambda";
import { getFunctions, getSites, type AwsRegion } from "@remotion/lambda/client";

const region = (process.env.AWS_REGION ?? "us-east-1") as AwsRegion;
const siteName = "svgen-reel";
const iamClient = new IAMClient({ region });
const lambdaClient = new LambdaClient({ region });

const runRemotion = (args: string[]) => {
  execFileSync("npx", ["remotion", ...args], {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
};

const accountId = process.env.AWS_ACCOUNT_ID;
if (!accountId) {
  throw new Error("AWS_ACCOUNT_ID env var is required");
}

const inlineS3PolicyName = "BrainclipRemotionS3Access";
const inlineS3Policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "ListAllBuckets",
      Effect: "Allow",
      Action: ["s3:ListAllMyBuckets"],
      Resource: "*",
    },
    {
      Sid: "RemotionLambdaBuckets",
      Effect: "Allow",
      Action: [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
      ],
      Resource: [
        `arn:aws:s3:::remotionlambda-${region}-*`,
        `arn:aws:s3:::remotionlambda-${region}-*/*`,
        `arn:aws:s3:::brainclips-videos`,
        `arn:aws:s3:::brainclips-videos/*`,
        `arn:aws:s3:::brainclip-presets`,
        `arn:aws:s3:::brainclip-presets/*`,
        `arn:aws:s3:::svgen-*`,
        `arn:aws:s3:::svgen-*/*`,
        `arn:aws:s3:::brainclips-${region}-*`,
        `arn:aws:s3:::brainclips-${region}-*/*`,
      ],
    },
    {
      Sid: "InvokeOtherRemotionFunctions",
      Effect: "Allow",
      Action: ["lambda:InvokeFunction"],
      Resource: `arn:aws:lambda:${region}:${accountId}:function:remotion-render-*`,
    },
    {
      Sid: "CloudWatchLogs",
      Effect: "Allow",
      Action: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      Resource: [
        `arn:aws:logs:${region}:${accountId}:log-group:/aws/lambda/remotion-render-*`,
        `arn:aws:logs:${region}:*:log-group:/aws/lambda-insights:*`,
      ],
    },
  ],
};

const attachBasicExecutionPolicy = (roleName: string) => {
  return iamClient.send(
    new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    }),
  );
};

const ensureS3RolePolicy = async (roleName: string) => {
  try {
    await iamClient.send(
      new PutRolePolicyCommand({
        RoleName: roleName,
        PolicyName: inlineS3PolicyName,
        PolicyDocument: JSON.stringify(inlineS3Policy),
      }),
    );
    console.log(`✅ S3 IAM policy '${inlineS3PolicyName}' attached/updated on role '${roleName}'`);
  } catch (error) {
    console.error(`❌ Failed to attach S3 IAM policy:`, error instanceof Error ? error.message : error);
    throw error;
  }
};

const TARGET_MEMORY_MB = 3008;
const TARGET_TIMEOUT_SEC = 900;

const main = async () => {
  console.log(`\n=== Step 1: Deploy Remotion Lambda function in ${region} ===`);
  runRemotion([
    "lambda",
    "functions",
    "deploy",
    "--region",
    region,
    "--memory",
    String(TARGET_MEMORY_MB),
    "--disk",
    "10240",
    "--timeout",
    String(TARGET_TIMEOUT_SEC),
  ]);

  console.log(`\n=== Step 2: Create Remotion site ${siteName} ===`);
  runRemotion([
    "lambda",
    "sites",
    "create",
    "remotion/index.tsx",
    "--site-name",
    siteName,
    "--region",
    region,
  ]);

  const functions = await getFunctions({ region, compatibleOnly: false });
  const sortedFunctions = [...functions].sort((a, b) => a.functionName.localeCompare(b.functionName));
  const deployedFunction = sortedFunctions[sortedFunctions.length - 1];

  if (!deployedFunction) {
    throw new Error("No Remotion Lambda function was found after deployment.");
  }

  const sites = await getSites({ region, compatibleOnly: false });
  const deployedSite = sites.sites.find((site) => site.id === siteName);

  if (!deployedSite) {
    throw new Error(`Remotion site ${siteName} was not found after deployment.`);
  }

  console.log(`\n=== Step 3: Verify Lambda configuration ===`);
  const functionName = deployedFunction.functionName;
  const lambdaDetails = await lambdaClient.send(
    new GetFunctionCommand({ FunctionName: functionName }),
  );

  const currentTimeout = lambdaDetails.Configuration?.Timeout ?? 0;
  const currentMemory = lambdaDetails.Configuration?.MemorySize ?? 0;

  if (currentTimeout !== TARGET_TIMEOUT_SEC) {
    console.log(`⚠️  Lambda timeout is ${currentTimeout}s (expected ${TARGET_TIMEOUT_SEC}s). Updating...`);
    await lambdaClient.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        Timeout: TARGET_TIMEOUT_SEC,
      }),
    );
    console.log(`✅ Lambda timeout updated to ${TARGET_TIMEOUT_SEC}s.`);
  } else {
    console.log(`✅ Lambda timeout verified at ${TARGET_TIMEOUT_SEC}s.`);
  }

  if (currentMemory !== TARGET_MEMORY_MB) {
    console.log(`⚠️  Lambda memory is ${currentMemory}MB (expected ${TARGET_MEMORY_MB}MB). Updating...`);
    await lambdaClient.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        MemorySize: TARGET_MEMORY_MB,
      }),
    );
    console.log(`✅ Lambda memory updated to ${TARGET_MEMORY_MB}MB.`);
  } else {
    console.log(`✅ Lambda memory verified at ${TARGET_MEMORY_MB}MB.`);
  }

  console.log(`\n=== Step 4: Attach S3 IAM policy ===`);
  const roleArn = lambdaDetails.Configuration?.Role ?? "";
  const roleName = roleArn.split("/").pop() ?? "";
  if (!roleName) {
    throw new Error("Lambda IAM role not found. Check IAM console manually.");
  }
  console.log(`   Lambda IAM role: ${roleName}`);

  await attachBasicExecutionPolicy(roleName);
  await ensureS3RolePolicy(roleName);

  console.log(`\n=== Step 5: Print env values ===`);
  console.log(`REMOTION_FUNCTION_NAME=${deployedFunction.functionName}`);
  console.log(`REMOTION_SERVE_URL=${deployedSite.serveUrl}`);
  console.log(`AWS_REGION=${region}`);
  console.log(`AWS_ACCOUNT_ID=${accountId}`);
  console.log(`FUNCTION_ARN=${lambdaDetails.Configuration?.FunctionArn ?? "unavailable"}`);
  console.log(`LAMBDA_ROLE_NAME=${roleName}`);
  console.log(`\n✅ Deployment complete! Add the above env vars to your .env file.\n`);
};

main().catch((error) => {
  console.error("\n❌ Remotion Lambda deployment failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
