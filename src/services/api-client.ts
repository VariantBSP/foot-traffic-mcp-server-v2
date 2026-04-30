// API client utilities for external data sources

import fetch from 'node-fetch';
import {
  OVERPASS_API_URL,
  NOMINATIM_API_URL,
  GEONAMES_API_URL,
  GOOGLE_PLACES_API_URL,
  REQUEST_DELAYS,
  GEONAMES_USERNAME,
  GOOGLE_PLACES_API_KEY
} from '../constants.js';
import {
  OverpassResponse,
  NominatimResult,
  GeoNamesResult,
  GooglePlaceResult,
  Coordinates
} from '../types.js';

// Rate limiting helper
let lastRequestTime: Record<string, number> = {};

async function rateLimitedFetch(service: string, url: string, options?: any): Promise<any> {
  const delay = REQUEST_DELAYS[service as keyof typeof REQUEST_DELAYS] || 1000;
  const now = Date.now();
  const lastRequest = lastRequestTime[service] || 0;
  const timeSinceLastRequest = now - lastRequest;

  if (timeSinceLastRequest < delay) {
    await new Promise(resolve => setTimeout(resolve, delay - timeSinceLastRequest));
  }

  lastRequestTime[service] = Date.now();

  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${service}`);
  }

  return response.json();
}

// Geocoding with Nominatim
export async function geocodeLocation(locationName: string): Promise<Coordinates> {
  const url = `${NOMINATIM_API_URL}?q=${encodeURIComponent(locationName)}&format=json&limit=1`;
  
  const results = await rateLimitedFetch('NOMINATIM', url, {
    headers: {
      'User-Agent': 'FootTrafficMCPServer/1.0'
    }
  }) as NominatimResult[];

  if (!results || results.length === 0) {
    throw new Error(`Location not found: ${locationName}`);
  }

  return {
    latitude: parseFloat(results[0].lat),
    longitude: parseFloat(results[0].lon)
  };
}

// Overpass API for OSM data
export async function queryOverpass(query: string): Promise<OverpassResponse> {
  const url = OVERPASS_API_URL;
  
  const response = await rateLimitedFetch('OVERPASS', url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `data=${encodeURIComponent(query)}`
  });

  return response as OverpassResponse;
}

// Build Overpass query for POIs around a location
export function buildPOIQuery(lat: number, lon: number, radiusMeters: number): string {
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

// Build Overpass query for pedestrian infrastructure
export function buildPedestrianQuery(lat: number, lon: number, radiusMeters: number): string {
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

// Build Overpass query for specific business types (competitors)
export function buildCompetitorQuery(
  lat: number,
  lon: number,
  radiusMeters: number,
  amenityTypes: string[]
): string {
  const conditions = amenityTypes.map(type => {
    if (type.startsWith('shop')) {
      return `node["shop"](around:${radiusMeters},${lat},${lon});`;
    }
    return `node["amenity"="${type}"](around:${radiusMeters},${lat},${lon});`;
  }).join('\n      ');

  return `
    [out:json][timeout:25];
    (
      ${conditions}
    );
    out body;
  `;
}

// GeoNames population data
export async function getPopulationData(lat: number, lon: number): Promise<number> {
  const url = `${GEONAMES_API_URL}?lat=${lat}&lng=${lon}&radius=20&maxRows=1&username=${GEONAMES_USERNAME}`;
  
  try {
    const data = await rateLimitedFetch('GEONAMES', url) as GeoNamesResult;
    
    if (data.geonames && data.geonames.length > 0) {
      return data.geonames[0].population;
    }
    
    return 0;
  } catch (error) {
    console.error('GeoNames API error:', error);
    return 0;
  }
}

// Google Places API for review data (optional)
export async function getPlacesReviewData(
  lat: number,
  lon: number,
  radiusMeters: number,
  businessType: string
): Promise<GooglePlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    return [];
  }

  const url = `${GOOGLE_PLACES_API_URL}/nearbysearch/json?location=${lat},${lon}&radius=${radiusMeters}&type=${businessType}&key=${GOOGLE_PLACES_API_KEY}`;
  
  try {
    const data = await rateLimitedFetch('GOOGLE_PLACES', url);
    return data.results || [];
  } catch (error) {
    console.error('Google Places API error:', error);
    return [];
  }
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
