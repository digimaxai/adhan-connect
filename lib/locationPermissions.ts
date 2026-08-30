import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface ReverseGeocodeResult {
  city?: string;
  region?: string;
  country?: string;
}

/**
 * Request location permission from the user
 */
export async function requestLocationPermission(): Promise<LocationPermissionStatus> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return (status.toLowerCase() as LocationPermissionStatus) || 'denied';
  } catch (error) {
    console.error('Failed to request location permission:', error);
    return 'denied';
  }
}

/**
 * Get current user location with high accuracy
 */
export async function getCurrentLocation(): Promise<LocationCoordinates | null> {
  try {
    // First check permission status
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    // Get current position with timeout
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeout: 10000, // 10 second timeout
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || undefined,
    };
  } catch (error) {
    console.error('Failed to get current location:', error);
    return null;
  }
}

/**
 * Get city name from coordinates using reverse geocoding
 */
export async function getCityFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (results.length > 0) {
      const result = results[0];
      // Try city first, then region, then country
      return result.city || result.region || result.country || null;
    }

    return null;
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * Get full address from coordinates
 */
export async function getAddressFromCoordinates(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (results.length > 0) {
      const { city, region, country } = results[0];
      return { city: city || undefined, region: region || undefined, country: country || undefined };
    }

    return null;
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return null;
  }
}

/**
 * Get coordinates from city name (forward geocoding)
 */
export async function getCoordinatesFromCity(city: string): Promise<LocationCoordinates | null> {
  try {
    const results = await Location.geocodeAsync(city);

    if (results.length > 0) {
      const { latitude, longitude } = results[0];
      return { latitude, longitude };
    }

    return null;
  } catch (error) {
    console.error('Forward geocoding failed:', error);
    return null;
  }
}

/**
 * Detect user's city with permission handling
 * Returns city name if successful, null otherwise
 */
export async function autoDetectCity(): Promise<string | null> {
  try {
    // Try to get permission first (don't interrupt user)
    const { status: currentStatus } = await Location.getForegroundPermissionsAsync();

    // If permission not granted, request it
    if (currentStatus !== 'granted') {
      const { status: requestedStatus } = await Location.requestForegroundPermissionsAsync();
      if (requestedStatus !== 'granted') {
        return null;
      }
    }

    // Get current location
    const location = await getCurrentLocation();
    if (!location) return null;

    // Reverse geocode to get city
    const city = await getCityFromCoordinates(location.latitude, location.longitude);
    return city;
  } catch (error) {
    console.error('Auto-detect city failed:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates (in km)
 * Using Haversine formula
 */
export function calculateDistance(
  from: LocationCoordinates,
  to: LocationCoordinates
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if device has location services enabled
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    return enabled;
  } catch (error) {
    console.error('Failed to check location services:', error);
    return false;
  }
}

/**
 * Open location settings (native only)
 */
export async function openLocationSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      // iOS uses a different approach - typically via Settings.openSetting() from expo-intent
      // For now, we can just inform the user
      console.log('Please enable location in Settings');
    } else if (Platform.OS === 'android') {
      // Android can open settings via Intent
      console.log('Please enable location in Settings');
    }
  } catch (error) {
    console.error('Failed to open location settings:', error);
  }
}

/**
 * Watchable location subscription for real-time tracking
 * Call returned unsubscribe function to stop watching
 */
export function watchLocation(
  onLocationChange: (location: LocationCoordinates) => void,
  onError?: (error: Error) => void
): (() => void) | null {
  try {
    const subscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 30000, // Update every 30 seconds
        distanceInterval: 100, // Or when moved 100 meters
      },
      (location) => {
        onLocationChange({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || undefined,
        });
      }
    );

    // Return unsubscribe function
    return () => {
      subscription.then((sub) => sub.remove());
    };
  } catch (error) {
    if (onError) onError(error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}
