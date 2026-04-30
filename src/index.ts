#!/usr/bin/env node

// 1. get_site_intelligence Output Schema
export const GET_SITE_INTELLIGENCE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    location: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        coordinates: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          },
          required: ['latitude', 'longitude']
        },
        administrativeArea: { type: 'string' }
      },
      required: ['name', 'coordinates']
    },
    business_type: { type: 'string' },
    poi_density_score: { 
      type: 'number', 
      minimum: 0, 
      maximum: 100,
      description: 'Point-of-interest density score from OpenStreetMap data'
    },
    pedestrian_infrastructure_score: { 
      type: 'number', 
      minimum: 0, 
      maximum: 100,
      description: 'Pedestrian infrastructure quality score based on footways, crosswalks, transit stops'
    },
    review_velocity_score: { 
      type: 'number', 
      minimum: 0, 
      maximum: 100,
      description: 'Review velocity score indicating commercial activity level'
    },
    population_density_score: { 
      type: 'number', 
      minimum: 0, 
      maximum: 100,
      description: 'Population density score from GeoNames data'
    },
    composite_score: { 
      type: 'number', 
      minimum: 0, 
      maximum: 100,
      description: 'Weighted composite score combining all signals'
    },
    competitor_saturation: {
      type: 'object',
      properties: {
        count_250m: { type: 'number', description: 'Competitors within 250 meters' },
        count_500m: { type: 'number', description: 'Competitors within 500 meters' },
        count_1km: { type: 'number', description: 'Competitors within 1 kilometer' },
        saturation_level: { 
          type: 'string', 
          enum: ['low', 'moderate', 'high', 'saturated'],
          description: 'Overall market saturation level'
        },
        competitors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              distance_meters: { type: 'number' },
              type: { type: 'string' }
            },
            required: ['name', 'distance_meters', 'type']
          },
          description: 'List of nearby competitors with distances'
        }
      },
      required: ['count_250m', 'count_500m', 'count_1km', 'saturation_level', 'competitors']
    },
    inferred_peak_hours: {
      type: 'object',
      properties: {
        morning: { type: 'string', description: 'Morning peak hours (e.g., "8am-10am")' },
        midday: { type: 'string', description: 'Midday peak hours (e.g., "12pm-2pm")' },
        evening: { type: 'string', description: 'Evening peak hours (e.g., "6pm-9pm")' },
        pattern_type: { 
          type: 'string', 
          enum: ['residential', 'commercial', 'entertainment', 'mixed'],
          description: 'Dominant activity pattern type'
        },
        confidence: { 
          type: 'string', 
          enum: ['high', 'medium', 'low'],
          description: 'Confidence level in pattern inference'
        }
      },
      required: ['pattern_type', 'confidence']
    },
    data_sources: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of data sources used in analysis'
    },
    cached: { 
      type: 'boolean',
      description: 'Whether data was served from cache'
    },
    timestamp: { 
      type: 'string', 
      format: 'date-time',
      description: 'Analysis timestamp in ISO 8601 format'
    }
  },
  required: [
    'location',
    'business_type',
    'poi_density_score',
    'pedestrian_infrastructure_score',
    'review_velocity_score',
    'population_density_score',
    'composite_score',
    'competitor_saturation',
    'inferred_peak_hours',
    'data_sources',
    'cached',
    'timestamp'
  ]
};

