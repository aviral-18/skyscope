declare module 'flightradar24-client' {
  interface FR24Flight {
    id: string;
    callsign?: string;
    icao24?: string;
    latitude: number;
    longitude: number;
    heading: number;
    altitude: number;
    speed: number;
    [key: string]: any;
  }

  interface FR24FlightDetail {
    origin?: {
      name?: string;
      icao?: string;
      iata?: string;
      latitude?: number;
      longitude?: number;
      lat?: number;
      lon?: number;
      lng?: number;
    };
    destination?: {
      name?: string;
      icao?: string;
      iata?: string;
      latitude?: number;
      longitude?: number;
      lat?: number;
      lon?: number;
      lng?: number;
    };
    aircraft?: {
      model?: { text?: string; code?: string };
      registration?: string;
      [key: string]: any;
    };
    airline?: {
      name?: string;
      short?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }

  export function fetchFromRadar(
    north: number,
    south: number,
    west: number,
    east: number,
  ): Promise<FR24Flight[]>;

  export function fetchFlight(flightId: string): Promise<FR24FlightDetail>;
}
