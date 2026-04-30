# Troubleshooting Guide

## Common Issues and Solutions

### 1. "HTTP 429: Too Many Requests" Error

**Problem:** `Error comparing sites: HTTP 429: Too Many Requests for OVERPASS`

**Why it happens:**
- Overpass API has rate limits (typically 1 request per second)
- When comparing multiple sites, the server needs to make several API calls
- If requests are made too quickly, you hit the rate limit

**Solutions:**

✅ **Wait and retry** - The fix is built-in now:
- The server automatically adds 2-second delays between locations
- First location fetches immediately
- Each subsequent location waits 2 seconds
- Cached locations don't require delays

✅ **Use caching to your advantage:**
- First comparison of "Lagos vs Yaba" takes 10-15 seconds
- Second comparison with same locations takes <5 seconds (cached!)
- Cache lasts 7-30 days depending on data type

✅ **Reduce locations:**
- Compare 2 locations instead of 5 if in a hurry
- You can always do multiple comparisons

**Expected timing for compare_sites:**
- 2 locations: ~12 seconds (first time)
- 3 locations: ~14 seconds (first time)
- 4 locations: ~16 seconds (first time)
- 5 locations: ~18 seconds (first time)
- Any cached: ~2-5 seconds

### 2. "Location not found" Error

**Problem:** `Error: Location not found: [location name]`

**Solutions:**

✅ **Add more context:**
```
❌ Bad:  "Yaba"
✅ Good: "Yaba, Lagos, Nigeria"

❌ Bad:  "Downtown"
✅ Good: "Downtown Manhattan, New York"
```

✅ **Use well-known places:**
- Major districts: "Victoria Island, Lagos"
- Landmarks: "Times Square, New York"
- Neighborhoods: "SoHo, London"

✅ **Check spelling:**
- "Lekki" not "Leki"
- "Manhattan" not "Manhatten"

### 3. Slow Response Times

**Problem:** Queries take 10-15 seconds

**This is normal for first-time queries!**

**Why:**
- Geocoding the location
- Fetching POI data from OpenStreetMap
- Fetching pedestrian infrastructure
- Fetching population data
- Processing and scoring

**Solutions:**

✅ **Use cache:**
- Same location next time: <2 seconds
- Data cached for 7-30 days

✅ **Be patient on first query:**
- It's worth the wait for $10,000+ of value!

✅ **Compare multiple sites once:**
- Better to wait 18 seconds comparing 5 sites
- Than to do 5 separate queries (5 × 12 = 60 seconds)

### 4. Review Scores Always 50

**Problem:** `review_velocity_score` is always 50

**This is expected without Google Places API key!**

**Why:**
- Review data comes from Google Places API
- Requires API key (free tier available)
- Without key, uses neutral default of 50

**Impact:**
- Tool still works great with other signals!
- POI density, infrastructure, population are very strong indicators

**Solution (optional):**

1. Get free Google Places API key:
   - Go to https://console.cloud.google.com/
   - Create project
   - Enable Places API
   - Create API key

2. Add to `.env`:
   ```bash
   GOOGLE_PLACES_API_KEY=your_key_here
   ```

3. Rebuild and restart:
   ```bash
   npm run build
   # Restart Claude Desktop or MCP Inspector
   ```

### 5. Build Errors

**Problem:** `npm run build` fails

**Solutions:**

✅ **Clear and reinstall:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

✅ **Check Node version:**
```bash
node --version
# Should be v18.0.0 or higher
```

✅ **Update npm:**
```bash
npm install -g npm@latest
```

### 6. Tools Not Showing in Claude Desktop

**Problem:** Can't see foot traffic tools in Claude

**Solutions:**

