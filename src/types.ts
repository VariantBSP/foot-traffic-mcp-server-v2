// TypeScript type definitions for the foot traffic MCP server

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  name: string;
  coordinates: Coordinates;
  administrativeArea?: string;
}

export interface POIData {
  count: number;
  density_score: number;
  categories: Record<string, number>;
}

export interface PedestrianInfrastructure {
  footway_length_meters: number;
  crosswalk_count: number;
  transit_stop_count: number;
  infrastructure_score: number;
}

export interface ReviewData {
  total_reviews: number;
  recent_reviews_90d: number;
  review_velocity_score: number;
  sample_venues: Array<{
    name: string;
    review_count: number;
    rating?: number;
  }>;
}

export interface PopulationData {
  population: number;
  density_score: number;
  source: string;
}

export interface CompetitorData {
  count_250m: number;
  count_500m: number;
  count_1km: number;
  saturation_level: 'low' | 'moderate' | 'high' | 'saturated';
  competitors: Array<{
    name: string;
    distance_meters: number;
    type: string;
  }>;
}

export interface PeakHours {
  morning?: string;
  midday?: string;
  evening?: string;
  pattern_type: 'residential' | 'commercial' | 'entertainment' | 'mixed';
  confidence: 'high' | 'medium' | 'low';
}

export interface SiteIntelligence {
  location: Location;
  business_type: string;
  poi_density_score: number;
  pedestrian_infrastructure_score: number;
  review_velocity_score: number;
  population_density_score: number;
  composite_score: number;
  competitor_saturation: CompetitorData;
  inferred_peak_hours: PeakHours;
  data_sources: string[];
  cached: boolean;
  timestamp: string;
}

export interface SiteComparison {
  sites: SiteIntelligence[];
  recommendation: {
    recommended_site: string;
    reasoning: string;
    risk_factors: string[];
    suggested_action: string;
  };
  comparison_matrix: Array<{
    metric: string;
    sites: Record<string, number | string>;
  }>;
}

export interface AreaSignals {
  location: Location;
  area_profile: {
    poi_density_score: number;
    pedestrian_score: number;
    population_score: number;
    commercial_activity: 'low' | 'moderate' | 'high' | 'very_high';
  };
  dominant_categories: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  foot_traffic_potential: 'low' | 'moderate' | 'high' | 'very_high';
  recommended_business_types: string[];
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface GooglePlaceResult {
  name: string;
  user_ratings_total?: number;
  rating?: number;
  reviews?: Array<{
    time: number;
    text: string;
  }>;
}

export interface GeoNamesResult {
  geonames: Array<{
    population: number;
    name: string;
    countryName: string;
  }>;
}

export enum ResponseFormat {
  JSON = 'json',
  MARKDOWN = 'markdown'
}
