#!/usr/bin/env node

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

// src/tools/foot-traffic-tools.ts
import { z } from "zod";

// src/services/cache.ts
var CacheService = class {
  cache = /* @__PURE__ */ new Map();
  set(key, data, ttlMs) {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlMs
    });
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  delete(key) {
    this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
  }
  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
  // Generate cache key from parameters
  static generateKey(prefix, params) {
    const sortedParams = Object.keys(params).sort().map((key) => `${key}=${JSON.stringify(params[key])}`).join("&");
    return `${prefix}:${sortedParams}`;
  }
};
var cache = new CacheService();

// src/services/api-client.ts
import fetch from "node-fetch";

// src/constants.ts
var OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
var NOMINATIM_API_URL = "https://nominatim.openstreetmap.org/search";
var GEONAMES_API_URL = "http://api.geonames.org/searchJSON";
var CACHE_TTL = {
  POI_DATA: 7 * 24 * 60 * 60 * 1e3,
  // 7 days
  PEDESTRIAN_DATA: 7 * 24 * 60 * 60 * 1e3,
  // 7 days
  REVIEW_DATA: 48 * 60 * 60 * 1e3,
  // 48 hours
  POPULATION_DATA: 30 * 24 * 60 * 60 * 1e3,
  // 30 days
  TRANSIT_DATA: 14 * 24 * 60 * 60 * 1e3,
  // 14 days
  GEOCODING: 30 * 24 * 60 * 60 * 1e3
  // 30 days
};
var DEFAULT_RADIUS_METERS = 500;
var SCORE_WEIGHTS = {
  POI_DENSITY: 0.25,
  PEDESTRIAN_INFRASTRUCTURE: 0.25,
  REVIEW_VELOCITY: 0.3,
  POPULATION_DENSITY: 0.2
};
var REQUEST_DELAYS = {
  OVERPASS: 1e3,
  // 1 second between requests
  NOMINATIM: 1e3,
  // 1 second per Nominatim policy
  GOOGLE_PLACES: 100
  // 100ms between requests
};
var GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || "demo";
var GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
var BUSINESS_TYPE_MAPPINGS = {
  "restaurant": ["restaurant", "fast_food", "cafe", "food_court"],
  "cafe": ["cafe", "coffee"],
  "retail": ["shop", "mall", "marketplace"],
  "gym": ["gym", "fitness_centre", "sports_centre"],
  "hotel": ["hotel", "hostel", "guest_house"],
  "office": ["office", "coworking_space"],
  "bar": ["bar", "pub", "nightclub"],
  "pharmacy": ["pharmacy", "chemist"],
  "grocery": ["supermarket", "convenience", "greengrocer"]
};

