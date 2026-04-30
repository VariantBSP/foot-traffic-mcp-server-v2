// Signal processing and scoring logic

import {
  POIData,
  PedestrianInfrastructure,
  ReviewData,
  PopulationData,
  CompetitorData,
  PeakHours,
  OverpassElement,
  Coordinates
} from '../types.js';
import {
  SCORE_WEIGHTS,
  BUSINESS_TYPE_MAPPINGS,
  PEAK_HOUR_PATTERNS
} from '../constants.js';
import { calculateDistance } from './api-client.js';

// Process POI data and calculate density score
export function processPOIData(elements: OverpassElement[]): POIData {
  const categories: Record<string, number> = {};
  
  elements.forEach(element => {
    if (element.tags) {
      const amenity = element.tags.amenity || element.tags.shop || element.tags.tourism || element.tags.leisure;
      if (amenity) {
        categories[amenity] = (categories[amenity] || 0) + 1;
      }
    }
  });

  const count = elements.length;
  
  // Normalize score: 0-50 POIs = 0-50, 50-200 = 50-80, 200+ = 80-100
  let density_score: number;
  if (count <= 50) {
    density_score = count;
  } else if (count <= 200) {
    density_score = 50 + ((count - 50) / 150) * 30;
  } else {
    density_score = Math.min(100, 80 + ((count - 200) / 100) * 20);
  }

  return {
    count,
    density_score: Math.round(density_score),
    categories
  };
}

// Process pedestrian infrastructure and calculate score
export function processPedestrianData(elements: OverpassElement[]): PedestrianInfrastructure {
  let footway_length_meters = 0;
  let crosswalk_count = 0;
  let transit_stop_count = 0;

  elements.forEach(element => {
    if (element.tags) {
      const highway = element.tags.highway;
      const publicTransport = element.tags.public_transport;

      if (highway === 'footway' || highway === 'pedestrian' || highway === 'path') {
        // Approximate length (this is simplified - real implementation would calculate from way geometry)
        footway_length_meters += 50;
      } else if (highway === 'crossing') {
        crosswalk_count++;
      } else if (highway === 'bus_stop' || publicTransport === 'stop_position') {
        transit_stop_count++;
      }
    }
  });

  // Calculate infrastructure score (weighted combination)
  const footwayScore = Math.min(40, (footway_length_meters / 50)); // Max 40 points for 2km+ footways
  const crosswalkScore = Math.min(30, crosswalk_count * 3); // Max 30 points for 10+ crosswalks
  const transitScore = Math.min(30, transit_stop_count * 6); // Max 30 points for 5+ transit stops

  const infrastructure_score = Math.round(footwayScore + crosswalkScore + transitScore);

  return {
    footway_length_meters,
    crosswalk_count,
    transit_stop_count,
    infrastructure_score
  };
}

// Process review data and calculate velocity score
export function processReviewData(places: any[]): ReviewData {
  let total_reviews = 0;
  let recent_reviews_90d = 0;
  const sample_venues: Array<{ name: string; review_count: number; rating?: number }> = [];

  const now = Date.now();
  const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

  places.forEach(place => {
    const reviewCount = place.user_ratings_total || 0;
    total_reviews += reviewCount;

    // Sample top venues
    if (sample_venues.length < 5) {
      sample_venues.push({
        name: place.name,
        review_count: reviewCount,
        rating: place.rating
      });
    }

    // Count recent reviews (if available in API response)
    if (place.reviews) {
      const recentCount = place.reviews.filter((r: any) => r.time * 1000 > ninetyDaysAgo).length;
      recent_reviews_90d += recentCount;
    }
  });

  // Calculate velocity score
  const avgReviewsPerVenue = places.length > 0 ? total_reviews / places.length : 0;
  const recencyBonus = recent_reviews_90d > 0 ? 20 : 0;
  
  let velocity_score: number;
  if (avgReviewsPerVenue <= 100) {
    velocity_score = avgReviewsPerVenue / 2;
  } else if (avgReviewsPerVenue <= 500) {
    velocity_score = 50 + ((avgReviewsPerVenue - 100) / 400) * 30;
  } else {
    velocity_score = Math.min(100, 80 + recencyBonus);
  }

  return {
    total_reviews,
    recent_reviews_90d,
    review_velocity_score: Math.round(velocity_score),
    sample_venues: sample_venues.slice(0, 5)
  };
}

