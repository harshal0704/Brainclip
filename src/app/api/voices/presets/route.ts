import { NextResponse } from "next/server";

import { voicePresetCatalog } from "@/lib/catalog";

export async function GET() {
  return NextResponse.json({ presets: voicePresetCatalog });
}
