# Open Foot Traffic Signal Engine - MCP Server

An MCP (Model Context Protocol) server that provides site selection intelligence for commercial real estate, retail chains, and city planners using free, open data sources.

## What This Tool Does

Answers the $10,000-$27,000/year question: **"Where should I open this location, and how does it compare to alternatives?"**

This tool unbundles the core site comparison feature of Placer.ai and similar expensive foot traffic analytics platforms, delivering comparable site intelligence at $0.10 per query using fully open data sources.

## Features

### 🎯 Four Core Tools

1. **`get_site_intelligence`** - Comprehensive analysis of a single location
   - POI density scoring
   - Pedestrian infrastructure analysis
   - Population density assessment
   - Competitor saturation mapping
   - Inferred peak hour patterns
   - Composite site score (0-100)

2. **`compare_sites`** - Side-by-side comparison of 2-5 locations
   - Ranked site comparison
   - AI-generated recommendation with reasoning
   - Risk factor identification
   - Suggested action for decision-makers
   - Full comparison matrix

3. **`get_area_signals`** - Neighborhood-level foot traffic profiling
   - Area commercial activity assessment
   - Dominant business categories
   - Foot traffic potential rating
   - Recommended business types

4. **`get_competitor_density`** - Focused competitor analysis
   - Competitor counts at 250m, 500m, and 1km radii
   - Saturation level assessment
   - List of closest competitors with distances

### 📊 Data Sources (All Free & Open)

- **OpenStreetMap** - POI density, pedestrian infrastructure, amenity composition
- **GeoNames** - Population density data
- **Public Transit Feeds (GTFS)** - Peak hour inference
- **Google Places API** (optional) - Review velocity signals (free tier)

**No mobile device tracking. No proprietary data. Full transparency.**

### 🌍 Global Coverage

Works anywhere OpenStreetMap has data - especially strong in emerging markets like Lagos, Nairobi, Accra, Karachi, and other cities where Placer.ai coverage is limited.

## Installation & Setup

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 8.x or higher

### Step 1: Clone or Download

```bash
# If you have the code in a directory
cd foot-traffic-mcp-server

# Or create from the files provided
mkdir foot-traffic-mcp-server
cd foot-traffic-mcp-server
# Then copy all the source files into this directory
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - HTTP server for remote access
- `node-fetch` - HTTP client for API calls
- `zod` - Runtime input validation
- TypeScript and related development tools

### Step 3: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### Step 4: Test the Installation

```bash
npm test
```

Or directly:

```bash
node dist/index.js --help
```

You should see the help message with tool descriptions.

### Step 5: Configure Environment Variables (Optional)

Create a `.env` file in the project root for optional configuration:

```bash
# Optional: GeoNames username for population data
# Default is 'demo' but rate-limited. Register free at https://www.geonames.org/
GEONAMES_USERNAME=your_username

# Optional: Google Places API key for review velocity data
# If not provided, review scores will use a neutral default value
GOOGLE_PLACES_API_KEY=your_api_key

# For HTTP transport mode
PORT=3000
TRANSPORT=stdio
```

**Note:** The tool works perfectly fine without API keys - it will just use reduced signals for review data.

## Usage

### Running as MCP Server

#### Option 1: stdio Transport (Default - for local integrations)

```bash
npm start
```

Or:

```bash
node dist/index.js
```

The server will run on stdio, waiting for MCP protocol messages.

#### Option 2: HTTP Transport (for remote access)

```bash
TRANSPORT=http npm start
```

Or:

```bash
TRANSPORT=http PORT=3000 node dist/index.js
```

The server will run on `http://localhost:3000/mcp` and accept HTTP POST requests.

### Connecting to Claude Desktop or Other MCP Clients

#### Claude Desktop Configuration

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

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

Replace `/absolute/path/to/foot-traffic-mcp-server` with your actual path.

#### Using with MCP Inspector (for testing)

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

This opens a web interface to test the tools interactively.

### Example Queries

Once connected to an MCP client (like Claude), you can ask:

```
"Compare Lekki Phase 1 vs Yaba in Lagos for opening a quick-service restaurant"

"Analyze Victoria Island, Lagos for a coffee shop location"

"What's the foot traffic potential in Ikeja?"

"How many restaurants are within 500m of Allen Avenue, Ikeja?"
```

The MCP client will automatically call the appropriate tools and present the results.

## Tool Reference

### 1. get_site_intelligence

**Purpose:** Analyze a single location comprehensively

**Parameters:**
- `location` (string, required) - Location name or address
- `business_type` (string, required) - Type of business (e.g., "restaurant", "cafe")
- `radius_meters` (number, optional) - Analysis radius, 100-2000 (default: 500)
- `response_format` (string, optional) - "json" or "markdown" (default: "json")

**Returns:** Complete site intelligence with scores, competitor data, and peak hours

**Example:**
```json
{
  "location": "Yaba, Lagos",
  "business_type": "restaurant",
  "radius_meters": 500,
  "response_format": "json"
}
```

### 2. compare_sites

**Purpose:** Compare 2-5 locations with AI recommendation

**Parameters:**
- `locations` (string[], required) - Array of 2-5 location names
- `business_type` (string, required) - Business type for context
- `radius_meters` (number, optional) - Analysis radius (default: 500)
- `response_format` (string, optional) - "json" or "markdown"

**Returns:** Ranked comparison, recommendation, reasoning, and risk factors

**Important:** This tool fetches data for each location sequentially with 2-second delays between requests to respect API rate limits. First-time comparisons may take 12-18 seconds depending on number of locations. Cached comparisons complete in 2-5 seconds.

**Example:**
```json
{
  "locations": ["Lekki Phase 1, Lagos", "Yaba, Lagos", "Victoria Island, Lagos"],
  "business_type": "cafe",
  "response_format": "markdown"
}
```

