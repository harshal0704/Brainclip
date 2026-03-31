require("dotenv").config({ path: ".env" });

const {
  S3Client,
  CreateBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PRESETS_BUCKET = "brainclip-presets";
const REGION = process.env.AWS_REGION || "us-east-1";
const VOICE_PRESETS = [
  { id: "atlas-anchor", label: "Atlas Anchor" },
  { id: "nova-spark", label: "Nova Spark" },
  { id: "saffron-note", label: "Saffron Note" },
  { id: "midnight-proof", label: "Midnight Proof" },
];

const s3Client = new S3Client({
  region: REGION,
});

function createWavBuffer(durationSec = 5, sampleRate = 44100) {
  const channels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  
  let offset = 0;
  
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(channels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), offset); offset += 4;
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  for (let i = 0; i < numSamples * channels; i++) {
    const t = i / (sampleRate * channels);
    const freq = 220 * (1 + 0.1 * Math.sin(t * 2));
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.3;
    buffer.writeInt16LE(Math.floor(sample * 32767), offset);
    offset += 2;
  }
  
  return buffer;
}

async function bucketExists(bucketName) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function createPresetsBucket() {
  console.log(`\n=== Creating S3 bucket: ${PRESETS_BUCKET} ===`);
  
  if (await bucketExists(PRESETS_BUCKET)) {
    console.log("Bucket already exists!");
    return true;
  }
  
  const params = {
    Bucket: PRESETS_BUCKET,
    ...(REGION === "us-east-1"
      ? {}
      : {
          CreateBucketConfiguration: {
            LocationConstraint: REGION,
          },
        }),
  };
  
  try {
    await s3Client.send(new CreateBucketCommand(params));
    console.log(`Bucket ${PRESETS_BUCKET} created successfully in ${REGION}`);
    return true;
  } catch (error) {
    if (error.name === "BucketAlreadyOwnedByYou" || error.name === "BucketAlreadyExists") {
      console.log("Bucket already exists (owned by you)!");
      return true;
    }
    console.log(`Cannot create bucket (permission denied): ${error.message}`);
    console.log("Will use existing bucket as fallback...");
    return false;
  }
}

async function uploadPresetAudio() {
  console.log(`\n=== Uploading preset reference audio ===`);
  
  const bucketName = global.PRESETS_BUCKET || PRESETS_BUCKET;
  
  for (const preset of VOICE_PRESETS) {
    const key = `presets/${preset.id}/reference.wav`;
    const wavBuffer = createWavBuffer(5);
    
    console.log(`Uploading ${preset.label} (${preset.id})...`);
    
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: wavBuffer,
          ContentType: "audio/wav",
          Metadata: {
            "voice-id": preset.id,
            "voice-label": preset.label,
            "generated": new Date().toISOString(),
          },
        })
      );
      
      console.log(`  Uploaded: presets/${preset.id}/reference.wav`);
    } catch (error) {
      console.error(`  Failed to upload ${preset.id}: ${error.message}`);
    }
  }
  
  console.log(`\nAudio files uploaded to: ${bucketName}/presets/`);
}

async function testPresignedUrl(voiceId) {
  const client = new S3Client({ region: REGION });
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: PRESETS_BUCKET,
      Key: `test-upload-${Date.now()}.txt`,
    }),
    { expiresIn: 60 }
  );
  console.log(`\nPresigned URL test: ${url.substring(0, 80)}...`);
}

async function main() {
  console.log("=== Brainclip Presets Bucket Setup ===");
  console.log(`Region: ${REGION}`);
  console.log(`Bucket: ${PRESETS_BUCKET}`);
  
  const bucketCreated = await createPresetsBucket();
  
  if (!bucketCreated) {
    console.log("\nAttempting to use existing bucket 'svgen-06d193cb-36de-477a-b37f-b10cdc48d138' as fallback...");
    global.PRESETS_BUCKET = "svgen-06d193cb-36de-477a-b37f-b10cdc48d138";
    console.log(`Using bucket: ${global.PRESETS_BUCKET}`);
  }
  
  await uploadPresetAudio();
  await testPresignedUrl();
  
  console.log("\n=== Setup Complete ===");
  console.log("\nTo use these presets with Colab, ensure:");
  console.log("1. The bucket is accessible from your Colab instance");
  console.log("2. The Colab has network access to S3 (or use presigned GET URLs)");
  console.log("\nNext steps:");
  console.log("1. Replace placeholder WAV files with actual reference audio");
  console.log("2. Test the voice synthesis pipeline");
  console.log("\nNote: The placeholder WAV files contain test tones, not actual voice references.");
  console.log("You'll need to replace them with real voice reference audio files.");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
