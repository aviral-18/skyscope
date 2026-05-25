'use client';
import { useEffect, useRef, useCallback } from 'react';
import { useFlightStore } from '@/store/flight-store';

export function useFlightData() {
  const {
    setAircraft, setATCStreams, computeStats,
    setDataFreshness, setApiStatus,
    selectedAircraft, setSelectedTrack,
  } = useFlightStore();
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const trackFetchRef = useRef<string | null>(null);

  // Fetch flights
  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch('/api/flights');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.aircraft) {
        setAircraft(data.aircraft);
        computeStats();
        setDataFreshness(Date.now());
        setApiStatus(data.source === 'live' ? 'live' : data.source === 'cached' ? 'cached' : 'error');
      }
    } catch (e) {
      console.error('Failed to fetch flights:', e);
      setApiStatus('error');
    }
  }, [setAircraft, computeStats, setDataFreshness, setApiStatus]);

  // Fetch ATC streams
  const fetchStreams = useCallback(async () => {
    try {
      const res = await fetch('/api/atc');
      const data = await res.json();
      if (data.streams) setATCStreams(data.streams);
    } catch (e) {
      console.error('Failed to fetch ATC streams:', e);
    }
  }, [setATCStreams]);

  // Poll flights and streams
  useEffect(() => {
    fetchFlights();
    fetchStreams();
    const updateInterval = parseInt(process.env.NEXT_PUBLIC_UPDATE_INTERVAL || '15000');
    intervalRef.current = setInterval(fetchFlights, updateInterval);
    const streamInterval = setInterval(fetchStreams, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(streamInterval);
    };
  }, [fetchFlights, fetchStreams]);

  // Fetch track when selected aircraft changes
  useEffect(() => {
    if (!selectedAircraft) {
      trackFetchRef.current = null;
      return;
    }

    const icao24 = selectedAircraft.icao24;
    if (trackFetchRef.current === icao24) return;
    trackFetchRef.current = icao24;

    const fetchTrack = async () => {
      try {
        const res = await fetch(`/api/track?icao24=${encodeURIComponent(icao24)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.track && Array.isArray(data.track) && data.track.length > 0) {
          // Only update if we're still looking at the same aircraft
          if (trackFetchRef.current === icao24) {
            setSelectedTrack(data.track);
          }
        }
      } catch (e) {
        console.error('Failed to fetch track:', e);
      }
    };

    fetchTrack();
  }, [selectedAircraft, setSelectedTrack]);
}