// Process population data and calculate density score
export function processPopulationData(population: number): PopulationData {
  // Normalize population to score
  let density_score: number;
  
  if (population <= 10000) {
    density_score = (population / 10000) * 30;
  } else if (population <= 100000) {
    density_score = 30 + ((population - 10000) / 90000) * 40;
  } else {
    density_score = Math.min(100, 70 + ((population - 100000) / 200000) * 30);
  }

  return {
    population,
    density_score: Math.round(density_score),
    source: 'GeoNames'
  };
}

// Process competitor data
export function processCompetitorData(
  elements: OverpassElement[],
  centerLat: number,
  centerLon: number
): CompetitorData {
  const competitors = elements
    .filter(el => el.lat && el.lon)
    .map(el => {
      const lat = el.lat || (el.center?.lat ?? 0);
      const lon = el.lon || (el.center?.lon ?? 0);
      const distance = calculateDistance(centerLat, centerLon, lat, lon);
      
      return {
        name: el.tags?.name || 'Unnamed',
        distance_meters: Math.round(distance),
        type: el.tags?.amenity || el.tags?.shop || 'unknown'
      };
    })
    .sort((a, b) => a.distance_meters - b.distance_meters);

  const count_250m = competitors.filter(c => c.distance_meters <= 250).length;
  const count_500m = competitors.filter(c => c.distance_meters <= 500).length;
  const count_1km = competitors.filter(c => c.distance_meters <= 1000).length;

  let saturation_level: 'low' | 'moderate' | 'high' | 'saturated';
  if (count_500m <= 3) saturation_level = 'low';
  else if (count_500m <= 8) saturation_level = 'moderate';
  else if (count_500m <= 15) saturation_level = 'high';
  else saturation_level = 'saturated';

  return {
    count_250m,
    count_500m,
    count_1km,
    saturation_level,
    competitors: competitors.slice(0, 10)
  };
}

// Infer peak hours from amenity composition
export function inferPeakHours(categories: Record<string, number>): PeakHours {
  const total = Object.values(categories).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return {
      pattern_type: 'mixed',
      confidence: 'low'
    };
  }

  // Calculate category percentages
  const officeRelated = (categories.office || 0) + (categories.coworking_space || 0);
  const foodRelated = (categories.restaurant || 0) + (categories.cafe || 0) + (categories.fast_food || 0);
  const entertainmentRelated = (categories.bar || 0) + (categories.pub || 0) + (categories.nightclub || 0);
  const residentialRelated = (categories.residential || 0);

  const officePercent = (officeRelated / total) * 100;
  const foodPercent = (foodRelated / total) * 100;
  const entertainmentPercent = (entertainmentRelated / total) * 100;

  // Determine dominant pattern
  if (officePercent > 30 || (officePercent > 20 && foodPercent > 20)) {
    return {
      morning: '8am-10am',
      midday: '12pm-2pm',
      pattern_type: 'commercial',
      confidence: officePercent > 30 ? 'high' : 'medium'
    };
  } else if (entertainmentPercent > 25) {
    return {
      evening: '6pm-11pm',
      pattern_type: 'entertainment',
      confidence: entertainmentPercent > 35 ? 'high' : 'medium'
    };
  } else if (residentialRelated > total * 0.4) {
    return {
      morning: '7am-9am',
      evening: '5pm-8pm',
      pattern_type: 'residential',
      confidence: 'medium'
    };
  } else {
    return {
      morning: '8am-10am',
      midday: '12pm-2pm',
      evening: '6pm-9pm',
      pattern_type: 'mixed',
      confidence: 'medium'
    };
  }
}

// Calculate composite site score
export function calculateCompositeScore(
  poiScore: number,
  pedestrianScore: number,
  reviewScore: number,
  populationScore: number
): number {
  const composite =
    poiScore * SCORE_WEIGHTS.POI_DENSITY +
    pedestrianScore * SCORE_WEIGHTS.PEDESTRIAN_INFRASTRUCTURE +
    reviewScore * SCORE_WEIGHTS.REVIEW_VELOCITY +
    populationScore * SCORE_WEIGHTS.POPULATION_DENSITY;

  return Math.round(composite);
}

// Get business type mappings
export function getBusinessTypeTags(businessType: string): string[] {
  const normalized = businessType.toLowerCase();
  return BUSINESS_TYPE_MAPPINGS[normalized] || ['restaurant', 'cafe', 'fast_food'];
}
