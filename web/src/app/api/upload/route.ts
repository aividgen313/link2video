import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = "media";

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

/**
 * Upload a base64 data URL to Supabase Storage.
 * Returns a public URL for the stored file.
 *
 * Body: { dataUrl: string, path: string, contentType?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Cloud storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY." },
        { status: 501 }
      );
    }

    const body = await req.json();
    const { dataUrl, path } = body;

    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ error: "dataUrl is required" }, { status: 400 });
    }
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "path is required (e.g. 'projects/123/scene_1.jpg')" }, { status: 400 });
    }

    // Parse base64 data URL → Buffer
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      // It's already a URL, not a data URL — just return it
      return NextResponse.json({ success: true, url: dataUrl });
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType,
        upsert: true, // overwrite if exists
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path,
      size: buffer.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed: " + (err instanceof Error ? err.message : "Unknown error") },
      { status: 500 }
    );
  }
}
