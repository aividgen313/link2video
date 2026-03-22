import { NextRequest, NextResponse } from "next/server";

/**
 * PLACEHOLDER: Server-side video stitching endpoint.
 *
 * This route is NOT yet implemented. A production implementation would use a
 * managed service (e.g. AWS MediaConvert, Creatomate) or a background job with
 * fluent-ffmpeg on a VPS. Client-side stitching via @ffmpeg/ffmpeg is another option.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error: "Not implemented. Server-side video stitching is not yet available.",
      code: "NOT_IMPLEMENTED",
    },
    { status: 501 }
  );
}