### 3. get_area_signals

**Purpose:** Get neighborhood-level foot traffic profile

**Parameters:**
- `location` (string, required) - Neighborhood or district name
- `radius_meters` (number, optional) - Analysis radius, 500-2000 (default: 1000)
- `response_format` (string, optional) - "json" or "markdown"

**Returns:** Area profile, dominant categories, and recommended business types

### 4. get_competitor_density

**Purpose:** Analyze competitor saturation

**Parameters:**
- `location` (string, required) - Location name or address
- `business_type` (string, required) - Business type to search for
- `response_format` (string, optional) - "json" or "markdown"

**Returns:** Competitor counts at multiple radii and saturation level

## Architecture

### Data Flow

```
User Query
    ↓
MCP Tool Call
    ↓
Cache Check (7-30 day TTLs depending on data type)
    ↓ (cache miss)
Parallel API Calls:
    - Nominatim (geocoding)
    - Overpass API (POI & infrastructure)
    - GeoNames (population)
    - Google Places (optional, review data)
    ↓
Signal Processing:
    - POI density scoring (0-100)
    - Pedestrian infrastructure scoring (0-100)
    - Review velocity scoring (0-100)
    - Population density scoring (0-100)
    - Competitor saturation analysis
    - Peak hour inference
    ↓
Composite Score Calculation (weighted average)
    ↓
AI Recommendation Generation (for comparisons)
    ↓
Structured Response + Cache Update
    ↓
Return to MCP Client
```

### Caching Strategy

- **POI Data:** 7 days (OSM changes slowly)
- **Pedestrian Infrastructure:** 7 days
- **Review Data:** 48 hours (more dynamic)
- **Population Data:** 30 days (very stable)
- **Transit Data:** 14 days
- **Geocoding:** 30 days

Aggressive caching keeps API usage well within free tier limits.

### Rate Limiting

- Overpass API: 1 second between requests
- Nominatim: 1 second per policy
- Google Places: 100ms between requests
- All managed automatically by the server

## Development

### Project Structure

```
foot-traffic-mcp-server/
├── package.json                 # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── README.md                   # This file
├── src/
│   ├── index.ts               # Main server entry point
│   ├── types.ts               # TypeScript type definitions
│   ├── constants.ts           # Configuration and constants
│   ├── services/
│   │   ├── cache.ts          # In-memory caching service
│   │   ├── api-client.ts     # External API clients
│   │   └── signal-processor.ts  # Scoring and analysis logic
│   └── tools/
│       └── foot-traffic-tools.ts  # Tool implementations
└── dist/                       # Compiled JavaScript (generated)
```

### Development Workflow

```bash
# Watch mode - auto-rebuild on file changes
npm run dev

# Build for production
npm run build

# Run built server
npm start

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

### Adding Custom Business Types

Edit `src/constants.ts` and add to `BUSINESS_TYPE_MAPPINGS`:

```typescript
export const BUSINESS_TYPE_MAPPINGS: Record<string, string[]> = {
  'restaurant': ['restaurant', 'fast_food', 'cafe', 'food_court'],
  'your_type': ['osm_tag1', 'osm_tag2', 'osm_tag3'],
  // ...
};
```

## Troubleshooting

### "Location not found" Error

- Check spelling of location name
- Try adding more context: "Yaba, Lagos, Nigeria" instead of just "Yaba"
- Use well-known landmark names or major districts

### "Rate limit exceeded" Error

- The cache should prevent this, but if it happens:
  - Wait 1-2 minutes before retrying
  - Check if you're making many unique location queries in quick succession
  - The tool automatically handles rate limits gracefully

### No Review Data

- If Google Places API key is not set, review_velocity_score defaults to 50
- This is intentional - the tool still works without it
- Other signals (POI density, pedestrian infrastructure, population) provide strong indicators

### Build Errors

```bash
# Clear and reinstall dependencies
rm -rf node_modules dist
npm install
npm run build
```

### TypeScript Errors

Ensure you're using Node.js 18+ and TypeScript 5.3+:

```bash
node --version
npx tsc --version
```

## Cost Comparison

| Service | Annual Cost | Per-Query Cost | Use Case |
|---------|-------------|----------------|----------|
| **Placer.ai** | $8,000-$27,000 | N/A (subscription) | Government/enterprise |
| **This Tool** | $0 | ~$0.10* | Independent operators, startups |

*Based on typical 20-50 queries per year for a small business. All data sources are free.

## Limitations

1. **Not Real Device Data:** Uses proxy signals, not actual mobile device location tracking
2. **Data Quality Varies:** OpenStreetMap coverage is uneven - excellent in major cities, sparse in rural areas
3. **No Historical Trends:** Provides current snapshot, not month-over-month trends
4. **Peak Hours Are Inferred:** Not based on actual traffic counts, but amenity composition patterns

**What it's good for:** Site comparison, relative ranking, identifying promising vs. weak locations

**What it's NOT:** A replacement for on-the-ground validation, lease negotiation leverage data, or legal/compliance due diligence

## License

MIT License - see LICENSE file for details

## Contributing

Contributions welcome! Areas for improvement:

- [ ] Add historical trend analysis using OSM change history
- [ ] Integrate GTFS real-time feeds for better peak hour data
- [ ] Support for PDF report generation
- [ ] Walkability score integration (Walk Score API)
- [ ] Transit accessibility scoring
- [ ] Parking availability analysis

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Acknowledgments

Built using:
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [GeoNames](https://www.geonames.org/)
- [Overpass API](https://overpass-api.de/)

Inspired by the need for affordable location intelligence tools for independent business owners and emerging markets.
