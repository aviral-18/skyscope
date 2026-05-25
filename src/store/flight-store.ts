import { create } from 'zustand';
import { Aircraft, ATCStream, FlightStats } from '@/types/aviation';
import { CommMessage } from '@/lib/pilot-messages';

interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
}

interface FlightStore {
  aircraft: Aircraft[];
  selectedAircraft: Aircraft | null;
  selectedTrack: [number, number][] | null;
  flyToTarget: FlyToTarget | null;
  atcStreams: ATCStream[];
  activeStream: ATCStream | null;
  searchQuery: string;
  isPlaying: boolean;
  volume: number;
  showWeather: boolean;
  showHeatmap: boolean;
  darkMode: boolean;
  sidebarOpen: boolean;
  sidebarTab: 'flights' | 'atc' | 'comms' | 'stats';
  favorites: string[];
  bookmarkedAirports: string[];
  stats: FlightStats;
  commsMessages: CommMessage[];
  commsAutoScroll: boolean;
  dataFreshness: number;
  apiStatus: 'live' | 'cached' | 'error';
  setAircraft: (aircraft: Aircraft[]) => void;
  selectAircraft: (aircraft: Aircraft | null) => void;
  setSelectedTrack: (track: [number, number][] | null) => void;
  setFlyToTarget: (target: FlyToTarget | null) => void;
  setATCStreams: (streams: ATCStream[]) => void;
  setActiveStream: (stream: ATCStream | null) => void;
  setSearchQuery: (query: string) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  toggleWeather: () => void;
  toggleHeatmap: () => void;
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: 'flights' | 'atc' | 'comms' | 'stats') => void;
  toggleFavorite: (icao24: string) => void;
  toggleBookmark: (icao: string) => void;
  computeStats: () => void;
  setCommsMessages: (msgs: CommMessage[]) => void;
  addCommsMessage: (msg: CommMessage) => void;
  toggleCommsAutoScroll: () => void;
  setDataFreshness: (ts: number) => void;
  setApiStatus: (status: 'live' | 'cached' | 'error') => void;
}

export const useFlightStore = create<FlightStore>((set, get) => ({
  aircraft: [],
  selectedAircraft: null,
  selectedTrack: null,
  flyToTarget: null,
  atcStreams: [],
  activeStream: null,
  searchQuery: '',
  isPlaying: false,
  volume: 0.7,
  showWeather: false,
  showHeatmap: false,
  darkMode: true,
  sidebarOpen: true,
  sidebarTab: 'flights',
  favorites: [],
  bookmarkedAirports: [],
  stats: { totalFlights: 0, airborne: 0, onGround: 0, avgAltitude: 0, avgSpeed: 0, topAirlines: [], topAircraft: [] },
  commsMessages: [],
  commsAutoScroll: true,
  dataFreshness: Date.now(),
  apiStatus: 'live',

  setAircraft: (aircraft) => {
    const selected = get().selectedAircraft;
    
    // Merge enriched properties into the new aircraft list so they persist in list/UI
    const enrichedAircraft = aircraft.map(a => {
      if (selected && a.icao24 === selected.icao24) {
        return {
          ...a,
          route: selected.route,
          origin: selected.origin,
          destination: selected.destination,
          aircraftType: selected.aircraftType,
          registration: selected.registration,
          airline: selected.airline,
          flightNumber: selected.flightNumber,
        };
      }
      return a;
    });

    set({ aircraft: enrichedAircraft });

    if (selected) {
      const updated = enrichedAircraft.find(a => a.icao24 === selected.icao24);
      if (updated) set({ selectedAircraft: updated });
    }
  },
  selectAircraft: (aircraft) => {
    set({ selectedAircraft: aircraft, selectedTrack: null });
    // Clear track when deselecting
    if (!aircraft) {
      set({ selectedTrack: null });
      return;
    }

    // Auto-switch to Comms tab so user sees flight-specific feed immediately
    set({ sidebarTab: 'comms' });

    // Fetch REAL accurate data for this aircraft (multi-tier: FR24 → OpenSky → null)
    const params = new URLSearchParams({
      icao24: aircraft.icao24,
      callsign: aircraft.callsign,
      lat: String(aircraft.latitude),
      lng: String(aircraft.longitude),
    });
    fetch(`/api/flight-details?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(details => {
        if (!details) return;
        set(state => {
          if (state.selectedAircraft?.icao24 === aircraft.icao24) {
            const updated = { ...state.selectedAircraft };
            let hasChanges = false;
            
            if (details.route) {
              updated.route = details.route;
              updated.origin = details.route.origin.name;
              updated.destination = details.route.destination.name;
              hasChanges = true;
            }
            if (details.aircraft && details.aircraft.type) {
              updated.aircraftType = `${details.aircraft.manufacturer || ''} ${details.aircraft.type}`.trim();
              if (details.aircraft.registration) updated.registration = details.aircraft.registration;
              if (details.aircraft.operator) updated.airline = details.aircraft.operator;
              hasChanges = true;
            }
            if (details.flightNumber) {
              updated.flightNumber = details.flightNumber;
              hasChanges = true;
            }
            return hasChanges ? { selectedAircraft: updated } : state;
          }
          return state;
        });
      })
      .catch(console.error);
  },
  setSelectedTrack: (track) => set({ selectedTrack: track }),
  setFlyToTarget: (target) => set({ flyToTarget: target }),
  setATCStreams: (streams) => set({ atcStreams: streams }),
  setActiveStream: (stream) => set({ activeStream: stream }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  toggleWeather: () => set(s => ({ showWeather: !s.showWeather })),
  toggleHeatmap: () => set(s => ({ showHeatmap: !s.showHeatmap })),
  toggleDarkMode: () => set(s => ({ darkMode: !s.darkMode })),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  toggleFavorite: (icao24) => set(s => ({
    favorites: s.favorites.includes(icao24) ? s.favorites.filter(f => f !== icao24) : [...s.favorites, icao24]
  })),
  toggleBookmark: (icao) => set(s => ({
    bookmarkedAirports: s.bookmarkedAirports.includes(icao) ? s.bookmarkedAirports.filter(b => b !== icao) : [...s.bookmarkedAirports, icao]
  })),
  computeStats: () => {
    const { aircraft } = get();
    const airborne = aircraft.filter(a => !a.onGround);
    const airlineCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};
    aircraft.forEach(a => {
      if (a.airline) airlineCount[a.airline] = (airlineCount[a.airline] || 0) + 1;
      if (a.aircraftType) typeCount[a.aircraftType] = (typeCount[a.aircraftType] || 0) + 1;
    });
    set({
      stats: {
        totalFlights: aircraft.length,
        airborne: airborne.length,
        onGround: aircraft.length - airborne.length,
        avgAltitude: airborne.length ? airborne.reduce((s, a) => s + a.altitude, 0) / airborne.length : 0,
        avgSpeed: airborne.length ? airborne.reduce((s, a) => s + a.velocity, 0) / airborne.length : 0,
        topAirlines: Object.entries(airlineCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        topAircraft: Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => ({ type, count })),
      }
    });
  },
  setCommsMessages: (msgs) => set({ commsMessages: msgs }),
  addCommsMessage: (msg) => set(s => ({ commsMessages: [...s.commsMessages.slice(-50), msg] })),
  toggleCommsAutoScroll: () => set(s => ({ commsAutoScroll: !s.commsAutoScroll })),
  setDataFreshness: (ts) => set({ dataFreshness: ts }),
  setApiStatus: (status) => set({ apiStatus: status }),
}));
