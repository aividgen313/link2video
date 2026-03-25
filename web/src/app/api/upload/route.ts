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
let bucketCheckedAt = 0;

async function ensureBucket(supabase: any): Promise<boolean> {
  if (bucketReady === true) return true;
  // Retry after 30s if previously failed (don't permanently block)
  if (bucketReady === false && Date.now() - bucketCheckedAt < 30000) return false;

  try {
    // Try creating the bucket (idempotent — no-ops if it already exists)
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !error.message.includes("already exists")) {
      console.warn("[upload] Could not create bucket:", error.message);
      bucketReady = false;
      bucketCheckedAt = Date.now();
      return false;
    }
    bucketReady = true;
    return true;
  } catch (e) {
    console.warn("[upload] Bucket check failed:", e);
    bucketReady = false;
    bucketCheckedAt = Date.now();
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
      // Graceful fallback: cloud storage not configured, return success:false so client can use local storage
      return NextResponse.json({ success: false, error: "Cloud storage not configured", local: true });
    }

    const body = await req.json();
    const { dataUrl, json, path } = body;

    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    let buffer: Buffer;
    let contentType: string = "application/octet-stream";

    if (json) {
      // Direct JSON upload
      buffer = Buffer.from(JSON.stringify(json));
      contentType = "application/json";
    } else if (dataUrl && typeof dataUrl === "string") {
      // Data URL upload (base64)
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        buffer = Buffer.from(match[2], "base64");
      } else {
        // It's already a URL, nothing to upload if we were expecting data
        return NextResponse.json({ success: true, url: dataUrl });
      }
    } else {
      return NextResponse.json({ error: "Either dataUrl or json is required" }, { status: 400 });
    }

    // Ensure bucket exists before attempting upload
    const ready = await ensureBucket(supabase);
    if (!ready) {
      // Return a non-error 200 so the client falls back to the original URL silently
      return NextResponse.json({ success: false, error: "Storage bucket unavailable" }, { status: 200 });
    }


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

/**
 * Fetch a file from Supabase Storage by path.
 * Query: ?path=projects/123/state.json
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      // Graceful fallback: return empty data instead of error
      return NextResponse.json({ error: "Cloud storage not configured", local: true }, { status: 200 });
    }

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) return NextResponse.json({ error: "path is required" }, { status: 400 });

    const { data, error } = await supabase.storage.from(BUCKET).download(path);

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "File not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    // Stream the raw buffer directly to the client (more memory efficient)
    return new Response(buffer, {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Fetch failed: " + (err instanceof Error ? err.message : "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * Delete a file from Supabase Storage by path.
 * Query: ?path=projects/123/state.json
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Cloud storage not configured", local: true });
    }

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    if (!path) return NextResponse.json({ error: "path is required" }, { status: 400 });

    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, path });
  } catch (err) {
    return NextResponse.json(
      { error: "Delete failed: " + (err instanceof Error ? err.message : "Unknown error") },
      { status: 500 }
    );
  }
}
