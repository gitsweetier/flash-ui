# Vercel Deployment Guide

## Security Fix Applied ✅

The API key is now **server-side only** via Vercel serverless functions. The key never gets exposed to the client.

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

**New dependencies added:**
- `@anthropic-ai/sdk` - For Claude API support
- `openai` - For OpenAI API support

These are automatically installed when you run `npm install`.

### 2. Set Environment Variables in Vercel

**Important:** API keys are stored as Vercel environment variables, NOT in your code.

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add environment variables for the AI providers you want to use:

   **For Google Gemini models:**
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Your Gemini API key
   - **Environment:** Production, Preview, Development (select all)

   **For Anthropic Claude models:**
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** Your Anthropic API key
   - **Environment:** Production, Preview, Development (select all)

   **For OpenAI models:**
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Your OpenAI API key
   - **Environment:** Production, Preview, Development (select all)

**Note:** You only need to add API keys for the providers you plan to use. The app will show an error if you try to use a model without its API key configured.

### 3. Deploy to Vercel

**Option A: Via Vercel CLI**
```bash
npm i -g vercel
vercel
```

**Option B: Via GitHub Integration**
1. Push your code to GitHub (already done ✅)
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your `gitsweetier/flash-ui` repository
5. Vercel will auto-detect it's a Vite project
6. Add the `GEMINI_API_KEY` environment variable in the setup
7. Deploy!

### 4. Local Development

For local development, create a `.env.local` file:
```
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Optional
OPENAI_API_KEY=your_openai_api_key_here        # Optional
```

You only need to add the API keys for the providers you want to use.

The API routes will work at `http://localhost:3000/api/generate` and `http://localhost:3000/api/variations` when running `npm run dev`.

## How It Works

- **Client code** (`index.tsx`) calls `/api/generate` and `/api/variations`
- **Serverless functions** (`api/generate.ts`, `api/variations.ts`) handle the Gemini API calls
- **API key** stays secure on the server - never exposed to browsers

## Files Changed

- ✅ Created `api/generate.ts` - Main generation endpoint
- ✅ Created `api/variations.ts` - Variations endpoint  
- ✅ Updated `utils.ts` - Added API helper functions
- ✅ Updated `index.tsx` - Removed direct Gemini calls, uses API routes
- ✅ Updated `package.json` - Added `@vercel/node` dependency
- ✅ Created `vercel.json` - Vercel configuration

## Testing

After deployment, test that:
1. The app loads without errors
2. You can generate UI components
3. Variations feature works
4. Check browser DevTools → Network tab - you should see calls to `/api/*` endpoints
5. Check browser DevTools → Sources - the API key should NOT appear anywhere in the client code

