# EMERGENCY FIX - Stop Credit Drain

## Option 1: Use Free Google Gemini Instead (RECOMMENDED)

To stop using Runware and switch to FREE Google Gemini:

1. Get a FREE Google API key from: https://makersuite.google.com/app/apikey
2. Set environment variable on Render: `GOOGLE_API_KEY=your_key_here`
3. Change the default model in the code (I can do this for you)

This will use Google's FREE tier for text generation (scripts/angles).

## Option 2: Add Runware Credits

If you want to continue with Runware:
1. Go to https://runware.ai
2. Add credits ($10-20 should be enough for testing)
3. Make sure the RUNWARE_API_KEY is set correctly

## Option 3: Enable Full Mock Mode (FREE - For Development)

I can add a development mode that uses NO APIs and generates mock data for testing the UI/workflow without spending ANY money.

---

## What Burned Your Credits

Based on the code audit, here's what likely happened:

1. **Video API**: Each video generation costs ~$0.10-0.50
2. **Image API**: Each image costs ~$0.01-0.05
3. **Text API**: Each script/angle generation costs ~$0.001-0.01
4. **Audio API**: Each TTS generation costs ~$0.01-0.05

If you tried to generate:
- 10 videos × $0.30 = $3
- 50 images × $0.03 = $1.50
- 100 script generations × $0.01 = $1
- 50 audio clips × $0.03 = $1.50

**But the MAIN issue**: Failed requests were retrying multiple times, and errors weren't stopping the workflow, so one "video generation" attempt could make 10-20 failed API calls, each consuming credits.

---

## Which Option Do You Want?

Tell me which you prefer:
1. **Switch to FREE Google Gemini** (I'll do this now)
2. **Add Runware credits** (you do this yourself)
3. **Enable FREE mock mode** (for testing only)

I recommend #1 - it's free and works well for script generation.
