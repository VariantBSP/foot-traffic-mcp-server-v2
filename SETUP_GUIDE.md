# Complete Setup Guide - Open Foot Traffic Signal Engine

This guide will walk you through setting up and running the Foot Traffic MCP Server from scratch.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18 or higher** - [Download from nodejs.org](https://nodejs.org/)
- **npm** (comes with Node.js)
- A terminal/command prompt
- Basic familiarity with command line operations

### Check Your Node.js Version

```bash
node --version
# Should show v18.0.0 or higher

npm --version
# Should show 8.0.0 or higher
```

If you need to install or update Node.js, visit https://nodejs.org/

---

## Step 1: Get the Code

You should have a folder named `foot-traffic-mcp-server` with the following structure:

```
foot-traffic-mcp-server/
├── package.json
├── tsconfig.json
├── README.md
├── SETUP_GUIDE.md (this file)
├── .gitignore
├── .env.example
└── src/
    ├── index.ts
    ├── types.ts
    ├── constants.ts
    ├── services/
    │   ├── cache.ts
    │   ├── api-client.ts
    │   └── signal-processor.ts
    └── tools/
        └── foot-traffic-tools.ts
```

Navigate to this folder:

```bash
cd /path/to/foot-traffic-mcp-server
```

---

## Step 2: Install Dependencies

Run the following command to install all required packages:

```bash
npm install
```

This will install:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - Web server for HTTP transport
- `node-fetch` - HTTP client for API calls
- `zod` - Input validation
- `esbuild` - Fast JavaScript bundler
- TypeScript and type definitions

**Expected output:**
```
added 142 packages, and audited 143 packages in 20s
found 0 vulnerabilities
```

---

## Step 3: Build the Project

Compile the TypeScript code to JavaScript:

```bash
npm run build
```

**Expected output:**
```
> foot-traffic-mcp-server@1.0.0 build
> esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js ...

  dist/index.js  40.3kb

⚡ Done in 86ms
```

This creates a `dist/` folder with the compiled JavaScript.

---

## Step 4: Verify Installation

Test that everything works:

```bash
npm test
```

Or directly:

```bash
node dist/index.js --help
```

**Expected output:**
```
Foot Traffic MCP Server
=======================

An MCP server that provides site selection intelligence using open data sources.
Replaces expensive foot traffic analytics subscriptions with free, transparent signals.

Usage:
  npm start                  # Run with stdio transport (default)
  TRANSPORT=http npm start   # Run with HTTP transport on port 3000
  npm test                   # Test the build

...
```

If you see this, **installation is complete!** ✅

---

## Step 5: Configure Environment (Optional)

The server works out-of-the-box with no configuration. However, for better results, you can set up API keys:

### Create Environment File

```bash
cp .env.example .env
```

### Edit .env File

Open `.env` in a text editor and configure:

```bash
# GeoNames API - For better population data
# Register FREE at: https://www.geonames.org/login
GEONAMES_USERNAME=your_username_here

# Google Places API - For review velocity data (optional)
# Get from: https://console.cloud.google.com/
GOOGLE_PLACES_API_KEY=your_api_key_here

# Server configuration (change if needed)
TRANSPORT=stdio
PORT=3000
```

**Important Notes:**
- **GeoNames**: The default `demo` username works but is rate-limited. Get a free account for better performance.
- **Google Places**: This is optional. Without it, review scores use neutral defaults. The tool still works great!

---

## Step 6: Run the Server

### Option A: stdio Transport (for MCP clients like Claude Desktop)

```bash
npm start
```

The server will run and wait for MCP protocol messages on standard input/output.

### Option B: HTTP Transport (for remote access or testing)

```bash
TRANSPORT=http npm start
```

Or:

```bash
TRANSPORT=http PORT=3000 npm start
```

**Expected output:**
```
Foot Traffic MCP Server running on http://localhost:3000/mcp
```

You can now send HTTP POST requests to `http://localhost:3000/mcp` with MCP protocol messages.

---

## Step 7: Connect to Claude Desktop (Recommended)

### Find Your Config File

**macOS:**
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
notepad %APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
code ~/.config/Claude/claude_desktop_config.json
```

### Add the MCP Server

Add this configuration (replace the path with your actual path):

```json
{
  "mcpServers": {
    "foot-traffic": {
      "command": "node",
      "args": ["/absolute/path/to/foot-traffic-mcp-server/dist/index.js"]
    }
  }
}
```

**Example for macOS/Linux:**
```json
{
  "mcpServers": {
    "foot-traffic": {
      "command": "node",
      "args": ["/Users/yourname/projects/foot-traffic-mcp-server/dist/index.js"]
    }
  }
}
```

**Example for Windows:**
```json
{
  "mcpServers": {
    "foot-traffic": {
      "command": "node",
      "args": ["C:\\Users\\yourname\\projects\\foot-traffic-mcp-server\\dist\\index.js"]
    }
  }
}
```

### Restart Claude Desktop

Close and reopen Claude Desktop. The foot traffic tools should now be available!

---

## Step 8: Test the Tools

In Claude Desktop, try these example queries:

```
"Compare Lekki Phase 1 vs Yaba in Lagos for opening a quick-service restaurant"

"Analyze Victoria Island, Lagos for a coffee shop location"

"What's the foot traffic potential in Ikeja, Lagos?"

"How many restaurants are within 500m of Times Square, New York?"
```

Claude will automatically use the foot traffic tools to answer these questions!

---

## Testing with MCP Inspector (Alternative)

If you want to test the tools interactively without Claude Desktop:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web interface (usually at http://localhost:5173) where you can:
- See all available tools
- Test each tool with custom inputs
- View the JSON responses

---

## Troubleshooting

### Build Errors

**Problem:** `npm run build` fails

**Solution:**
```bash
# Clear everything and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### "Module not found" Errors

**Problem:** `Error: Cannot find module '@modelcontextprotocol/sdk'`

**Solution:**
```bash
# Reinstall dependencies
npm install
```

### "Location not found" Errors

**Problem:** The tool can't find a location

**Solutions:**
- Add more context: "Yaba, Lagos, Nigeria" instead of just "Yaba"
- Use well-known landmarks or major districts
- Check spelling

### Rate Limit Errors

**Problem:** "Rate limit exceeded" error

**Solutions:**
- Wait 1-2 minutes before retrying
- The cache should prevent this - check if you're making many unique queries quickly
- Consider registering for a free GeoNames account

### No Review Data

**Problem:** Review scores are always 50

**Explanation:** This is normal without a Google Places API key. The tool still works well using other signals (POI density, pedestrian infrastructure, population).

**Solution (optional):** Get a free Google Places API key:
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable the Places API
4. Create an API key
5. Add to your `.env` file

---

## Development Mode

If you're modifying the code, use watch mode for automatic rebuilds:

```bash
npm run dev
```

This will rebuild automatically whenever you save a file.

---

## Upgrading

To get the latest version:

```bash
# Pull latest code (if using git)
git pull

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

---

## Quick Reference Card

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Test the build
npm test

# Run with stdio (for Claude Desktop)
npm start

# Run with HTTP transport
TRANSPORT=http npm start

# Development mode (auto-rebuild)
npm run dev

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Getting Help

If you encounter issues:

1. Check this troubleshooting section
2. Review the main README.md
3. Make sure Node.js version is 18+
4. Try clearing node_modules and rebuilding
5. Check the error message carefully - it usually tells you what's wrong

---

## What's Next?

Now that your server is running:

1. **Try the example queries** in Claude Desktop
2. **Explore different locations** - the tool works globally!
3. **Experiment with business types** - restaurant, cafe, retail, gym, etc.
4. **Compare multiple sites** before making lease decisions
5. **Share your results** - this tool saves $10,000-$27,000/year!

---

## System Requirements

- **RAM:** 512MB minimum (tool is very lightweight)
- **Disk Space:** ~50MB for node_modules and build
- **Internet:** Required for API calls to OSM, GeoNames
- **OS:** Works on macOS, Windows, Linux

---

## Performance

- **Typical query time:** 5-12 seconds (cache miss)
- **Cached queries:** < 2 seconds
- **Cache duration:** 7-30 days depending on data type
- **API cost:** $0 (all free tier)

Enjoy your affordable foot traffic intelligence! 🎯
