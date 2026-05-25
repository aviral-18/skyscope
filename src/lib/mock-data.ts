import { Aircraft, ATCStream, Airport } from '@/types/aviation';

const airlines = ['UAL', 'DAL', 'AAL', 'SWA', 'BAW', 'DLH', 'AFR', 'KLM', 'QFA', 'SIA', 'UAE', 'THY', 'ANA', 'JAL', 'CPA', 'ETH', 'RYR', 'EZY', 'VIR', 'ACA'];
const types = ['B738', 'A320', 'B77W', 'A359', 'B789', 'A21N', 'E190', 'B752', 'A332', 'B748', 'A388', 'B737', 'CRJ9', 'E170', 'A319'];
const countries = ['United States', 'United Kingdom', 'Germany', 'France', 'Netherlands', 'Australia', 'Singapore', 'Japan', 'Canada', 'Turkey', 'UAE', 'China', 'India', 'Brazil', 'Mexico'];

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;
const randomFrom = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randomReg = () => {
  const prefixes = ['N', 'G-', 'D-', 'F-', 'VH-', '9V-', 'JA', 'C-', 'TC-', 'A6-'];
  const p = randomFrom(prefixes);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let reg = p;
  for (let i = 0; i < (p.length > 1 ? 4 : 5); i++) reg += chars[Math.floor(Math.random() * chars.length)];
  return reg;
};

export function generateMockAircraft(count: number = 500): Aircraft[] {
  const aircraft: Aircraft[] = [];
  for (let i = 0; i < count; i++) {
    const lat = randomBetween(-60, 70);
    const lng = randomBetween(-170, 170);
    const onGround = Math.random() < 0.05;
    const airline = randomFrom(airlines);
    const flightNum = Math.floor(randomBetween(100, 9999));
    const trail: [number, number][] = [];
    for (let t = 5; t >= 1; t--) {
      trail.push([lat - t * 0.02 * Math.cos(randomBetween(0, Math.PI)), lng - t * 0.02 * Math.sin(randomBetween(0, Math.PI))]);
    }
    aircraft.push({
      icao24: Math.random().toString(16).slice(2, 8),
      callsign: `${airline}${flightNum}`,
      originCountry: randomFrom(countries),
      latitude: lat,
      longitude: lng,
      altitude: onGround ? 0 : randomBetween(5000, 42000),
      velocity: onGround ? randomBetween(0, 30) : randomBetween(180, 520),
      heading: randomBetween(0, 360),
      verticalRate: onGround ? 0 : randomBetween(-15, 15),
      onGround,
      squawk: String(Math.floor(randomBetween(1000, 7777))),
      registration: randomReg(),
      aircraftType: randomFrom(types),
      airline,
      origin: randomFrom(['KJFK', 'EGLL', 'EDDF', 'LFPG', 'EHAM', 'WSSS', 'RJTT', 'VHHH', 'OMDB', 'YSSY', 'CYYZ', 'KLAX', 'KATL', 'KORD', 'KDFW']),
      destination: randomFrom(['KJFK', 'EGLL', 'EDDF', 'LFPG', 'EHAM', 'WSSS', 'RJTT', 'VHHH', 'OMDB', 'YSSY', 'CYYZ', 'KLAX', 'KATL', 'KORD', 'KDFW']),
      lastUpdate: Date.now(),
      trail,
    });
  }
  return aircraft;
}

export function updateMockPositions(aircraft: Aircraft[]): Aircraft[] {
  return aircraft.map(a => {
    if (a.onGround) return { ...a, lastUpdate: Date.now() };
    const headingRad = (a.heading * Math.PI) / 180;
    const speed = a.velocity * 0.0001;
    const newLat = a.latitude + Math.cos(headingRad) * speed;
    const newLng = a.longitude + Math.sin(headingRad) * speed;
    const trail = [...(a.trail || []), [a.latitude, a.longitude] as [number, number]].slice(-20);
    return {
      ...a,
      latitude: Math.max(-85, Math.min(85, newLat)),
      longitude: ((newLng + 540) % 360) - 180,
      heading: a.heading + randomBetween(-2, 2),
      altitude: Math.max(0, a.altitude + a.verticalRate * 10),
      lastUpdate: Date.now(),
      trail,
    };
  });
}

