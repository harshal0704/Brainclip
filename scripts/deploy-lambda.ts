import {execFileSync} from "node:child_process";

import {GetFunctionCommand, LambdaClient} from "@aws-sdk/client-lambda";
import {getFunctions, getSites, type AwsRegion} from "@remotion/lambda/client";

const region = (process.env.AWS_REGION ?? "ap-south-1") as AwsRegion;
const siteName = "svgen-reel";

const runRemotion = (args: string[]) => {
  const isWindows = process.platform === "win32";
  const command = isWindows ? "npx.cmd" : "npx";

  execFileSync(command, ["remotion", ...args], {
    stdio: "inherit",
    env: process.env,
  });
};

const main = async () => {
  console.log(`Deploying Remotion Lambda function in ${region}...`);
  runRemotion([
    "lambda",
    "functions",
    "deploy",
    "--region",
    region,
    "--memory",
    "2048",
    "--disk",
    "10240",
    "--timeout",
    "120",
  ]);

  console.log(`Creating Remotion site ${siteName}...`);
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

  const functions = await getFunctions({
    region,
    compatibleOnly: false,
  });
  const sortedFunctions = [...functions].sort((a, b) => a.functionName.localeCompare(b.functionName));
  const deployedFunction = sortedFunctions[sortedFunctions.length - 1];

  if (!deployedFunction) {
    throw new Error("No Remotion Lambda function was found after deployment.");
  }

  const sites = await getSites({
    region,
    compatibleOnly: false,
  });
  const deployedSite = sites.sites.find((site) => site.id === siteName);

  if (!deployedSite) {
    throw new Error(`Remotion site ${siteName} was not found after deployment.`);
  }

  const lambdaClient = new LambdaClient({region});
  const lambdaDetails = await lambdaClient.send(
    new GetFunctionCommand({
      FunctionName: deployedFunction.functionName,
    }),
  );

  console.log("\nCopy these values into your .env:");
  console.log(`REMOTION_FUNCTION_NAME=${deployedFunction.functionName}`);
  console.log(`REMOTION_SERVE_URL=${deployedSite.serveUrl}`);
  console.log(`AWS_REGION=${region}`);
  console.log(`FUNCTION_ARN=${lambdaDetails.Configuration?.FunctionArn ?? "unavailable"}`);
};

main().catch((error) => {
  console.error("Remotion Lambda deployment failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
