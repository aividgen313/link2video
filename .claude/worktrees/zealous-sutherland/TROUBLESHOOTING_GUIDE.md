# Troubleshooting Guide - Link2Video App

## Current Status

All code fixes have been deployed. If the app still isn't working, follow this diagnostic guide.

## Step 1: Check Render Deployment Status

1. Go to your Render dashboard
2. Check if the latest deployment succeeded
3. Verify the deployment shows commit `e17b67d` or later
4. Check the "Deploy" tab for any build errors

## Step 2: Check Environment Variables on Render

Make sure these environment variables are set:

- `RUNWARE_API_KEY` - Your Runware API key
- `PORT` - Should be set automatically by Render
- Any other API keys you're using

## Step 3: Check Application Logs

Look for these specific log messages in Render:

### ✅ **Good Signs:**
```
▲ Next.js 16.1.6
- Local:         http://localhost:10000
- Network:       http://X.X.X.X:10000
✓ Starting...
✓ Ready in XXXXms
```

### ✅ **Script Generation Working:**
```
Generating script with model: minimax:m2.5@0
Raw AI response (first 500 chars): ...
Successfully parsed script with X scenes
```

### ✅ **Angles Generation Working:**
```
Generating angles with model: minimax:m2.5@0
Raw angles response (first 300 chars): ...
Successfully parsed angles data
Generated X angles
```

### ❌ **Bad Signs to Look For:**

#### API Key Issues:
```
401 Unauthorized
Missing required parameter: API Key
```
**Fix:** Set RUNWARE_API_KEY environment variable on Render

#### Format Errors (Should be fixed):
```
invalidEnum: outputFormat must be 'MP3'
invalidEnum: outputFormat must be 'MP4'
```
**Fix:** Should be fixed in latest code. Check commit e17b67d is deployed.

#### JSON Parsing Errors:
```
JSON Parse failed for response: ...
Failed to parse AI response as JSON
```
**Fix:** Check the raw AI response in logs. The AI model may be returning invalid JSON.

#### Missing Scenes:
```
AI response missing required 'scenes' array
```
**Fix:** The AI model isn't following instructions. May need to adjust prompt or model.

## Step 4: Test Individual Endpoints

You can test the API endpoints directly using curl or the browser:

### Test Script Generation:
```bash
curl -X POST https://your-app.onrender.com/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "The history of the internet",
    "angle": "The untold story",
    "provider": "runware",
    "model": "minimax:m2.5@0",
    "visualStyle": "Cinematic Documentary"
  }'
```

### Test TTS:
```bash
curl -X POST https://your-app.onrender.com/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This is a test",
    "voiceProvider": "elevenlabs:1@1"
  }'
```

### Test Video:
```bash
curl -X POST https://your-app.onrender.com/api/video \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset",
    "model": "klingai:kling-video@3-standard",
    "duration": 5,
    "width": 1280,
    "height": 720
  }'
```

## Step 5: Common Issues and Solutions

### Issue: "Failed to generate script"
**Possible Causes:**
1. Runware API key not set or invalid
2. AI model returning non-JSON response
3. Network timeout

**How to Debug:**
- Check logs for "Generating script with model: ..."
- Look for "Raw AI response" in logs
- Verify the response contains valid JSON

### Issue: "Video generation failed with 400"
**Possible Causes:**
1. Invalid parameters (should be fixed)
2. Unsupported model
3. API quota exceeded

**How to Debug:**
- Check logs for "Runware API error details:"
- Look for specific parameter errors
- Verify outputFormat is uppercase (MP4, MP3, JPG, PNG)

### Issue: "Network error" or "503"
**Possible Causes:**
1. Runware API is down
2. Network connectivity issue
3. Timeout

**How to Debug:**
- Try again in a few minutes
- Check Runware status page
- Increase timeout if needed

## Step 6: Frontend Issues

If the API works but the frontend doesn't:

### Check Browser Console:
1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for errors

### Common Frontend Errors:

**"useAppContext must be used within an AppProvider"**
- The component is outside the AppProvider wrapper
- Check that layout.tsx wraps children with AppProvider

**"Cannot read property 'scenes' of null"**
- scriptData is null
- Script generation may have failed
- Check API logs

**"Failed to fetch"**
- CORS issue
- Network connectivity
- API route not found

## Step 7: Verify Code Deployment

Check that these files have the correct values:

### web/src/app/api/tts/route.ts
```typescript
outputFormat: "MP3",  // Must be uppercase
```

### web/src/app/api/video/route.ts
```typescript
outputFormat: "MP4",  // Must be uppercase
```

### web/src/app/api/runware/image/route.ts
```typescript
outputFormat: "JPG",  // Must be uppercase
```

### web/package.json
```json
"start": "next start -H 0.0.0.0 -p ${PORT:-10000}"
```

## Step 8: Still Not Working?

If you've checked everything above and it still doesn't work:

1. **Get the exact error message** from:
   - Browser console (F12 → Console)
   - Render deployment logs
   - Network tab (F12 → Network)

2. **Share these details:**
   - The specific step where it fails (angles? script? video?)
   - The exact error message
   - The latest 50-100 lines from Render logs
   - Any console errors from the browser

3. **Force a fresh deployment:**
   ```bash
   git commit --allow-empty -m "force rebuild"
   git push
   ```

## Quick Reference: All Fixes Applied

- ✅ Port binding fix (0.0.0.0 for Render)
- ✅ Audio formats uppercase (MP3)
- ✅ Video formats uppercase (MP4)
- ✅ Image formats uppercase (JPG, PNG)
- ✅ Audio API parameters (sampleRate, bitrate)
- ✅ Cinematic storytelling prompt
- ✅ Comprehensive error logging
- ✅ JSON parsing validation
- ✅ Scene array validation

All commits pushed to main branch.