// 2. compare_sites Output Schema
export const COMPARE_SITES_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    sites: {
      type: 'array',
      items: {
        // Same structure as GET_SITE_INTELLIGENCE_OUTPUT_SCHEMA
        type: 'object',
        properties: {
          location: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              coordinates: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' }
                }
              }
            }
          },
          business_type: { type: 'string' },
          poi_density_score: { type: 'number', minimum: 0, maximum: 100 },
          pedestrian_infrastructure_score: { type: 'number', minimum: 0, maximum: 100 },
          review_velocity_score: { type: 'number', minimum: 0, maximum: 100 },
          population_density_score: { type: 'number', minimum: 0, maximum: 100 },
          composite_score: { type: 'number', minimum: 0, maximum: 100 },
          competitor_saturation: {
            type: 'object',
            properties: {
              count_250m: { type: 'number' },
              count_500m: { type: 'number' },
              count_1km: { type: 'number' },
              saturation_level: { type: 'string', enum: ['low', 'moderate', 'high', 'saturated'] },
              competitors: { type: 'array', items: { type: 'object' } }
            }
          },
          inferred_peak_hours: {
            type: 'object',
            properties: {
              pattern_type: { type: 'string', enum: ['residential', 'commercial', 'entertainment', 'mixed'] },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
            }
          },
          data_sources: { type: 'array', items: { type: 'string' } },
          cached: { type: 'boolean' },
          timestamp: { type: 'string' }
        }
      },
      description: 'Array of site intelligence objects, sorted by composite score'
    },
    recommendation: {
      type: 'object',
      properties: {
        recommended_site: { 
          type: 'string',
          description: 'Name of the recommended location'
        },
        reasoning: { 
          type: 'string',
          description: 'AI-generated reasoning for the recommendation'
        },
        risk_factors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Identified risk factors for the recommended site'
        },
        suggested_action: { 
          type: 'string',
          description: 'Next steps recommendation for decision-makers'
        }
      },
      required: ['recommended_site', 'reasoning', 'risk_factors', 'suggested_action']
    },
    comparison_matrix: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric: { 
            type: 'string',
            description: 'Name of the comparison metric'
          },
          sites: {
            type: 'object',
            additionalProperties: true,
            description: 'Metric values keyed by site name'
          }
        },
        required: ['metric', 'sites']
      },
      description: 'Side-by-side comparison matrix for all metrics'
    }
  },
  required: ['sites', 'recommendation', 'comparison_matrix']
};

// 3. get_area_signals Output Schema
export const GET_AREA_SIGNALS_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    location: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        coordinates: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' }
          },
          required: ['latitude', 'longitude']
        }
      },
      required: ['name', 'coordinates']
    },
    area_profile: {
      type: 'object',
      properties: {
        poi_density_score: { 
          type: 'number', 
          minimum: 0, 
          maximum: 100,
          description: 'Point-of-interest density score'
        },
        pedestrian_score: { 
          type: 'number', 
          minimum: 0, 
          maximum: 100,
          description: 'Pedestrian infrastructure score'
        },
        population_score: { 
          type: 'number', 
          minimum: 0, 
          maximum: 100,
          description: 'Population density score'
        },
        commercial_activity: { 
          type: 'string', 
          enum: ['low', 'moderate', 'high', 'very_high'],
          description: 'Overall commercial activity level'
        }
      },
      required: ['poi_density_score', 'pedestrian_score', 'population_score', 'commercial_activity']
    },
    dominant_categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { 
            type: 'string',
            description: 'Business category name'
          },
          count: { 
            type: 'number',
            description: 'Number of POIs in this category'
          },
          percentage: { 
            type: 'number',
            minimum: 0,
            maximum: 100,
            description: 'Percentage of total POIs'
          }
        },
        required: ['category', 'count', 'percentage']
      },
      description: 'Top business categories in the area'
    },
    foot_traffic_potential: { 
      type: 'string', 
      enum: ['low', 'moderate', 'high', 'very_high'],
      description: 'Overall foot traffic potential assessment'
    },
    recommended_business_types: {
      type: 'array',
      items: { type: 'string' },
      description: 'Business types recommended for this area'
    }
  },
  required: [
    'location',
    'area_profile',
    'dominant_categories',
    'foot_traffic_potential',
    'recommended_business_types'
  ]
};

