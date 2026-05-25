export function formatAltitude(ft: number): string {
  if (ft === 0) return 'GND';
  return `FL${Math.round(ft / 100)}`;
}

export function formatSpeed(kts: number): string {
  return `${Math.round(kts)} kts`;
}

export function formatHeading(deg: number): string {
  return `${Math.round(deg).toString().padStart(3, '0')}°`;
}

export function formatVerticalRate(rate: number): string {
  if (rate === 0) return 'Level';
  return `${rate > 0 ? '+' : ''}${Math.round(rate * 60)} ft/min`;
}

export function formatCoord(val: number, isLat: boolean): string {
  const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
}

export function getAirlineName(code: string): string {
  const map: Record<string, string> = {
    UAL: 'United Airlines', DAL: 'Delta Air Lines', AAL: 'American Airlines', SWA: 'Southwest Airlines',
    BAW: 'British Airways', DLH: 'Lufthansa', AFR: 'Air France', KLM: 'KLM Royal Dutch',
    QFA: 'Qantas', SIA: 'Singapore Airlines', UAE: 'Emirates', THY: 'Turkish Airlines',
    ANA: 'All Nippon Airways', JAL: 'Japan Airlines', CPA: 'Cathay Pacific',
    ETH: 'Ethiopian Airlines', RYR: 'Ryanair', EZY: 'easyJet', VIR: 'Virgin Atlantic', ACA: 'Air Canada',
  };
  return map[code] || code;
}

export function getAircraftTypeName(code: string): string {
  const map: Record<string, string> = {
    B738: 'Boeing 737-800', A320: 'Airbus A320', B77W: 'Boeing 777-300ER', A359: 'Airbus A350-900',
    B789: 'Boeing 787-9', A21N: 'Airbus A321neo', E190: 'Embraer E190', B752: 'Boeing 757-200',
    A332: 'Airbus A330-200', B748: 'Boeing 747-8', A388: 'Airbus A380-800', B737: 'Boeing 737-700',
    CRJ9: 'Bombardier CRJ-900', E170: 'Embraer E170', A319: 'Airbus A319',
  };
  return map[code] || code;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
