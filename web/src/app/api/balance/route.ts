import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.POLLINATIONS_API_KEY || "";

  if (!apiKey) {
    return NextResponse.json({
      success: true,
      balance: 0,
    });
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

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
      { status: 500 }
    );
  }
}
