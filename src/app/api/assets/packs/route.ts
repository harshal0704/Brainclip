import { NextResponse } from "next/server";

import { assetPackCatalog } from "@/lib/catalog";

export async function GET() {
  return NextResponse.json({ packs: assetPackCatalog });
}
