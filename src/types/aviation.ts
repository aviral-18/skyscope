export interface RouteAirport {
  name: string;
  icao: string;
  iata?: string;
  lat: number | null;
  lng: number | null;
}

export interface Aircraft {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  verticalRate: number;
  onGround: boolean;
  squawk: string;
  registration?: string;
  aircraftType?: string;
  airline?: string;
  origin?: string;
  destination?: string;
  route?: { origin: RouteAirport; destination: RouteAirport };
  flightNumber?: string;
  lastUpdate: number;
  trail?: [number, number][];
  track?: [number, number][];
}

export interface ATCStream {
  id: string;
  airport: string;
  iata: string;
  icao: string;
  frequency: string;
  name: string;
  region: string;
  country: string;
  streamUrl: string;
  listeners: number;
  isLive: boolean;
}

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface FlightStats {
  totalFlights: number;
  airborne: number;
  onGround: number;
  avgAltitude: number;
  avgSpeed: number;
  topAirlines: { name: string; count: number }[];
  topAircraft: { type: string; count: number }[];
}

export interface SearchResult {
  type: 'flight' | 'airport' | 'airline' | 'registration';
  id: string;
  label: string;
  sublabel: string;
  data: Aircraft | Airport;
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
}
