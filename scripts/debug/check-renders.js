const { getRenderProgress } = require("@remotion/lambda/client");

const renders = [
  "7-days-glty2yukl0",
  "7-days-p3gj4xbcu0",
  "7-days-6mth5fd80k",
  "7-days-rx91dq44e2",
  "7-days-4p6m3qz1pt",
];

async function main() {
  for (const id of renders) {
    try {
      const prog = await getRenderProgress({
        region: "us-east-1",
        functionName: "remotion-render-4-0-438-mem2048mb-disk10240mb-120sec",
        bucketName: "remotionlambda-useast1-x84bfy89tk",
        renderId: id,
      });
      console.log(`${id}: done=${prog.done} fatal=${prog.fatalErrorEncountered} frames=${prog.framesRendered} errors=${prog.errors?.length || 0}`);
      if (prog.errors?.length) {
        prog.errors.forEach(e => console.log(`  Error: ${e.type} — ${e.message.substring(0, 100)}`));
      }
      if (prog.outKey) console.log(`  Output: ${prog.outKey}`);
    } catch (e) {
      console.log(`${id}: error — ${e.message}`);
    }
  }
}

main();
