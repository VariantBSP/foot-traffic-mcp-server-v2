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

// ── Imports ─────────────────────────────────────────────────────────────────

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express, { type Request, type Response } from 'express';
import {
  GetSiteIntelligenceInputSchema,
  CompareSitesInputSchema,
  GetAreaSignalsInputSchema,
  GetCompetitorDensityInputSchema,
  getSiteIntelligence,
  compareSites,
  getAreaSignals,
  getCompetitorDensity,
  type GetSiteIntelligenceInput,
  type CompareSitesInput,
  type GetAreaSignalsInput,
  type GetCompetitorDensityInput
} from './tools/foot-traffic-tools.js';

// ── Logger ───────────────────────────────────────────────────────────────────

const log = {
  info:  (msg: string, meta?: object) => console.log( `[INFO]  ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn:  (msg: string, meta?: object) => console.warn( `[WARN]  ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string, meta?: object) => console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta) : ''),
};

// ── Tool manifest (for tools/list) ───────────────────────────────────────────

const TOOLS = [
  {
    name: 'get_site_intelligence',
    description: `Analyze a single location for site selection intelligence using open data signals.

Returns comprehensive foot traffic proxy signals including POI density, pedestrian infrastructure,
review velocity, population density, competitor saturation, and inferred peak hours. This is the
core tool for evaluating a single candidate location before lease decisions.`,
    inputSchema: GetSiteIntelligenceInputSchema,
  },
  {
    name: 'compare_sites',
    description: `Compare 2-5 locations side-by-side for site selection decisions with AI-generated recommendation.

Fetches complete site intelligence for each location and generates a ranked comparison with
actionable recommendation, reasoning, risk factors, and suggested next steps.`,
    inputSchema: CompareSitesInputSchema,
  },
  {
    name: 'get_area_signals',
    description: `Get general foot traffic signal profile for a neighborhood or district for market scoping.

Analyzes a broader area to understand overall commercial activity, dominant business categories,
and foot traffic potential. Use this for initial market research before narrowing down to specific
site comparisons.`,
    inputSchema: GetAreaSignalsInputSchema,
  },
  {
    name: 'get_competitor_density',
    description: `Analyze competitor density and distribution around a specific location by business type.

Returns detailed competitor count at three radius bands (250m, 500m, 1km) with saturation level
assessment and list of closest competitors.`,
    inputSchema: GetCompetitorDensityInputSchema,
  },
];

// ── Tool dispatcher ──────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_site_intelligence':
      return await getSiteIntelligence(args as GetSiteIntelligenceInput);
    case 'compare_sites':
      return await compareSites(args as CompareSitesInput);
    case 'get_area_signals':
      return await getAreaSignals(args as GetAreaSignalsInput);
    case 'get_competitor_density':
      return await getCompetitorDensity(args as GetCompetitorDensityInput);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── stdio mode ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'foot-traffic-mcp-server',
  version: '1.0.0'
});

// Register tool: get_site_intelligence
server.registerTool(
  'get_site_intelligence',
  {
    title: 'Get Site Intelligence',
    description: TOOLS[0].description,
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
    description: TOOLS[1].description,
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
    description: TOOLS[2].description,
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
    description: TOOLS[3].description,
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

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info('transport/stdio started');
}

// ── HTTP mode (Railway-compatible, stateless JSON-RPC) ───────────────────────

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Request logger
  app.use((req, _res, next) => {
    log.info('request', { method: req.method, path: req.path, mcp_method: req.body?.method });
    next();
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    const { method, id, params } = req.body ?? {};

    if (method === 'initialize') {
      log.info('initialize');
      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'foot-traffic-mcp-server', version: '1.0.0' },
          capabilities: { tools: { listChanged: false } },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      log.info('notifications/initialized');
      res.status(204).end();
      return;
    }

    if (method === 'notifications/cancelled') {
      log.warn('tool/cancelled', { id });
      res.json({ jsonrpc: '2.0', id, result: {} });
      return;
    }

    if (method === 'tools/list') {
      log.info('tools/list');
      res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params ?? {};
      const t0 = Date.now();
      log.info('tool/call', { name, location: args.location, business_type: args.business_type });

      try {
        const result = await callTool(name, args);
        log.info('tool/ok', { name, ms: Date.now() - t0 });
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error('tool/err', { name, ms: Date.now() - t0, message });
        res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${message}` }],
            isError: true,
          },
        });
      }
      return;
    }

    log.warn('unknown_method', { method });
    res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found' },
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'foot-traffic-mcp', version: '1.0.0' });
  });

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, '0.0.0.0', () => {
    log.info('listening', { port, transport: 'http' });
  });
}

// ── Entry point ──────────────────────────────────────────────────────────────

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

const transport = process.env.TRANSPORT || 'stdio';

if (transport === 'http') {
  runHTTP().catch(err => {
    log.error('server/fatal', { message: String(err) });
    process.exit(1);
  });
} else {
  runStdio().catch(err => {
    log.error('server/fatal', { message: String(err) });
    process.exit(1);
  });
}