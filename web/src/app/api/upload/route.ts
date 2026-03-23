import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = "media";

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Module-level cache so we only check/create the bucket once per process lifetime
let bucketReady: boolean | null = null;

async function ensureBucket(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  if (bucketReady === true) return true;
  if (bucketReady === false) return false;

  try {
    // Try creating the bucket (idempotent — no-ops if it already exists)
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !error.message.includes("already exists")) {
      console.warn("[upload] Could not create bucket:", error.message);
      bucketReady = false;
      return false;
    }
    bucketReady = true;
    return true;
  } catch (e) {
    console.warn("[upload] Bucket check failed:", e);
    bucketReady = false;
    return false;
  }
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
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    // Ensure bucket exists before attempting upload
    const ready = await ensureBucket(supabase);
    if (!ready) {
      // Return a non-error 200 so the client falls back to the original URL silently
      return NextResponse.json({ success: false, error: "Storage bucket unavailable" }, { status: 200 });
    }

    // It's already a URL, not a data URL — return as-is
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ success: true, url: dataUrl });
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], "base64");

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      // Return 200 so client falls back silently — don't spam error logs
      return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path,
      size: buffer.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload failed: " + (err instanceof Error ? err.message : "Unknown error") },
      { status: 500 }
    );
  }
}