// src/services/api-client.ts
var lastRequestTime = {};
async function rateLimitedFetch(service, url, options) {
  const delay = REQUEST_DELAYS[service] || 1e3;
  const now = Date.now();
  const lastRequest = lastRequestTime[service] || 0;
  const timeSinceLastRequest = now - lastRequest;
  if (timeSinceLastRequest < delay) {
    await new Promise((resolve) => setTimeout(resolve, delay - timeSinceLastRequest));
  }
  lastRequestTime[service] = Date.now();
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${service}`);
  }
  return response.json();
}
async function geocodeLocation(locationName) {
  const url = `${NOMINATIM_API_URL}?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
  const results = await rateLimitedFetch("NOMINATIM", url, {
    headers: {
      "User-Agent": "FootTrafficMCPServer/1.0"
    }
  });
  if (!results || results.length === 0) {
    throw new Error(`Location not found: ${locationName}`);
  }
  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon)
  };
}
async function queryOverpass(query) {
  const url = OVERPASS_API_URL;
  const response = await rateLimitedFetch("OVERPASS", url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `data=${encodeURIComponent(query)}`
  });
  return response;
}
function buildPOIQuery(lat, lon, radiusMeters) {
  return `
    [out:json][timeout:25];
    (
      node["amenity"](around:${radiusMeters},${lat},${lon});
      node["shop"](around:${radiusMeters},${lat},${lon});
      node["tourism"](around:${radiusMeters},${lat},${lon});
      node["leisure"](around:${radiusMeters},${lat},${lon});
    );
    out body;
  `;
}
function buildPedestrianQuery(lat, lon, radiusMeters) {
  return `
    [out:json][timeout:25];
    (
      way["highway"="footway"](around:${radiusMeters},${lat},${lon});
      way["highway"="pedestrian"](around:${radiusMeters},${lat},${lon});
      way["highway"="path"](around:${radiusMeters},${lat},${lon});
      node["highway"="crossing"](around:${radiusMeters},${lat},${lon});
      node["public_transport"="stop_position"](around:${radiusMeters},${lat},${lon});
      node["highway"="bus_stop"](around:${radiusMeters},${lat},${lon});
    );
    out body;
  `;
}
function buildCompetitorQuery(lat, lon, radiusMeters, amenityTypes) {
  const conditions = amenityTypes.map((type) => {
    if (type.startsWith("shop")) {
      return `node["shop"](around:${radiusMeters},${lat},${lon});`;
    }
    return `node["amenity"="${type}"](around:${radiusMeters},${lat},${lon});`;
  }).join("\n      ");
  return `
    [out:json][timeout:25];
    (
      ${conditions}
    );
    out body;
  `;
}
async function getPopulationData(lat, lon) {
  const url = `${GEONAMES_API_URL}?lat=${lat}&lng=${lon}&radius=20&maxRows=1&username=${GEONAMES_USERNAME}`;
  try {
    const data = await rateLimitedFetch("GEONAMES", url);
    if (data.geonames && data.geonames.length > 0) {
      return data.geonames[0].population;
    }
    return 0;
  } catch (error) {
    console.error("GeoNames API error:", error);
    return 0;
  }
}
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const \u03C61 = lat1 * Math.PI / 180;
  const \u03C62 = lat2 * Math.PI / 180;
  const \u0394\u03C6 = (lat2 - lat1) * Math.PI / 180;
  const \u0394\u03BB = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(\u0394\u03C6 / 2) * Math.sin(\u0394\u03C6 / 2) + Math.cos(\u03C61) * Math.cos(\u03C62) * Math.sin(\u0394\u03BB / 2) * Math.sin(\u0394\u03BB / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// src/services/signal-processor.ts
function processPOIData(elements) {
  const categories = {};
  elements.forEach((element) => {
    if (element.tags) {
      const amenity = element.tags.amenity || element.tags.shop || element.tags.tourism || element.tags.leisure;
      if (amenity) {
        categories[amenity] = (categories[amenity] || 0) + 1;
      }
    }
  });
  const count = elements.length;
  let density_score;
  if (count <= 50) {
    density_score = count;
  } else if (count <= 200) {
    density_score = 50 + (count - 50) / 150 * 30;
  } else {
    density_score = Math.min(100, 80 + (count - 200) / 100 * 20);
  }
  return {
    count,
    density_score: Math.round(density_score),
    categories
  };
}
function processPedestrianData(elements) {
  let footway_length_meters = 0;
  let crosswalk_count = 0;
  let transit_stop_count = 0;
  elements.forEach((element) => {
    if (element.tags) {
      const highway = element.tags.highway;
      const publicTransport = element.tags.public_transport;
      if (highway === "footway" || highway === "pedestrian" || highway === "path") {
        footway_length_meters += 50;
      } else if (highway === "crossing") {
        crosswalk_count++;
      } else if (highway === "bus_stop" || publicTransport === "stop_position") {
        transit_stop_count++;
      }
    }
  });
  const footwayScore = Math.min(40, footway_length_meters / 50);
  const crosswalkScore = Math.min(30, crosswalk_count * 3);
  const transitScore = Math.min(30, transit_stop_count * 6);
  const infrastructure_score = Math.round(footwayScore + crosswalkScore + transitScore);
  return {
    footway_length_meters,
    crosswalk_count,
    transit_stop_count,
    infrastructure_score
  };
}
function processPopulationData(population) {
  let density_score;
  if (population <= 1e4) {
    density_score = population / 1e4 * 30;
  } else if (population <= 1e5) {
    density_score = 30 + (population - 1e4) / 9e4 * 40;
  } else {
    density_score = Math.min(100, 70 + (population - 1e5) / 2e5 * 30);
  }
  return {
    population,
    density_score: Math.round(density_score),
    source: "GeoNames"
  };
}
function processCompetitorData(elements, centerLat, centerLon) {
  const competitors = elements.filter((el) => el.lat && el.lon).map((el) => {
    const lat = el.lat || (el.center?.lat ?? 0);
    const lon = el.lon || (el.center?.lon ?? 0);
    const distance = calculateDistance(centerLat, centerLon, lat, lon);
    return {
      name: el.tags?.name || "Unnamed",
      distance_meters: Math.round(distance),
      type: el.tags?.amenity || el.tags?.shop || "unknown"
    };
  }).sort((a, b) => a.distance_meters - b.distance_meters);
  const count_250m = competitors.filter((c) => c.distance_meters <= 250).length;
  const count_500m = competitors.filter((c) => c.distance_meters <= 500).length;
  const count_1km = competitors.filter((c) => c.distance_meters <= 1e3).length;
  let saturation_level;
  if (count_500m <= 3) saturation_level = "low";
  else if (count_500m <= 8) saturation_level = "moderate";
  else if (count_500m <= 15) saturation_level = "high";
  else saturation_level = "saturated";
  return {
    count_250m,
    count_500m,
    count_1km,
    saturation_level,
    competitors: competitors.slice(0, 10)
  };
}
function inferPeakHours(categories) {
  const total = Object.values(categories).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return {
      pattern_type: "mixed",
      confidence: "low"
    };
  }
  const officeRelated = (categories.office || 0) + (categories.coworking_space || 0);
  const foodRelated = (categories.restaurant || 0) + (categories.cafe || 0) + (categories.fast_food || 0);
  const entertainmentRelated = (categories.bar || 0) + (categories.pub || 0) + (categories.nightclub || 0);
  const residentialRelated = categories.residential || 0;
  const officePercent = officeRelated / total * 100;
  const foodPercent = foodRelated / total * 100;
  const entertainmentPercent = entertainmentRelated / total * 100;
  if (officePercent > 30 || officePercent > 20 && foodPercent > 20) {
    return {
      morning: "8am-10am",
      midday: "12pm-2pm",
      pattern_type: "commercial",
      confidence: officePercent > 30 ? "high" : "medium"
    };
  } else if (entertainmentPercent > 25) {
    return {
      evening: "6pm-11pm",
      pattern_type: "entertainment",
      confidence: entertainmentPercent > 35 ? "high" : "medium"
    };
  } else if (residentialRelated > total * 0.4) {
    return {
      morning: "7am-9am",
      evening: "5pm-8pm",
      pattern_type: "residential",
      confidence: "medium"
    };
  } else {
    return {
      morning: "8am-10am",
      midday: "12pm-2pm",
      evening: "6pm-9pm",
      pattern_type: "mixed",
      confidence: "medium"
    };
  }
}
function calculateCompositeScore(poiScore, pedestrianScore, reviewScore, populationScore) {
  const composite = poiScore * SCORE_WEIGHTS.POI_DENSITY + pedestrianScore * SCORE_WEIGHTS.PEDESTRIAN_INFRASTRUCTURE + reviewScore * SCORE_WEIGHTS.REVIEW_VELOCITY + populationScore * SCORE_WEIGHTS.POPULATION_DENSITY;
  return Math.round(composite);
}
function getBusinessTypeTags(businessType) {
  const normalized = businessType.toLowerCase();
  return BUSINESS_TYPE_MAPPINGS[normalized] || ["restaurant", "cafe", "fast_food"];
}

