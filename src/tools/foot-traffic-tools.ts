// MCP Tools implementation

import { z } from 'zod';
import { cache } from '../services/cache.js';
import {
  geocodeLocation,
  queryOverpass,
  buildPOIQuery,
  buildPedestrianQuery,
  buildCompetitorQuery,
  getPopulationData
} from '../services/api-client.js';
import {
  processPOIData,
  processPedestrianData,
  processReviewData,
  processPopulationData,
  processCompetitorData,
  inferPeakHours,
  calculateCompositeScore,
  getBusinessTypeTags
} from '../services/signal-processor.js';
import {
  SiteIntelligence,
  SiteComparison,
  AreaSignals,
  Coordinates,
  ResponseFormat
} from '../types.js';
import {
  DEFAULT_RADIUS_METERS,
  COMPETITOR_RADII,
  CACHE_TTL,
  CHARACTER_LIMIT
} from '../constants.js';

// Zod schemas for input validation

export const GetSiteIntelligenceInputSchema = z.object({
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .describe('Location name or address (e.g., "Lekki Phase 1, Lagos" or "Yaba, Lagos")'),
  business_type: z.string()
    .min(2, 'Business type must be at least 2 characters')
    .describe('Type of business (e.g., "restaurant", "cafe", "retail", "gym")'),
  radius_meters: z.number()
    .int()
    .min(100)
    .max(2000)
    .default(DEFAULT_RADIUS_METERS)
    .describe('Analysis radius in meters (default: 500)'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.JSON)
    .describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export const CompareSitesInputSchema = z.object({
  locations: z.array(z.string().min(2))
    .min(2, 'Must provide at least 2 locations to compare')
    .max(5, 'Can compare maximum 5 locations at once')
    .describe('Array of location names or addresses to compare'),
  business_type: z.string()
    .min(2, 'Business type must be at least 2 characters')
    .describe('Type of business for comparison context'),
  radius_meters: z.number()
    .int()
    .min(100)
    .max(2000)
    .default(DEFAULT_RADIUS_METERS)
    .describe('Analysis radius in meters (default: 500)'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.JSON)
    .describe('Output format: "json" or "markdown"')
}).strict();

export const GetAreaSignalsInputSchema = z.object({
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .describe('Neighborhood or district name'),
  radius_meters: z.number()
    .int()
    .min(500)
    .max(2000)
    .default(1000)
    .describe('Analysis radius in meters (default: 1000)'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.JSON)
    .describe('Output format: "json" or "markdown"')
}).strict();

export const GetCompetitorDensityInputSchema = z.object({
  location: z.string()
    .min(2, 'Location must be at least 2 characters')
    .describe('Location name or address'),
  business_type: z.string()
    .min(2, 'Business type must be at least 2 characters')
    .describe('Type of business to search for competitors'),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.JSON)
    .describe('Output format: "json" or "markdown"')
}).strict();

// Type definitions from schemas
export type GetSiteIntelligenceInput = z.infer<typeof GetSiteIntelligenceInputSchema>;
export type CompareSitesInput = z.infer<typeof CompareSitesInputSchema>;
export type GetAreaSignalsInput = z.infer<typeof GetAreaSignalsInputSchema>;
export type GetCompetitorDensityInput = z.infer<typeof GetCompetitorDensityInputSchema>;

// Helper: Fetch site intelligence for a single location
export async function fetchSiteIntelligence(
  location: string,
  businessType: string,
  radiusMeters: number
): Promise<SiteIntelligence> {
  const cacheKey = `site:${location}:${businessType}:${radiusMeters}`;
  
  // Check cache first
  const cached = cache.get<SiteIntelligence>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  // Geocode the location
  const coordinates = await geocodeLocation(location);
  
  // Fetch all data in parallel
  const [poiData, pedestrianData, populationRaw, competitorElements] = await Promise.all([
    queryOverpass(buildPOIQuery(coordinates.latitude, coordinates.longitude, radiusMeters)),
    queryOverpass(buildPedestrianQuery(coordinates.latitude, coordinates.longitude, radiusMeters)),
    getPopulationData(coordinates.latitude, coordinates.longitude),
    queryOverpass(
      buildCompetitorQuery(
        coordinates.latitude,
        coordinates.longitude,
        1000,
        getBusinessTypeTags(businessType)
      )
    )
  ]);

  // Process all signals
  const poiProcessed = processPOIData(poiData.elements);
  const pedestrianProcessed = processPedestrianData(pedestrianData.elements);
  const populationProcessed = processPopulationData(populationRaw);
  const competitorProcessed = processCompetitorData(
    competitorElements.elements,
    coordinates.latitude,
    coordinates.longitude
  );
  
  // For now, review velocity score is set to a default since Google Places requires API key
  const reviewVelocityScore = 50; // Neutral score when API key not available
  
  const peakHours = inferPeakHours(poiProcessed.categories);
  const compositeScore = calculateCompositeScore(
    poiProcessed.density_score,
    pedestrianProcessed.infrastructure_score,
    reviewVelocityScore,
    populationProcessed.density_score
  );

  const intelligence: SiteIntelligence = {
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
      'OpenStreetMap (POI & Infrastructure)',
      'GeoNames (Population)',
      'OSM Overpass API'
    ],
    cached: false,
    timestamp: new Date().toISOString()
  };

  // Cache the result
  cache.set(cacheKey, intelligence, CACHE_TTL.POI_DATA);

  return intelligence;
}

