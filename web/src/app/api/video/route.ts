import { NextRequest, NextResponse } from "next/server";
import { RUNWARE_API_KEY } from "@/lib/runware";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      duration = 5,
      width = 1280,
      height = 720,
      model = "klingai:kling-video@3-standard",
      imageUUID,
      fps = 24,
      CFGScale = 7.5,
    } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    console.log("Runware Video Inference:", prompt.substring(0, 80) + "...");

    // Build the request payload
    const taskPayload: Record<string, unknown> = {
      taskType: "videoInference",
      taskUUID: uuidv4(),
      positivePrompt: prompt,
      model,
      duration,
      width,
      height,
      fps,
      CFGScale,
      numberResults: 1,
      outputType: "URL",
      outputFormat: "mp4",
      includeCost: true,
    };

    // If an imageUUID is provided, use it as the first frame for image-to-video
    if (imageUUID) {
      taskPayload.frameImages = [
        {
          inputImage: imageUUID,
          frame: "first",
        },
      ];
    }

    const response = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNWARE_API_KEY}`,
      },
      body: JSON.stringify([taskPayload]),
    });

    if (!response.ok) {
      console.error(`Runware API HTTP error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `API request failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error("Runware video error:", data.errors);

      // Check for unsupported parameter errors
      const hasUnsupportedParam = data.errors.some((e: any) =>
        e.code === "unsupportedParameter"
      );

      if (hasUnsupportedParam) {
        const paramName = data.errors[0]?.parameter;
        console.error(`Unsupported parameter detected: ${paramName}`);
        return NextResponse.json(
          {
            error: `Invalid parameter '${paramName}' for this video model. Please check API documentation.`,
            details: data.errors[0]?.message,
            documentation: data.errors[0]?.documentation
          },
          { status: 400 }
        );
      }

      // Fallback for credit errors to ensure the app flow still completes for demo purposes
      const isCreditError = data.errors.some((e: any) =>
        e.message?.toLowerCase().includes("credit") ||
        e.message?.toLowerCase().includes("invoice") ||
        e.code === "insufficientCredits"
      );

      if (isCreditError) {
        console.warn("Runware out of credits. Falling back to mock video to allow flow completion.");
        return NextResponse.json({
          success: true,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          videoUUID: uuidv4(),
          seed: Math.floor(Math.random() * 1000000),
          cost: 0,
          duration,
          isMockData: true,
        });
      }

      return NextResponse.json(
        {
          error: data.errors[0]?.message || "Video generation failed",
          errorCode: data.errors[0]?.code,
          details: data.errors
        },
        { status: 500 }
      );
    }

    // Video generation may be async — check if we got a result or need to poll
    const result = data.data?.[0];

    if (result?.videoURL) {
      return NextResponse.json({
        success: true,
        videoUrl: result.videoURL,
        videoUUID: result.videoUUID,
        seed: result.seed,
        cost: result.cost,
        duration,
      });
    }

    // If async, return the task info for polling
    return NextResponse.json({
      success: true,
      status: "processing",
      taskUUID: taskPayload.taskUUID,
      message: "Video is being generated. Poll for results.",
      duration,
    });
  } catch (error) {
    console.error("Video generation error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    // Check for network errors
    if (errorMessage.includes("fetch") || errorMessage.includes("network")) {
      return NextResponse.json(
        {
          error: "Network error: Unable to connect to Runware API. Please check your internet connection.",
          retryable: true
        },
        { status: 503 }
      );
    }

    // Check for timeout errors
    if (errorMessage.includes("timeout")) {
      return NextResponse.json(
        {
          error: "Request timeout: The video generation took too long. Please try again.",
          retryable: true
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal Server Error during video generation",
        message: errorMessage,
        retryable: true
      },
      { status: 500 }
    );
  }
}