// src/types.ts
var ResponseFormat = /* @__PURE__ */ ((ResponseFormat2) => {
  ResponseFormat2["JSON"] = "json";
  ResponseFormat2["MARKDOWN"] = "markdown";
  return ResponseFormat2;
})(ResponseFormat || {});

// src/tools/foot-traffic-tools.ts
var GetSiteIntelligenceInputSchema = z.object({
  location: z.string().min(2, "Location must be at least 2 characters").describe('Location name or address (e.g., "Lekki Phase 1, Lagos" or "Yaba, Lagos")'),
  business_type: z.string().min(2, "Business type must be at least 2 characters").describe('Type of business (e.g., "restaurant", "cafe", "retail", "gym")'),
  radius_meters: z.number().int().min(100).max(2e3).default(DEFAULT_RADIUS_METERS).describe("Analysis radius in meters (default: 500)"),
  response_format: z.nativeEnum(ResponseFormat).default("json" /* JSON */).describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();
var CompareSitesInputSchema = z.object({
  locations: z.array(z.string().min(2)).min(2, "Must provide at least 2 locations to compare").max(5, "Can compare maximum 5 locations at once").describe("Array of location names or addresses to compare"),
  business_type: z.string().min(2, "Business type must be at least 2 characters").describe("Type of business for comparison context"),
  radius_meters: z.number().int().min(100).max(2e3).default(DEFAULT_RADIUS_METERS).describe("Analysis radius in meters (default: 500)"),
  response_format: z.nativeEnum(ResponseFormat).default("json" /* JSON */).describe('Output format: "json" or "markdown"')
}).strict();
var GetAreaSignalsInputSchema = z.object({
  location: z.string().min(2, "Location must be at least 2 characters").describe("Neighborhood or district name"),
  radius_meters: z.number().int().min(500).max(2e3).default(1e3).describe("Analysis radius in meters (default: 1000)"),
  response_format: z.nativeEnum(ResponseFormat).default("json" /* JSON */).describe('Output format: "json" or "markdown"')
}).strict();
var GetCompetitorDensityInputSchema = z.object({
  location: z.string().min(2, "Location must be at least 2 characters").describe("Location name or address"),
  business_type: z.string().min(2, "Business type must be at least 2 characters").describe("Type of business to search for competitors"),
  response_format: z.nativeEnum(ResponseFormat).default("json" /* JSON */).describe('Output format: "json" or "markdown"')
}).strict();
async function fetchSiteIntelligence(location, businessType, radiusMeters) {
  const cacheKey = `site:${location}:${businessType}:${radiusMeters}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }
  const coordinates = await geocodeLocation(location);
  const [poiData, pedestrianData, populationRaw, competitorElements] = await Promise.all([
    queryOverpass(buildPOIQuery(coordinates.latitude, coordinates.longitude, radiusMeters)),
    queryOverpass(buildPedestrianQuery(coordinates.latitude, coordinates.longitude, radiusMeters)),
    getPopulationData(coordinates.latitude, coordinates.longitude),
    queryOverpass(
      buildCompetitorQuery(
        coordinates.latitude,
        coordinates.longitude,
        1e3,
        getBusinessTypeTags(businessType)
      )
    )
  ]);
  const poiProcessed = processPOIData(poiData.elements);
  const pedestrianProcessed = processPedestrianData(pedestrianData.elements);
  const populationProcessed = processPopulationData(populationRaw);
  const competitorProcessed = processCompetitorData(
    competitorElements.elements,
    coordinates.latitude,
    coordinates.longitude
  );
  const reviewVelocityScore = 50;
  const peakHours = inferPeakHours(poiProcessed.categories);
  const compositeScore = calculateCompositeScore(
    poiProcessed.density_score,
    pedestrianProcessed.infrastructure_score,
    reviewVelocityScore,
    populationProcessed.density_score
  );
  const intelligence = {
    location: {
      name: location,
      coordinates
    },
    business_type: businessType,
    poi_density_score: poiProcessed.density_score,
    pedestrian_infrastructure_score: pedestrianProcessed.infrastructure_score,
    review_velocity_score: reviewVelocityScore,
    population_density_score: populationProcessed.density_score,
    composite_score: compositeScore,
    competitor_saturation: competitorProcessed,
    inferred_peak_hours: peakHours,
    data_sources: [
      "OpenStreetMap (POI & Infrastructure)",
      "GeoNames (Population)",
      "OSM Overpass API"
    ],
    cached: false,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  cache.set(cacheKey, intelligence, CACHE_TTL.POI_DATA);
  return intelligence;
}
async function getSiteIntelligence(params) {
  try {
    const intelligence = await fetchSiteIntelligence(
      params.location,
      params.business_type,
      params.radius_meters
    );
    if (params.response_format === "markdown" /* MARKDOWN */) {
      const markdown = formatSiteIntelligenceMarkdown(intelligence);
      return {
        content: [{ type: "text", text: markdown }]
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(intelligence, null, 2) }],
      structuredContent: intelligence
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [{
        type: "text",
        text: `Error fetching site intelligence: ${errorMessage}

Please check that the location name is valid and try again.`
      }]
    };
  }
}
async function compareSites(params) {
  try {
    const sites = [];
    for (let i = 0; i < params.locations.length; i++) {
      const location = params.locations[i];
      const intelligence = await fetchSiteIntelligence(
        location,
        params.business_type,
        params.radius_meters
      );
      sites.push(intelligence);
      if (i < params.locations.length - 1 && !intelligence.cached) {
        await new Promise((resolve) => setTimeout(resolve, 2e3));
      }
    }
    const sortedSites = sites.sort((a, b) => b.composite_score - a.composite_score);
    const topSite = sortedSites[0];
    const recommendation = generateRecommendation(sortedSites, params.business_type);
    const comparisonMatrix = [
      {
        metric: "Composite Score",
        sites: Object.fromEntries(sortedSites.map((s) => [s.location.name, s.composite_score]))
      },
      {
        metric: "POI Density Score",
        sites: Object.fromEntries(sortedSites.map((s) => [s.location.name, s.poi_density_score]))
      },
      {
        metric: "Pedestrian Infrastructure",
        sites: Object.fromEntries(sortedSites.map((s) => [s.location.name, s.pedestrian_infrastructure_score]))
      },
      {
        metric: "Population Density",
        sites: Object.fromEntries(sortedSites.map((s) => [s.location.name, s.population_density_score]))
      },
      {
        metric: "Competitor Saturation",
        sites: Object.fromEntries(sortedSites.map((s) => [s.location.name, s.competitor_saturation.saturation_level]))
      }
    ];
    const comparison = {
      sites: sortedSites,
      recommendation,
      comparison_matrix: comparisonMatrix
    };
    if (params.response_format === "markdown" /* MARKDOWN */) {
      const markdown = formatSiteComparisonMarkdown(comparison);
      return {
        content: [{ type: "text", text: markdown }]
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
      structuredContent: comparison
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [{
        type: "text",
        text: `Error comparing sites: ${errorMessage}

Please check that all location names are valid and try again.`
      }]
    };
  }
}
async function getAreaSignals(params) {
  try {
    const coordinates = await geocodeLocation(params.location);
    const poiData = await queryOverpass(
      buildPOIQuery(coordinates.latitude, coordinates.longitude, params.radius_meters)
    );
    const poiProcessed = processPOIData(poiData.elements);
    const sortedCategories = Object.entries(poiProcessed.categories).sort(([, a], [, b]) => b - a).slice(0, 10);
    const dominant_categories = sortedCategories.map(([category, count]) => ({
      category,
      count,
      percentage: Math.round(count / poiProcessed.count * 100)
    }));
    let commercial_activity;
    if (poiProcessed.density_score < 40) commercial_activity = "low";
    else if (poiProcessed.density_score < 65) commercial_activity = "moderate";
    else if (poiProcessed.density_score < 85) commercial_activity = "high";
    else commercial_activity = "very_high";
    let foot_traffic_potential;
    if (poiProcessed.density_score < 35) foot_traffic_potential = "low";
    else if (poiProcessed.density_score < 60) foot_traffic_potential = "moderate";
    else if (poiProcessed.density_score < 80) foot_traffic_potential = "high";
    else foot_traffic_potential = "very_high";
    const areaSignals = {
      location: {
        name: params.location,
        coordinates
      },
      area_profile: {
        poi_density_score: poiProcessed.density_score,
        pedestrian_score: 0,
        // Simplified for area overview
        population_score: 0,
        // Simplified for area overview
        commercial_activity
      },
      dominant_categories,
      foot_traffic_potential,
      recommended_business_types: recommendBusinessTypes(dominant_categories)
    };
    if (params.response_format === "markdown" /* MARKDOWN */) {
      const markdown = formatAreaSignalsMarkdown(areaSignals);
      return {
        content: [{ type: "text", text: markdown }]
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(areaSignals, null, 2) }],
      structuredContent: areaSignals
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [{
        type: "text",
        text: `Error fetching area signals: ${errorMessage}`
      }]
    };
  }
}
async function getCompetitorDensity(params) {
  try {
    const coordinates = await geocodeLocation(params.location);
    const businessTags = getBusinessTypeTags(params.business_type);
    const elements = await queryOverpass(
      buildCompetitorQuery(coordinates.latitude, coordinates.longitude, 1e3, businessTags)
    );
    const competitorData = processCompetitorData(
      elements.elements,
      coordinates.latitude,
      coordinates.longitude
    );
    if (params.response_format === "markdown" /* MARKDOWN */) {
      const markdown = formatCompetitorDensityMarkdown(competitorData, params.location, params.business_type);
      return {
        content: [{ type: "text", text: markdown }]
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(competitorData, null, 2) }],
      structuredContent: competitorData
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [{
        type: "text",
        text: `Error fetching competitor density: ${errorMessage}`
      }]
    };
  }
}
function formatSiteIntelligenceMarkdown(intel) {
  return `# Site Intelligence: ${intel.location.name}

**Business Type:** ${intel.business_type}
**Analysis Date:** ${new Date(intel.timestamp).toLocaleDateString()}
**Data Cached:** ${intel.cached ? "Yes" : "No"}

## Composite Score: ${intel.composite_score}/100

### Signal Breakdown
- **POI Density:** ${intel.poi_density_score}/100
- **Pedestrian Infrastructure:** ${intel.pedestrian_infrastructure_score}/100
- **Review Velocity:** ${intel.review_velocity_score}/100
- **Population Density:** ${intel.population_density_score}/100

### Competitor Analysis
- **Within 250m:** ${intel.competitor_saturation.count_250m} competitors
- **Within 500m:** ${intel.competitor_saturation.count_500m} competitors
- **Within 1km:** ${intel.competitor_saturation.count_1km} competitors
- **Saturation Level:** ${intel.competitor_saturation.saturation_level}

### Peak Hours
- **Pattern Type:** ${intel.inferred_peak_hours.pattern_type}
- **Confidence:** ${intel.inferred_peak_hours.confidence}
${intel.inferred_peak_hours.morning ? `- **Morning Peak:** ${intel.inferred_peak_hours.morning}
` : ""}${intel.inferred_peak_hours.midday ? `- **Midday Peak:** ${intel.inferred_peak_hours.midday}
` : ""}${intel.inferred_peak_hours.evening ? `- **Evening Peak:** ${intel.inferred_peak_hours.evening}
` : ""}

### Data Sources
${intel.data_sources.map((s) => `- ${s}`).join("\n")}
`;
}
function formatSiteComparisonMarkdown(comparison) {
  let markdown = `# Site Comparison Analysis

`;
  markdown += `## Recommendation
`;
  markdown += `**Recommended Site:** ${comparison.recommendation.recommended_site}

`;
  markdown += `**Reasoning:** ${comparison.recommendation.reasoning}

`;
  if (comparison.recommendation.risk_factors.length > 0) {
    markdown += `### Risk Factors
`;
    comparison.recommendation.risk_factors.forEach((risk) => {
      markdown += `- ${risk}
`;
    });
    markdown += `
`;
  }
  markdown += `**Suggested Action:** ${comparison.recommendation.suggested_action}

`;
  markdown += `## Comparison Matrix

`;
  comparison.comparison_matrix.forEach((row) => {
    markdown += `### ${row.metric}
`;
    Object.entries(row.sites).forEach(([site, value]) => {
      markdown += `- **${site}:** ${value}
`;
    });
    markdown += `
`;
  });
  return markdown;
}
function formatAreaSignalsMarkdown(signals) {
  return `# Area Signals: ${signals.location.name}

## Area Profile
- **POI Density Score:** ${signals.area_profile.poi_density_score}/100
- **Commercial Activity:** ${signals.area_profile.commercial_activity}
- **Foot Traffic Potential:** ${signals.foot_traffic_potential}

## Dominant Categories
${signals.dominant_categories.map((cat) => `- **${cat.category}:** ${cat.count} (${cat.percentage}%)`).join("\n")}

## Recommended Business Types
${signals.recommended_business_types.map((type) => `- ${type}`).join("\n")}
`;
}
function formatCompetitorDensityMarkdown(data, location, businessType) {
  return `# Competitor Density Analysis
**Location:** ${location}
**Business Type:** ${businessType}

## Summary
- **Within 250m:** ${data.count_250m} competitors
- **Within 500m:** ${data.count_500m} competitors
- **Within 1km:** ${data.count_1km} competitors
- **Saturation Level:** ${data.saturation_level}

## Top Competitors
${data.competitors.slice(0, 10).map((c) => `- **${c.name}** (${c.distance_meters}m away)`).join("\n")}
`;
}
function generateRecommendation(sites, businessType) {
  const topSite = sites[0];
  const secondSite = sites.length > 1 ? sites[1] : null;
  const riskFactors = [];
  if (topSite.competitor_saturation.saturation_level === "saturated") {
    riskFactors.push("High competitor saturation may limit market share");
  }
  if (topSite.pedestrian_infrastructure_score < 50) {
    riskFactors.push("Below-average pedestrian infrastructure may limit foot traffic");
  }
  if (topSite.composite_score < 60) {
    riskFactors.push("Moderate composite score suggests careful market validation needed");
  }
  let reasoning = `${topSite.location.name} scores highest with a composite score of ${topSite.composite_score}/100. `;
  if (topSite.poi_density_score > 70) {
    reasoning += `Strong POI density (${topSite.poi_density_score}/100) indicates high commercial activity. `;
  }
  if (topSite.pedestrian_infrastructure_score > 70) {
    reasoning += `Excellent pedestrian infrastructure (${topSite.pedestrian_infrastructure_score}/100) supports foot traffic. `;
  }
  if (topSite.competitor_saturation.saturation_level === "low" || topSite.competitor_saturation.saturation_level === "moderate") {
    reasoning += `${topSite.competitor_saturation.saturation_level.charAt(0).toUpperCase() + topSite.competitor_saturation.saturation_level.slice(1)} competitor saturation provides market entry opportunity. `;
  }
  const suggestedAction = topSite.composite_score > 75 ? `Recommended for immediate market entry. Conduct lease negotiations for ${topSite.location.name}.` : topSite.composite_score > 60 ? `Recommended as primary location with additional on-ground validation. Visit site during peak hours identified.` : `Consider as viable option but conduct thorough market research before committing.`;
  return {
    recommended_site: topSite.location.name,
    reasoning: reasoning.trim(),
    risk_factors: riskFactors,
    suggested_action: suggestedAction
  };
}
function recommendBusinessTypes(categories) {
  const recommendations = [];
  const topCategories = categories.slice(0, 5).map((c) => c.category);
  if (topCategories.includes("office")) {
    recommendations.push("Coffee shop", "Quick-service restaurant", "Lunch-focused cafe");
  }
  if (topCategories.includes("restaurant") || topCategories.includes("cafe")) {
    recommendations.push("Complementary cuisine types", "Bar or evening venue");
  }
  if (topCategories.includes("shop") || topCategories.includes("supermarket")) {
    recommendations.push("Service businesses", "Specialty retail");
  }
  if (recommendations.length === 0) {
    recommendations.push("Restaurant", "Cafe", "Retail shop");
  }
  return recommendations;
}

// src/index.ts
var GET_SITE_INTELLIGENCE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    location: {
      type: "object",
      properties: {
        name: { type: "string" },
        coordinates: {
          type: "object",
          properties: {
            latitude: { type: "number" },
            longitude: { type: "number" }
          },
          required: ["latitude", "longitude"]
        },
        administrativeArea: { type: "string" }
      },
      required: ["name", "coordinates"]
    },
    business_type: { type: "string" },
    poi_density_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Point-of-interest density score from OpenStreetMap data"
    },
    pedestrian_infrastructure_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Pedestrian infrastructure quality score based on footways, crosswalks, transit stops"
    },
    review_velocity_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Review velocity score indicating commercial activity level"
    },
    population_density_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Population density score from GeoNames data"
    },
    composite_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Weighted composite score combining all signals"
    },
    competitor_saturation: {
      type: "object",
      properties: {
        count_250m: { type: "number", description: "Competitors within 250 meters" },
        count_500m: { type: "number", description: "Competitors within 500 meters" },
        count_1km: { type: "number", description: "Competitors within 1 kilometer" },
        saturation_level: {
          type: "string",
          enum: ["low", "moderate", "high", "saturated"],
          description: "Overall market saturation level"
        },
        competitors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              distance_meters: { type: "number" },
              type: { type: "string" }
            },
            required: ["name", "distance_meters", "type"]
          },
          description: "List of nearby competitors with distances"
        }
      },
      required: ["count_250m", "count_500m", "count_1km", "saturation_level", "competitors"]
    },
    inferred_peak_hours: {
      type: "object",
      properties: {
        morning: { type: "string", description: 'Morning peak hours (e.g., "8am-10am")' },
        midday: { type: "string", description: 'Midday peak hours (e.g., "12pm-2pm")' },
        evening: { type: "string", description: 'Evening peak hours (e.g., "6pm-9pm")' },
        pattern_type: {
          type: "string",
          enum: ["residential", "commercial", "entertainment", "mixed"],
          description: "Dominant activity pattern type"
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Confidence level in pattern inference"
        }
      },
      required: ["pattern_type", "confidence"]
    },
    data_sources: {
      type: "array",
      items: { type: "string" },
      description: "List of data sources used in analysis"
    },
    cached: {
      type: "boolean",
      description: "Whether data was served from cache"
    },
    timestamp: {
      type: "string",
      format: "date-time",
      description: "Analysis timestamp in ISO 8601 format"
    }
  },
  required: [
    "location",
    "business_type",
    "poi_density_score",
    "pedestrian_infrastructure_score",
    "review_velocity_score",
    "population_density_score",
    "composite_score",
    "competitor_saturation",
    "inferred_peak_hours",
    "data_sources",
    "cached",
    "timestamp"
  ]
};
var COMPARE_SITES_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sites: {
      type: "array",
      items: {
        // Same structure as GET_SITE_INTELLIGENCE_OUTPUT_SCHEMA
        type: "object",
        properties: {
          location: {
            type: "object",
            properties: {
              name: { type: "string" },
              coordinates: {
                type: "object",
                properties: {
                  latitude: { type: "number" },
                  longitude: { type: "number" }
                }
              }
            }
          },
          business_type: { type: "string" },
          poi_density_score: { type: "number", minimum: 0, maximum: 100 },
          pedestrian_infrastructure_score: { type: "number", minimum: 0, maximum: 100 },
          review_velocity_score: { type: "number", minimum: 0, maximum: 100 },
          population_density_score: { type: "number", minimum: 0, maximum: 100 },
          composite_score: { type: "number", minimum: 0, maximum: 100 },
          competitor_saturation: {
            type: "object",
            properties: {
              count_250m: { type: "number" },
              count_500m: { type: "number" },
              count_1km: { type: "number" },
              saturation_level: { type: "string", enum: ["low", "moderate", "high", "saturated"] },
              competitors: { type: "array", items: { type: "object" } }
            }
          },
          inferred_peak_hours: {
            type: "object",
            properties: {
              pattern_type: { type: "string", enum: ["residential", "commercial", "entertainment", "mixed"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] }
            }
          },
          data_sources: { type: "array", items: { type: "string" } },
          cached: { type: "boolean" },
          timestamp: { type: "string" }
        }
      },
      description: "Array of site intelligence objects, sorted by composite score"
    },
    recommendation: {
      type: "object",
      properties: {
        recommended_site: {
          type: "string",
          description: "Name of the recommended location"
        },
        reasoning: {
          type: "string",
          description: "AI-generated reasoning for the recommendation"
        },
        risk_factors: {
          type: "array",
          items: { type: "string" },
          description: "Identified risk factors for the recommended site"
        },
        suggested_action: {
          type: "string",
          description: "Next steps recommendation for decision-makers"
        }
      },
      required: ["recommended_site", "reasoning", "risk_factors", "suggested_action"]
    },
    comparison_matrix: {
      type: "array",
      items: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            description: "Name of the comparison metric"
          },
          sites: {
            type: "object",
            additionalProperties: true,
            description: "Metric values keyed by site name"
          }
        },
        required: ["metric", "sites"]
      },
      description: "Side-by-side comparison matrix for all metrics"
    }
  },
  required: ["sites", "recommendation", "comparison_matrix"]
};
var GET_AREA_SIGNALS_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    location: {
      type: "object",
      properties: {
        name: { type: "string" },
        coordinates: {
          type: "object",
          properties: {
            latitude: { type: "number" },
            longitude: { type: "number" }
          },
          required: ["latitude", "longitude"]
        }
      },
      required: ["name", "coordinates"]
    },
    area_profile: {
      type: "object",
      properties: {
        poi_density_score: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "Point-of-interest density score"
        },
        pedestrian_score: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "Pedestrian infrastructure score"
        },
        population_score: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description: "Population density score"
        },
        commercial_activity: {
          type: "string",
          enum: ["low", "moderate", "high", "very_high"],
          description: "Overall commercial activity level"
        }
      },
      required: ["poi_density_score", "pedestrian_score", "population_score", "commercial_activity"]
    },
    dominant_categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Business category name"
          },
          count: {
            type: "number",
            description: "Number of POIs in this category"
          },
          percentage: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Percentage of total POIs"
          }
        },
        required: ["category", "count", "percentage"]
      },
      description: "Top business categories in the area"
    },
    foot_traffic_potential: {
      type: "string",
      enum: ["low", "moderate", "high", "very_high"],
      description: "Overall foot traffic potential assessment"
    },
    recommended_business_types: {
      type: "array",
      items: { type: "string" },
      description: "Business types recommended for this area"
    }
  },
  required: [
    "location",
    "area_profile",
    "dominant_categories",
    "foot_traffic_potential",
    "recommended_business_types"
  ]
};
var GET_COMPETITOR_DENSITY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    count_250m: {
      type: "number",
      description: "Number of competitors within 250 meters"
    },
    count_500m: {
      type: "number",
      description: "Number of competitors within 500 meters"
    },
    count_1km: {
      type: "number",
      description: "Number of competitors within 1 kilometer"
    },
    saturation_level: {
      type: "string",
      enum: ["low", "moderate", "high", "saturated"],
      description: "Market saturation level based on 500m radius"
    },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Competitor business name"
          },
          distance_meters: {
            type: "number",
            description: "Distance from query location in meters"
          },
          type: {
            type: "string",
            description: "Business type/category"
          }
        },
        required: ["name", "distance_meters", "type"]
      },
      description: "List of competitors sorted by distance"
    }
  },
  required: ["count_250m", "count_500m", "count_1km", "saturation_level", "competitors"]
};
var server = new McpServer({
  name: "foot-traffic-mcp-server",
  version: "1.0.0"
});
server.registerTool(
  "get_site_intelligence",
  {
    title: "Get Site Intelligence",
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
  async (params) => {
    return await getSiteIntelligence(params);
  }
);
server.registerTool(
  "compare_sites",
  {
    title: "Compare Multiple Sites",
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
  async (params) => {
    return await compareSites(params);
  }
);
server.registerTool(
  "get_area_signals",
  {
    title: "Get Area Foot Traffic Signals",
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
  async (params) => {
    return await getAreaSignals(params);
  }
);
server.registerTool(
  "get_competitor_density",
  {
    title: "Get Competitor Density",
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
  - low: \u22643 competitors within 500m
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
  async (params) => {
    return await getCompetitorDensity(params);
  }
);
async function runStdio() {
  const transport2 = new StdioServerTransport();
  await server.connect(transport2);
  console.error("Foot Traffic MCP Server running on stdio");
}
async function runHTTP() {
  const app = express();
  app.use(express.json());
  app.post("/mcp", async (req, res) => {
    const transport2 = new StreamableHTTPServerTransport({
      sessionIdGenerator: void 0,
      enableJsonResponse: true
    });
    res.on("close", () => transport2.close());
    await server.connect(transport2);
    await transport2.handleRequest(req, res, req.body);
  });
  const port = parseInt(process.env.PORT || "3000", 10);
  app.listen(port, "0.0.0.0", () => {
    console.log(`Foot Traffic MCP Server running on port ${port}`);
  });
}
var transport = process.env.TRANSPORT || "stdio";
var mode = process.argv[2];
if (mode === "--help" || mode === "-h") {
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
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
export {
  COMPARE_SITES_OUTPUT_SCHEMA,
  GET_AREA_SIGNALS_OUTPUT_SCHEMA,
  GET_COMPETITOR_DENSITY_OUTPUT_SCHEMA,
  GET_SITE_INTELLIGENCE_OUTPUT_SCHEMA
};