// Tool implementations

export async function getSiteIntelligence(
  params: GetSiteIntelligenceInput
): Promise<{ content: any[]; structuredContent?: any }> {
  try {
    const intelligence = await fetchSiteIntelligence(
      params.location,
      params.business_type,
      params.radius_meters
    );

    if (params.response_format === ResponseFormat.MARKDOWN) {
      const markdown = formatSiteIntelligenceMarkdown(intelligence);
      return {
        content: [{ type: 'text', text: markdown }]
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(intelligence, null, 2) }],
      structuredContent: intelligence
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{
        type: 'text',
        text: `Error fetching site intelligence: ${errorMessage}\n\nPlease check that the location name is valid and try again.`
      }]
    };
  }
}

export async function compareSites(
  params: CompareSitesInput
): Promise<{ content: any[]; structuredContent?: any }> {
  try {
    // Fetch intelligence for all locations sequentially to avoid rate limiting
    const sites: SiteIntelligence[] = [];
    
    for (let i = 0; i < params.locations.length; i++) {
      const location = params.locations[i];
      const intelligence = await fetchSiteIntelligence(
        location,
        params.business_type,
        params.radius_meters
      );
      sites.push(intelligence);
      
      // Add delay between requests if not from cache (to respect rate limits)
      // Only delay if there are more locations to fetch and this wasn't cached
      if (i < params.locations.length - 1 && !intelligence.cached) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    // Sort by composite score (descending)
    const sortedSites = sites.sort((a, b) => b.composite_score - a.composite_score);

    // Generate recommendation
    const topSite = sortedSites[0];
    const recommendation = generateRecommendation(sortedSites, params.business_type);

    // Build comparison matrix
    const comparisonMatrix = [
      {
        metric: 'Composite Score',
        sites: Object.fromEntries(sortedSites.map(s => [s.location.name, s.composite_score]))
      },
      {
        metric: 'POI Density Score',
        sites: Object.fromEntries(sortedSites.map(s => [s.location.name, s.poi_density_score]))
      },
      {
        metric: 'Pedestrian Infrastructure',
        sites: Object.fromEntries(sortedSites.map(s => [s.location.name, s.pedestrian_infrastructure_score]))
      },
      {
        metric: 'Population Density',
        sites: Object.fromEntries(sortedSites.map(s => [s.location.name, s.population_density_score]))
      },
      {
        metric: 'Competitor Saturation',
        sites: Object.fromEntries(sortedSites.map(s => [s.location.name, s.competitor_saturation.saturation_level]))
      }
    ];

    const comparison: SiteComparison = {
      sites: sortedSites,
      recommendation,
      comparison_matrix: comparisonMatrix
    };

    if (params.response_format === ResponseFormat.MARKDOWN) {
      const markdown = formatSiteComparisonMarkdown(comparison);
      return {
        content: [{ type: 'text', text: markdown }]
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(comparison, null, 2) }],
      structuredContent: comparison
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{
        type: 'text',
        text: `Error comparing sites: ${errorMessage}\n\nPlease check that all location names are valid and try again.`
      }]
    };
  }
}