// 4. get_competitor_density Output Schema
export const GET_COMPETITOR_DENSITY_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    count_250m: { 
      type: 'number',
      description: 'Number of competitors within 250 meters'
    },
    count_500m: { 
      type: 'number',
      description: 'Number of competitors within 500 meters'
    },
    count_1km: { 
      type: 'number',
      description: 'Number of competitors within 1 kilometer'
    },
    saturation_level: { 
      type: 'string', 
      enum: ['low', 'moderate', 'high', 'saturated'],
      description: 'Market saturation level based on 500m radius'
    },
    competitors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            description: 'Competitor business name'
          },
          distance_meters: { 
            type: 'number',
            description: 'Distance from query location in meters'
          },
          type: { 
            type: 'string',
            description: 'Business type/category'
          }
        },
        required: ['name', 'distance_meters', 'type']
      },
      description: 'List of competitors sorted by distance'
    }
  },
  required: ['count_250m', 'count_500m', 'count_1km', 'saturation_level', 'competitors']
};


// Main MCP server entry point

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import {
  GetSiteIntelligenceInputSchema,
  CompareSitesInputSchema,
  GetAreaSignalsInputSchema,
  GetCompetitorDensityInputSchema,
  getSiteIntelligence,
  compareSites,
  getAreaSignals,
  getCompetitorDensity,
  GetSiteIntelligenceInput,
  CompareSitesInput,
  GetAreaSignalsInput,
  GetCompetitorDensityInput
} from './tools/foot-traffic-tools.js';






// Create MCP server instance
const server = new McpServer({
  name: 'foot-traffic-mcp-server',
  version: '1.0.0'
});

// Register tool: get_site_intelligence
server.registerTool(
  'get_site_intelligence',
  {
    title: 'Get Site Intelligence',
    description: `Analyze a single location for site selection intelligence using open data signals.

Returns comprehensive foot traffic proxy signals including POI density, pedestrian infrastructure, 
review velocity, population density, competitor saturation, and inferred peak hours. This is the 
core tool for evaluating a single candidate location before lease decisions.

Args:
  - location (string): Location name or address (e.g., "Lekki Phase 1, Lagos" or "Yaba, Lagos")
  - business_type (string): Type of business (e.g., "restaurant", "cafe", "retail", "gym")
  - radius_meters (number): Analysis radius in meters, 100-2000 (default: 500)
  - response_format ('json' | 'markdown'): Output format (default: 'json')

Returns:
  Structured site intelligence object with schema:
  {
    "location": {
      "name": string,
      "coordinates": { "latitude": number, "longitude": number }
    },
    "business_type": string,
    "poi_density_score": number,              // 0-100 score
    "pedestrian_infrastructure_score": number, // 0-100 score
    "review_velocity_score": number,           // 0-100 score
    "population_density_score": number,        // 0-100 score
    "composite_score": number,                 // 0-100 weighted average
    "competitor_saturation": {
      "count_250m": number,
      "count_500m": number,
      "count_1km": number,
      "saturation_level": "low" | "moderate" | "high" | "saturated",
      "competitors": [{ "name": string, "distance_meters": number, "type": string }]
    },
    "inferred_peak_hours": {
      "morning": string,          // e.g., "8am-10am"
      "midday": string,           // e.g., "12pm-2pm"
      "evening": string,          // e.g., "6pm-9pm"
      "pattern_type": "residential" | "commercial" | "entertainment" | "mixed",
      "confidence": "high" | "medium" | "low"
    },
    "data_sources": string[],
    "cached": boolean,
    "timestamp": string
  }

Examples:
  - Use when: "Evaluate this location for a coffee shop" -> params with location and business_type="cafe"
  - Use when: "Is Yaba good for a restaurant?" -> params with location="Yaba, Lagos" and business_type="restaurant"
  - Don't use when: Comparing multiple locations (use compare_sites instead)

Data Sources:
  - OpenStreetMap: POI density, pedestrian infrastructure, amenity composition
  - GeoNames: Population density data
  - Public transit feeds: Peak hour inference
  - All data from official APIs within free tier limits, no mobile device tracking`,
    inputSchema: GetSiteIntelligenceInputSchema,
    
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetSiteIntelligenceInput) => {
    return await getSiteIntelligence(params);
  }
);

