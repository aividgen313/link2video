import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.POLLINATIONS_API_KEY || "";

  if (!apiKey) {
    // Graceful fallback: return free-tier defaults instead of error
    return NextResponse.json({
      success: true,
      balance: 0,
      tier: "free",
      name: null,
      nextResetAt: null,
      note: "No API key configured — using free tier",
    });
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    // Fetch balance and profile in parallel
    const [balanceRes, profileRes] = await Promise.all([
      fetch("https://gen.pollinations.ai/account/balance", {
        headers,
        signal: AbortSignal.timeout(10000),
      }),
      fetch("https://gen.pollinations.ai/account/profile", {
        headers,
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    if (!balanceRes.ok) {
      throw new Error(`Balance API error: ${balanceRes.status}`);
    }

    const balanceData = await balanceRes.json();
    const profileData = profileRes.ok ? await profileRes.json() : null;

    return NextResponse.json({
      success: true,
      balance: balanceData.balance ?? 0,
      tier: profileData?.tier || "unknown",
      name: profileData?.name || null,
      nextResetAt: profileData?.nextResetAt || null,
    });
  } catch (err) {
    console.error("Balance check failed:", err);
    return NextResponse.json(
      { error: "Failed to check balance", balance: 0 },
      { status: 502 }
    );
  }
}