export async function getAreaSignals(
  params: GetAreaSignalsInput
): Promise<{ content: any[]; structuredContent?: any }> {
  try {
    const coordinates = await geocodeLocation(params.location);
    
    // Fetch POI data for area profiling
    const poiData = await queryOverpass(
      buildPOIQuery(coordinates.latitude, coordinates.longitude, params.radius_meters)
    );
    
    const poiProcessed = processPOIData(poiData.elements);
    
    // Determine dominant categories
    const sortedCategories = Object.entries(poiProcessed.categories)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10);
    
    const dominant_categories = sortedCategories.map(([category, count]) => ({
      category,
      count: count as number,
      percentage: Math.round(((count as number) / poiProcessed.count) * 100)
    }));

    // Determine commercial activity level
    let commercial_activity: 'low' | 'moderate' | 'high' | 'very_high';
    if (poiProcessed.density_score < 40) commercial_activity = 'low';
    else if (poiProcessed.density_score < 65) commercial_activity = 'moderate';
    else if (poiProcessed.density_score < 85) commercial_activity = 'high';
    else commercial_activity = 'very_high';

    // Determine foot traffic potential
    let foot_traffic_potential: 'low' | 'moderate' | 'high' | 'very_high';
    if (poiProcessed.density_score < 35) foot_traffic_potential = 'low';
    else if (poiProcessed.density_score < 60) foot_traffic_potential = 'moderate';
    else if (poiProcessed.density_score < 80) foot_traffic_potential = 'high';
    else foot_traffic_potential = 'very_high';

    const areaSignals: AreaSignals = {
      location: {
        name: params.location,
        coordinates
      },
      area_profile: {
        poi_density_score: poiProcessed.density_score,
        pedestrian_score: 0, // Simplified for area overview
        population_score: 0, // Simplified for area overview
        commercial_activity
      },
      dominant_categories,
      foot_traffic_potential,
      recommended_business_types: recommendBusinessTypes(dominant_categories)
    };

    if (params.response_format === ResponseFormat.MARKDOWN) {
      const markdown = formatAreaSignalsMarkdown(areaSignals);
      return {
        content: [{ type: 'text', text: markdown }]
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(areaSignals, null, 2) }],
      structuredContent: areaSignals
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{
        type: 'text',
        text: `Error fetching area signals: ${errorMessage}`
      }]
    };
  }
}

export async function getCompetitorDensity(
  params: GetCompetitorDensityInput
): Promise<{ content: any[]; structuredContent?: any }> {
  try {
    const coordinates = await geocodeLocation(params.location);
    const businessTags = getBusinessTypeTags(params.business_type);
    
    const elements = await queryOverpass(
      buildCompetitorQuery(coordinates.latitude, coordinates.longitude, 1000, businessTags)
    );

    const competitorData = processCompetitorData(
      elements.elements,
      coordinates.latitude,
      coordinates.longitude
    );

    if (params.response_format === ResponseFormat.MARKDOWN) {
      const markdown = formatCompetitorDensityMarkdown(competitorData, params.location, params.business_type);
      return {
        content: [{ type: 'text', text: markdown }]
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(competitorData, null, 2) }],
      structuredContent: competitorData
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      content: [{
        type: 'text',
        text: `Error fetching competitor density: ${errorMessage}`
      }]
    };
  }
}

// Helper functions for formatting

function formatSiteIntelligenceMarkdown(intel: SiteIntelligence): string {
  return `# Site Intelligence: ${intel.location.name}

**Business Type:** ${intel.business_type}
**Analysis Date:** ${new Date(intel.timestamp).toLocaleDateString()}
**Data Cached:** ${intel.cached ? 'Yes' : 'No'}

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
${intel.inferred_peak_hours.morning ? `- **Morning Peak:** ${intel.inferred_peak_hours.morning}\n` : ''}${intel.inferred_peak_hours.midday ? `- **Midday Peak:** ${intel.inferred_peak_hours.midday}\n` : ''}${intel.inferred_peak_hours.evening ? `- **Evening Peak:** ${intel.inferred_peak_hours.evening}\n` : ''}

### Data Sources
${intel.data_sources.map(s => `- ${s}`).join('\n')}
`;
}

function formatSiteComparisonMarkdown(comparison: SiteComparison): string {
  let markdown = `# Site Comparison Analysis\n\n`;
  
  markdown += `## Recommendation\n`;
  markdown += `**Recommended Site:** ${comparison.recommendation.recommended_site}\n\n`;
  markdown += `**Reasoning:** ${comparison.recommendation.reasoning}\n\n`;
  
  if (comparison.recommendation.risk_factors.length > 0) {
    markdown += `### Risk Factors\n`;
    comparison.recommendation.risk_factors.forEach(risk => {
      markdown += `- ${risk}\n`;
    });
    markdown += `\n`;
  }
  
  markdown += `**Suggested Action:** ${comparison.recommendation.suggested_action}\n\n`;
  
  markdown += `## Comparison Matrix\n\n`;
  comparison.comparison_matrix.forEach(row => {
    markdown += `### ${row.metric}\n`;
    Object.entries(row.sites).forEach(([site, value]) => {
      markdown += `- **${site}:** ${value}\n`;
    });
    markdown += `\n`;
  });
  
  return markdown;
}