✅ **Check config file location:**

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%\Claude\claude_desktop_config.json`

✅ **Verify JSON syntax:**
```json
{
  "mcpServers": {
    "foot-traffic": {
      "command": "node",
      "args": ["/FULL/PATH/TO/foot-traffic-mcp-server/dist/index.js"]
    }
  }
}
```

✅ **Use absolute paths:**
```bash
# Find absolute path
cd foot-traffic-mcp-server
pwd
# Use the output in your config
```

✅ **Restart Claude Desktop:**
- Quit completely (Cmd+Q on Mac, close from taskbar on Windows)
- Reopen

✅ **Check for errors:**
- Look at Claude Desktop's developer console
- macOS: `~/Library/Logs/Claude/`
- Windows: `%APPDATA%\Claude\logs\`

### 7. "ENOENT" or "Cannot find module" Error

**Problem:** `Error: Cannot find module '@modelcontextprotocol/sdk'`

**Solution:**
```bash
cd foot-traffic-mcp-server
npm install
npm run build
```

### 8. Permission Errors (macOS/Linux)

**Problem:** `EACCES: permission denied`

**Solution:**
```bash
# Make dist/index.js executable
chmod +x dist/index.js

# Or use npm start instead
npm start
```

### 9. GeoNames Rate Limit

**Problem:** Population data unavailable or limited

**Why:**
- Default `demo` username is rate-limited
- Shared across all demo users

**Solution:**

1. Register FREE at https://www.geonames.org/login
2. Enable web services in your account
3. Add to `.env`:
   ```bash
   GEONAMES_USERNAME=your_username
   ```
4. Rebuild and restart

### 10. Results Seem Inaccurate

**Remember: This tool uses proxy signals, not actual device data**

**What to check:**

✅ **Is OSM data good in this area?**
- Visit openstreetmap.org
- Search your location
- Check if POIs are mapped

✅ **Is the location specific enough?**
- "Manhattan" is too broad
- "SoHo, Manhattan" is better
- "Corner of Spring St and Broadway, SoHo" is best

✅ **Are you comparing apples to apples?**
- Same radius for all sites
- Same business type
- Similar urban density levels

**Limitations:**
- Not actual foot traffic counts
- Based on infrastructure and amenity density
- Best for relative comparison, not absolute numbers

---

## Performance Tips

### 1. Warm Up Cache
```bash
# First queries are slow, subsequent are fast
# Compare 2 sites once
# Now those locations are cached for weeks!
```

### 2. Batch Comparisons
```bash
# Better: Compare 5 sites in one query (18 seconds)
# Worse: 5 separate queries (60 seconds total)
```

### 3. Use Appropriate Radius
```bash
# Urban dense: 250-500m
# Suburban: 500-1000m  
# Rural: 1000-2000m
```

### 4. Re-use Locations
```bash
# If comparing "Lagos vs Nairobi" for restaurants
# Then comparing same for cafes
# Second comparison uses cached location data!
```

---

## Still Having Issues?

### Check the Basics
- [ ] Node.js 18+ installed
- [ ] `npm install` completed successfully
- [ ] `npm run build` completed successfully
- [ ] `npm test` shows help message
- [ ] Absolute path used in Claude config
- [ ] Claude Desktop restarted after config change

### Debug Mode

Run in standalone mode to see detailed errors:

```bash
# Terminal 1: Run server with HTTP transport
cd foot-traffic-mcp-server
TRANSPORT=http npm start

# Terminal 2: Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_site_intelligence",
      "arguments": {
        "location": "Manhattan, New York",
        "business_type": "restaurant"
      }
    },
    "id": 1
  }'
```

### Get Help

1. **Check logs** in Claude Desktop
2. **Review error messages** carefully
3. **Try with MCP Inspector** to isolate issues
4. **Search issues** in GitHub (if repo is public)
5. **Create minimal test case** - simplest query that fails

---

## Success Checklist

When everything works, you should see:

✅ `get_site_intelligence` returns scores for a location
✅ `compare_sites` returns ranked comparison (may take 12-18 seconds first time)
✅ `get_area_signals` returns area profile
✅ `get_competitor_density` returns competitor counts
✅ Subsequent queries on same locations are fast (<5 seconds)
✅ Claude can answer "Compare X vs Y for Z business" naturally

**If you see all these, you're ready for production! 🎉**
