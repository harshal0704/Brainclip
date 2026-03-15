import {
  AttachRolePolicyCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import {
  GetFunctionCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";

const region = process.env.AWS_REGION ?? "us-east-1";
const functionName = process.env.REMOTION_FUNCTION_NAME ?? "remotion-render-4-0-438-mem2048mb-disk10240mb-120sec";

if (!process.env.AWS_ACCOUNT_ID) {
  throw new Error("AWS_ACCOUNT_ID env var is required");
}

const accountId = process.env.AWS_ACCOUNT_ID;
const iamClient = new IAMClient({ region });
const lambdaClient = new LambdaClient({ region });

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

const main = async () => {
  console.log(`Fetching Lambda details for: ${functionName}`);
  const lambdaDetails = await lambdaClient.send(
    new GetFunctionCommand({ FunctionName: functionName }),
  );

  const roleArn = lambdaDetails.Configuration?.Role ?? "";
  const roleName = roleArn.split("/").pop() ?? "";

  if (!roleName) {
    throw new Error(`No IAM role found for Lambda ${functionName}. Check AWS console.`);
  }

  console.log(`Lambda IAM role: ${roleName}`);

  console.log(`Attaching AWSLambdaBasicExecutionRole...`);
  await iamClient.send(
    new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    }),
  );
  console.log(`✅ Basic execution role attached`);

  console.log(`Attaching BrainclipRemotionS3Access inline policy...`);
  await iamClient.send(
    new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: inlineS3PolicyName,
      PolicyDocument: JSON.stringify(inlineS3Policy),
    }),
  );
  console.log(`✅ S3 access policy attached`);
  console.log(`\n✅ Done! The Lambda IAM role '${roleName}' now has access to:`);
  console.log(`   - remotionlambda-${region}-* (Remotion bundle + output)`);
  console.log(`   - brainclips-videos (background videos)`);
  console.log(`   - brainclip-presets (voice presets)`);
  console.log(`   - svgen-* (user buckets)`);
  console.log(`\nRerun your failed job to test the fix.\n`);
};

main().catch((error) => {
  console.error(`\n❌ Failed:`, error instanceof Error ? error.message : error);
  process.exit(1);
});