function formatAreaSignalsMarkdown(signals: AreaSignals): string {
  return `# Area Signals: ${signals.location.name}

## Area Profile
- **POI Density Score:** ${signals.area_profile.poi_density_score}/100
- **Commercial Activity:** ${signals.area_profile.commercial_activity}
- **Foot Traffic Potential:** ${signals.foot_traffic_potential}

## Dominant Categories
${signals.dominant_categories.map(cat => `- **${cat.category}:** ${cat.count} (${cat.percentage}%)`).join('\n')}

## Recommended Business Types
${signals.recommended_business_types.map(type => `- ${type}`).join('\n')}
`;
}

function formatCompetitorDensityMarkdown(data: any, location: string, businessType: string): string {
  return `# Competitor Density Analysis
**Location:** ${location}
**Business Type:** ${businessType}

## Summary
- **Within 250m:** ${data.count_250m} competitors
- **Within 500m:** ${data.count_500m} competitors
- **Within 1km:** ${data.count_1km} competitors
- **Saturation Level:** ${data.saturation_level}

## Top Competitors
${data.competitors.slice(0, 10).map((c: any) => `- **${c.name}** (${c.distance_meters}m away)`).join('\n')}
`;
}

function generateRecommendation(sites: SiteIntelligence[], businessType: string): {
  recommended_site: string;
  reasoning: string;
  risk_factors: string[];
  suggested_action: string;
} {
  const topSite = sites[0];
  const secondSite = sites.length > 1 ? sites[1] : null;
  
  const riskFactors: string[] = [];
  
  if (topSite.competitor_saturation.saturation_level === 'saturated') {
    riskFactors.push('High competitor saturation may limit market share');
  }
  
  if (topSite.pedestrian_infrastructure_score < 50) {
    riskFactors.push('Below-average pedestrian infrastructure may limit foot traffic');
  }
  
  if (topSite.composite_score < 60) {
    riskFactors.push('Moderate composite score suggests careful market validation needed');
  }

  let reasoning = `${topSite.location.name} scores highest with a composite score of ${topSite.composite_score}/100. `;
  
  if (topSite.poi_density_score > 70) {
    reasoning += `Strong POI density (${topSite.poi_density_score}/100) indicates high commercial activity. `;
  }
  
  if (topSite.pedestrian_infrastructure_score > 70) {
    reasoning += `Excellent pedestrian infrastructure (${topSite.pedestrian_infrastructure_score}/100) supports foot traffic. `;
  }
  
  if (topSite.competitor_saturation.saturation_level === 'low' || topSite.competitor_saturation.saturation_level === 'moderate') {
    reasoning += `${topSite.competitor_saturation.saturation_level.charAt(0).toUpperCase() + topSite.competitor_saturation.saturation_level.slice(1)} competitor saturation provides market entry opportunity. `;
  }

  const suggestedAction = topSite.composite_score > 75
    ? `Recommended for immediate market entry. Conduct lease negotiations for ${topSite.location.name}.`
    : topSite.composite_score > 60
    ? `Recommended as primary location with additional on-ground validation. Visit site during peak hours identified.`
    : `Consider as viable option but conduct thorough market research before committing.`;

  return {
    recommended_site: topSite.location.name,
    reasoning: reasoning.trim(),
    risk_factors: riskFactors,
    suggested_action: suggestedAction
  };
}

function recommendBusinessTypes(categories: Array<{ category: string; count: number }>): string[] {
  const recommendations: string[] = [];
  const topCategories = categories.slice(0, 5).map(c => c.category);
  
  if (topCategories.includes('office')) {
    recommendations.push('Coffee shop', 'Quick-service restaurant', 'Lunch-focused cafe');
  }
  
  if (topCategories.includes('restaurant') || topCategories.includes('cafe')) {
    recommendations.push('Complementary cuisine types', 'Bar or evening venue');
  }
  
  if (topCategories.includes('shop') || topCategories.includes('supermarket')) {
    recommendations.push('Service businesses', 'Specialty retail');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Restaurant', 'Cafe', 'Retail shop');
  }
  
  return recommendations;
}
