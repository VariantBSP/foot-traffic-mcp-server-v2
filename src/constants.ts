// Shared constants and configuration

// API Endpoints
export const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
export const NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search';
export const GEONAMES_API_URL = 'http://api.geonames.org/searchJSON';
export const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place';

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  POI_DATA: 7 * 24 * 60 * 60 * 1000,        // 7 days
  PEDESTRIAN_DATA: 7 * 24 * 60 * 60 * 1000, // 7 days
  REVIEW_DATA: 48 * 60 * 60 * 1000,         // 48 hours
  POPULATION_DATA: 30 * 24 * 60 * 60 * 1000, // 30 days
  TRANSIT_DATA: 14 * 24 * 60 * 60 * 1000,   // 14 days
  GEOCODING: 30 * 24 * 60 * 60 * 1000       // 30 days
} as const;

// Analysis Parameters
export const DEFAULT_RADIUS_METERS = 500;
export const COMPETITOR_RADII = [250, 500, 1000] as const;

// Score Weights for Composite Score
export const SCORE_WEIGHTS = {
  POI_DENSITY: 0.25,
  PEDESTRIAN_INFRASTRUCTURE: 0.25,
  REVIEW_VELOCITY: 0.30,
  POPULATION_DENSITY: 0.20
} as const;

// Rate Limiting
export const REQUEST_DELAYS = {
  OVERPASS: 1000,  // 1 second between requests
  NOMINATIM: 1000, // 1 second per Nominatim policy
  GOOGLE_PLACES: 100 // 100ms between requests
} as const;

// Character limit for responses
export const CHARACTER_LIMIT = 15000;

// GeoNames username (users should set this via environment variable)
export const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'demo';

// Google Places API key (optional - if not set, review data will be unavailable)
export const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

// Business type mappings to OSM amenity tags
export const BUSINESS_TYPE_MAPPINGS: Record<string, string[]> = {
  'restaurant': ['restaurant', 'fast_food', 'cafe', 'food_court'],
  'cafe': ['cafe', 'coffee'],
  'retail': ['shop', 'mall', 'marketplace'],
  'gym': ['gym', 'fitness_centre', 'sports_centre'],
  'hotel': ['hotel', 'hostel', 'guest_house'],
  'office': ['office', 'coworking_space'],
  'bar': ['bar', 'pub', 'nightclub'],
  'pharmacy': ['pharmacy', 'chemist'],
  'grocery': ['supermarket', 'convenience', 'greengrocer']
} as const;

// Peak hour patterns based on amenity composition
export const PEAK_HOUR_PATTERNS = {
  office: { morning: '8am-10am', midday: '12pm-2pm', pattern: 'commercial' },
  residential: { morning: '7am-9am', evening: '5pm-8pm', pattern: 'residential' },
  entertainment: { evening: '6pm-11pm', pattern: 'entertainment' },
  mixed: { morning: '8am-10am', midday: '12pm-2pm', evening: '6pm-9pm', pattern: 'mixed' }
} as const;