export const mockATCStreams: ATCStream[] = [
  { id: 'kjfk-twr', airport: 'John F. Kennedy Intl', iata: 'JFK', icao: 'KJFK', frequency: '119.100', name: 'JFK Tower', region: 'North America', country: 'United States', streamUrl: '/api/atc/stream/kjfk-twr', listeners: Math.floor(Math.random() * 500) + 100, isLive: true },
  { id: 'egll-app', airport: 'London Heathrow', iata: 'LHR', icao: 'EGLL', frequency: '119.725', name: 'Heathrow Approach', region: 'Europe', country: 'United Kingdom', streamUrl: '/api/atc/stream/egll-app', listeners: Math.floor(Math.random() * 400) + 80, isLive: true },
  { id: 'klax-twr', airport: 'Los Angeles Intl', iata: 'LAX', icao: 'KLAX', frequency: '133.900', name: 'LAX Tower', region: 'North America', country: 'United States', streamUrl: '/api/atc/stream/klax-twr', listeners: Math.floor(Math.random() * 350) + 70, isLive: true },
  { id: 'eddf-app', airport: 'Frankfurt Airport', iata: 'FRA', icao: 'EDDF', frequency: '120.800', name: 'Frankfurt Approach', region: 'Europe', country: 'Germany', streamUrl: '/api/atc/stream/eddf-app', listeners: Math.floor(Math.random() * 300) + 60, isLive: true },
  { id: 'omdb-twr', airport: 'Dubai Intl', iata: 'DXB', icao: 'OMDB', frequency: '118.350', name: 'Dubai Tower', region: 'Middle East', country: 'UAE', streamUrl: '/api/atc/stream/omdb-twr', listeners: Math.floor(Math.random() * 450) + 90, isLive: true },
  { id: 'wsss-app', airport: 'Singapore Changi', iata: 'SIN', icao: 'WSSS', frequency: '119.650', name: 'Changi Approach', region: 'Asia Pacific', country: 'Singapore', streamUrl: '/api/atc/stream/wsss-app', listeners: Math.floor(Math.random() * 250) + 50, isLive: true },
  { id: 'rjtt-twr', airport: 'Tokyo Haneda', iata: 'HND', icao: 'RJTT', frequency: '118.100', name: 'Haneda Tower', region: 'Asia Pacific', country: 'Japan', streamUrl: '/api/atc/stream/rjtt-twr', listeners: Math.floor(Math.random() * 280) + 55, isLive: true },
  { id: 'yssy-app', airport: 'Sydney Kingsford Smith', iata: 'SYD', icao: 'YSSY', frequency: '124.400', name: 'Sydney Approach', region: 'Oceania', country: 'Australia', streamUrl: '/api/atc/stream/yssy-app', listeners: Math.floor(Math.random() * 200) + 40, isLive: true },
  { id: 'katl-twr', airport: 'Hartsfield-Jackson Atlanta', iata: 'ATL', icao: 'KATL', frequency: '119.500', name: 'Atlanta Tower', region: 'North America', country: 'United States', streamUrl: '/api/atc/stream/katl-twr', listeners: Math.floor(Math.random() * 380) + 75, isLive: true },
  { id: 'lfpg-app', airport: 'Paris Charles de Gaulle', iata: 'CDG', icao: 'LFPG', frequency: '121.150', name: 'CDG Approach', region: 'Europe', country: 'France', streamUrl: '/api/atc/stream/lfpg-app', listeners: Math.floor(Math.random() * 320) + 65, isLive: true },
];

export const mockAirports: Airport[] = [
  { icao: 'KJFK', iata: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States', latitude: 40.6413, longitude: -73.7781, elevation: 13 },
  { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom', latitude: 51.4700, longitude: -0.4543, elevation: 83 },
  { icao: 'EDDF', iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', latitude: 50.0379, longitude: 8.5622, elevation: 364 },
  { icao: 'KLAX', iata: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States', latitude: 33.9425, longitude: -118.4081, elevation: 125 },
  { icao: 'OMDB', iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', latitude: 25.2532, longitude: 55.3657, elevation: 62 },
  { icao: 'WSSS', iata: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', latitude: 1.3644, longitude: 103.9915, elevation: 22 },
  { icao: 'RJTT', iata: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japan', latitude: 35.5494, longitude: 139.7798, elevation: 35 },
  { icao: 'YSSY', iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', latitude: -33.9461, longitude: 151.1772, elevation: 21 },
  { icao: 'KATL', iata: 'ATL', name: 'Hartsfield-Jackson Atlanta', city: 'Atlanta', country: 'United States', latitude: 33.6407, longitude: -84.4277, elevation: 1026 },
  { icao: 'LFPG', iata: 'CDG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France', latitude: 49.0097, longitude: 2.5479, elevation: 392 },
];
