const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: 'c:/work/aim_high/Brainclip/.env' });

async function fix() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`ALTER TABLE custom_voices ADD COLUMN IF NOT EXISTS reference_audio_key text;`;
    console.log("Column added or already exists");
  } catch (e) {
    console.error("Error migrating DB:", e);
  }
}

fix();