// Register tool: compare_sites
server.registerTool(
  'compare_sites',
  {
    title: 'Compare Multiple Sites',
    description: `Compare 2-5 locations side-by-side for site selection decisions with AI-generated recommendation.

Fetches complete site intelligence for each location and generates a ranked comparison with 
actionable recommendation, reasoning, risk factors, and suggested next steps. This is the primary 
tool for lease decision support when evaluating multiple candidate locations.

Args:
  - locations (string[]): Array of 2-5 location names/addresses to compare
  - business_type (string): Type of business for comparison context
  - radius_meters (number): Analysis radius in meters, 100-2000 (default: 500)
  - response_format ('json' | 'markdown'): Output format (default: 'json')

Returns:
  Site comparison object with schema:
  {
    "sites": [
      // Array of SiteIntelligence objects (see get_site_intelligence for schema)
      // Sorted by composite_score descending
    ],
    "recommendation": {
      "recommended_site": string,           // Name of top-ranked location
      "reasoning": string,                  // Why this site wins
      "risk_factors": string[],             // Identified risks
      "suggested_action": string            // Next steps recommendation
    },
    "comparison_matrix": [
      {
        "metric": string,                   // e.g., "Composite Score"
        "sites": { [siteName]: number }     // Score per site
      }
      // Metrics: Composite Score, POI Density, Pedestrian Infrastructure, 
      //          Population Density, Competitor Saturation
    ]
  }

Examples:
  - Use when: "Compare Lekki Phase 1 vs Yaba for a restaurant" 
    -> params with locations=["Lekki Phase 1, Lagos", "Yaba, Lagos"], business_type="restaurant"
  - Use when: "Which location is better: A, B, or C?" 
    -> params with 3 locations in array
  - Don't use when: Only analyzing one location (use get_site_intelligence instead)

Output includes:
  - Full signal breakdown for each site
  - Side-by-side comparison matrix
  - AI-generated recommendation with reasoning
  - Risk factor identification
  - Suggested action for decision-makers`,
    inputSchema: CompareSitesInputSchema,

    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: CompareSitesInput) => {
    return await compareSites(params);
  }
);

// Register tool: get_area_signals
server.registerTool(
  'get_area_signals',
  {
    title: 'Get Area Foot Traffic Signals',
    description: `Get general foot traffic signal profile for a neighborhood or district for market scoping.

Analyzes a broader area to understand overall commercial activity, dominant business categories, 
and foot traffic potential. Use this for initial market research before narrowing down to specific 
site comparisons. Returns area-level signals without competitor-specific analysis.

Args:
  - location (string): Neighborhood or district name
  - radius_meters (number): Analysis radius in meters, 500-2000 (default: 1000)
  - response_format ('json' | 'markdown'): Output format (default: 'json')

Returns:
  Area signals object with schema:
  {
    "location": {
      "name": string,
      "coordinates": { "latitude": number, "longitude": number }
    },
    "area_profile": {
      "poi_density_score": number,                    // 0-100 score
      "pedestrian_score": number,                     // 0-100 score
      "population_score": number,                     // 0-100 score
      "commercial_activity": "low" | "moderate" | "high" | "very_high"
    },
    "dominant_categories": [
      {
        "category": string,        // e.g., "restaurant", "shop", "office"
        "count": number,
        "percentage": number       // Percentage of total POIs
      }
    ],
    "foot_traffic_potential": "low" | "moderate" | "high" | "very_high",
    "recommended_business_types": string[]
  }

Examples:
  - Use when: "What's the commercial activity like in Victoria Island?"
  - Use when: "Should I consider opening in this neighborhood?"
  - Use when: Need to scope multiple districts before detailed site analysis
  - Don't use when: Ready for specific site evaluation (use get_site_intelligence instead)

Use Case:
  Start with this tool to identify promising neighborhoods, then use get_site_intelligence 
  or compare_sites for specific locations within those neighborhoods.`,
    inputSchema: GetAreaSignalsInputSchema,
   
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetAreaSignalsInput) => {
    return await getAreaSignals(params);
  }
);

// Register tool: get_competitor_density
server.registerTool(
  'get_competitor_density',
  {
    title: 'Get Competitor Density',
    description: `Analyze competitor density and distribution around a specific location by business type.

Returns detailed competitor count at three radius bands (250m, 500m, 1km) with saturation level 
assessment and list of closest competitors. Use this when competitor analysis is the primary 
concern rather than full site intelligence.

Args:
  - location (string): Location name or address
  - business_type (string): Type of business to search for competitors
  - response_format ('json' | 'markdown'): Output format (default: 'json')

Returns:
  Competitor density object with schema:
  {
    "count_250m": number,                    // Competitors within 250 meters
    "count_500m": number,                    // Competitors within 500 meters
    "count_1km": number,                     // Competitors within 1 kilometer
    "saturation_level": "low" | "moderate" | "high" | "saturated",
    "competitors": [
      {
        "name": string,
        "distance_meters": number,
        "type": string                       // Amenity/shop type
      }
    ]
  }

Saturation Levels:
  - low: ≤3 competitors within 500m
  - moderate: 4-8 competitors within 500m
  - high: 9-15 competitors within 500m
  - saturated: 16+ competitors within 500m

Examples:
  - Use when: "How many coffee shops are near this location?"
  - Use when: "Is this area saturated with restaurants?"
  - Use when: Need just competitor analysis without full site intelligence
  - Don't use when: Need comprehensive site evaluation (use get_site_intelligence instead)`,
    inputSchema: GetCompetitorDensityInputSchema,
  
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetCompetitorDensityInput) => {
    return await getCompetitorDensity(params);
  }
);

// Run server with stdio transport
async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Foot Traffic MCP Server running on stdio');
}

// Run server with HTTP transport
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

const port = parseInt(process.env.PORT || '3000');

app.listen(port, '0.0.0.0', () => {
  console.log(`Foot Traffic MCP Server running on port ${port}`);
});
}


// Main execution
const transport = process.env.TRANSPORT || 'stdio';
const mode = process.argv[2];

if (mode === '--help' || mode === '-h') {
  console.log(`
Foot Traffic MCP Server
=======================

An MCP server that provides site selection intelligence using open data sources.
Replaces expensive foot traffic analytics subscriptions with free, transparent signals.

Usage:
  npm start                  # Run with stdio transport (default)
  TRANSPORT=http npm start   # Run with HTTP transport on port 3000
  npm test                   # Test the build

Environment Variables:
  TRANSPORT              # Transport mode: 'stdio' or 'http' (default: stdio)
  PORT                   # HTTP port when using http transport (default: 3000)
  GEONAMES_USERNAME      # GeoNames API username (default: 'demo')
  GOOGLE_PLACES_API_KEY  # Optional Google Places API key for review data

Tools Available:
  1. get_site_intelligence   - Analyze a single location comprehensively
  2. compare_sites           - Compare 2-5 locations with AI recommendation
  3. get_area_signals        - Get neighborhood-level foot traffic signals
  4. get_competitor_density  - Analyze competitor saturation by business type

Data Sources:
  - OpenStreetMap (POI density, pedestrian infrastructure)
  - GeoNames (population density)
  - Public transit feeds (peak hour inference)
  - All data from official, free-tier APIs

For more information: https://github.com/modelcontextprotocol
`);
  process.exit(0);
}

if (transport === 'http') {
  runHTTP().catch(error => {
    console.error('Server error:', error);
    process.exit(1);
  });
} else {
  runStdio().catch(error => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
