export interface CommMessage {
  id: string;
  timestamp: number;
  type: 'atc' | 'pilot';
  callsign: string;
  frequency: string;
  message: string;
  airport: string;
  urgency: 'normal' | 'priority' | 'emergency';
}

export interface FlightContext {
  alt?: number;
  spd?: number;
  hdg?: number;
  vRate?: number;
  onGround?: boolean;
}


const atcPhrases = {
  clearance: [
    '{callsign}, cleared to {dest} airport via {route}, maintain {alt}, expect flight level {cruiseAlt} ten minutes after departure, squawk {squawk}',
    '{callsign}, cleared for takeoff runway {runway}, wind {wind}',
    '{callsign}, cleared ILS approach runway {runway}',
    '{callsign}, cleared visual approach runway {runway}, traffic in sight',
    '{callsign}, cleared to land runway {runway}, wind {wind}',
  ],
  altitude: [
    '{callsign}, descend and maintain flight level {alt}',
    '{callsign}, climb and maintain flight level {alt}',
    '{callsign}, descend via the {star} arrival, expect runway {runway}',
    '{callsign}, cross {fix} at and maintain flight level {alt}',
    '{callsign}, maintain flight level {alt}, expect higher in {time} miles',
  ],
  heading: [
    '{callsign}, turn left heading {hdg}',
    '{callsign}, turn right heading {hdg}',
    '{callsign}, fly heading {hdg}, vectors for the ILS runway {runway}',
    '{callsign}, fly present heading, expect vectors runway {runway}',
  ],
  speed: [
    '{callsign}, reduce speed to {speed} knots',
    '{callsign}, increase speed to {speed} knots',
    '{callsign}, maintain {speed} knots until {fix}',
    '{callsign}, no speed restrictions',
    '{callsign}, resume normal speed',
  ],
  frequency: [
    '{callsign}, contact {facility} on {freq}',
    '{callsign}, monitor {facility} on {freq}',
    '{callsign}, squawk {squawk} and ident',
    '{callsign}, radar contact, {alt} feet',
  ],
  ground: [
    '{callsign}, taxi to runway {runway} via {taxiway}',
    '{callsign}, hold short runway {runway}',
    '{callsign}, cross runway {runway}',
    '{callsign}, taxi to gate {gate} via {taxiway}',
    '{callsign}, give way to the {type} on your left',
    '{callsign}, pushback approved, tail north',
  ],
  approach: [
    '{callsign}, turn base, report runway in sight',
    '{callsign}, number {seq} for the runway, follow the {type} on short final',
    '{callsign}, extend downwind, I\'ll call your base',
    '{callsign}, go around, traffic on the runway',
    '{callsign}, wind check {wind}, cleared to land runway {runway}',
  ],
};

const pilotPhrases = {
  readback: [
    'Descend maintain flight level {alt}, {callsign}',
    'Climb maintain flight level {alt}, {callsign}',
    'Left heading {hdg}, {callsign}',
    'Right heading {hdg}, {callsign}',
    '{freq}, {callsign}, good day',
    'Cleared to land runway {runway}, {callsign}',
    'Cleared for takeoff runway {runway}, {callsign}',
    'Roger, {callsign}',
    'Wilco, {callsign}',
  ],
  request: [
    '{facility}, {callsign}, requesting flight level {alt}',
    '{facility}, {callsign}, requesting direct {fix}',
    '{facility}, {callsign}, requesting deviation {dir} of course for weather',
    '{facility}, {callsign}, ready for departure runway {runway}',
    '{facility}, {callsign} with you, flight level {alt}',
    '{facility}, {callsign}, request ILS runway {runway}',
    '{facility}, {callsign}, we have the field in sight',
    '{facility}, {callsign}, ready to copy clearance',
  ],
  report: [
    '{facility}, {callsign}, checking in flight level {alt}',
    '{callsign} is established on the localizer runway {runway}',
    '{callsign}, runway in sight',
    '{callsign}, traffic in sight',
    'Negative contact, {callsign}',
    '{callsign}, going around',
    '{callsign}, we\'re on the go',
    '{callsign}, field in sight, request visual',
  ],
};

const defaultCallsigns = [
  'United 472', 'Delta 1583', 'American 891', 'Southwest 3421', 'British 178',
  'Lufthansa 456', 'Air France 082', 'KLM 642', 'Qantas 94', 'Singapore 321',
  'Emirates 215', 'Turkish 1990', 'Speedbird 294', 'Cactus 1549', 'JetBlue 627',
  'Alaska 337', 'Spirit 814', 'Frontier 992', 'Hawaiian 51', 'Scandinavian 911',
  'Cathay 880', 'Japan Air 6', 'Korean 23', 'AeroMexico 404', 'Air Canada 856',
  'Ryanair 4472', 'EasyJet 73GK', 'Virgin 45', 'Etihad 183', 'Qatar 77',
];

const facilities = ['Tower', 'Ground', 'Approach', 'Departure', 'Center', 'Clearance Delivery'];
const fixes = ['KORRY', 'BETTE', 'CAMRN', 'PARCH', 'MERIT', 'RNGRR', 'COVEY', 'DIXIE', 'TRUDE', 'LENDY', 'JFUND', 'GREKI', 'BAYYS', 'DEEZZ', 'SSTIK'];
const stars = ['LENDY', 'CAMRN', 'KORRY', 'PARCH', 'ROBUC'];
const routes = ['RNAV', 'DEPART SID', 'direct', 'jet route J75', 'Victor 16'];
const taxiways = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Kilo', 'Lima', 'Mike'];
const types = ['737', 'A320', '777', 'CRJ', 'Embraer', 'A380', '787', '757', 'heavy'];
const airports = ['KJFK', 'EGLL', 'KLAX', 'EDDF', 'OMDB', 'WSSS', 'RJTT', 'YSSY', 'KATL', 'LFPG'];

const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

function fillTemplate(template: string, fixedCallsign?: string, ctx?: FlightContext): string {
  const callsign = fixedCallsign || pick(defaultCallsigns);
  
  let result = template
    .replace(/\{callsign\}/g, callsign)
    .replace(/\{dest\}/g, pick(airports))
    .replace(/\{route\}/g, pick(routes))
    .replace(/\{squawk\}/g, String(randInt(1000, 7700)))
    .replace(/\{runway\}/g, `${randInt(1, 36)}${pick(['L', 'R', 'C', ''])}`)
    .replace(/\{wind\}/g, `${randInt(1, 36).toString().padStart(3, '0')} at ${randInt(5, 25)}`)
    .replace(/\{freq\}/g, `${randInt(118, 136)}.${randInt(0, 99).toString().padStart(2, '0')}`)
    .replace(/\{fix\}/g, pick(fixes))
    .replace(/\{star\}/g, pick(stars))
    .replace(/\{facility\}/g, pick(facilities))
    .replace(/\{taxiway\}/g, pick(taxiways))
    .replace(/\{gate\}/g, `${pick(['A', 'B', 'C', 'D'])}${randInt(1, 40)}`)
    .replace(/\{type\}/g, pick(types))
    .replace(/\{seq\}/g, String(randInt(2, 8)))
    .replace(/\{time\}/g, String(randInt(5, 30)))
    .replace(/\{dir\}/g, pick(['left', 'right']));

  if (ctx) {
    const flightLevel = ctx.alt !== undefined ? Math.round(ctx.alt / 100) : randInt(30, 410);
    const speed = ctx.spd !== undefined ? Math.round(ctx.spd) : randInt(180, 320);
    const heading = ctx.hdg !== undefined ? Math.round(ctx.hdg).toString().padStart(3, '0') : randInt(1, 360).toString().padStart(3, '0');
    
    result = result
      .replace(/\{alt\}/g, String(flightLevel))
      .replace(/\{cruiseAlt\}/g, String(flightLevel + randInt(20, 50)))
      .replace(/\{speed\}/g, String(speed))
      .replace(/\{hdg\}/g, heading);
  } else {
    result = result
      .replace(/\{alt\}/g, String(randInt(30, 410)))
      .replace(/\{cruiseAlt\}/g, String(randInt(300, 410)))
      .replace(/\{speed\}/g, String(randInt(180, 320)))
      .replace(/\{hdg\}/g, randInt(1, 360).toString().padStart(3, '0'));
  }
  return result;
}

import { generateFlightMessage, generateFlightHistory } from './atc-engine';

/**
 * Generate a single comm message for GLOBAL chatter (no specific flight).
 * Used only when no flight is selected.
 */
function generateGlobalSingle(airport: string, frequency: string): CommMessage {
  const isAtc = Math.random() < 0.55;
  const categories = isAtc ? Object.keys(atcPhrases) : Object.keys(pilotPhrases);
  const categoryStr = pick(categories);

  const phrases = isAtc
    ? (atcPhrases[categoryStr as keyof typeof atcPhrases] || atcPhrases.altitude)
    : (pilotPhrases[categoryStr as keyof typeof pilotPhrases] || pilotPhrases.report);

  const template = pick(phrases);
  const message = fillTemplate(template);

  const callsignMatch = message.match(/(?:United|Delta|American|Southwest|British|Lufthansa|Air France|KLM|Qantas|Singapore|Emirates|Turkish|Speedbird|Cactus|JetBlue|Alaska|Spirit|Frontier|Hawaiian|Scandinavian|Cathay|Japan Air|Korean|AeroMexico|Air Canada|Ryanair|EasyJet|Virgin|Etihad|Qatar)\s+\S+/);
  const callsignUsed = callsignMatch ? callsignMatch[0] : pick(defaultCallsigns);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    type: isAtc ? 'atc' : 'pilot',
    callsign: callsignUsed,
    frequency,
    message,
    airport,
    urgency: Math.random() < 0.02 ? 'emergency' : Math.random() < 0.08 ? 'priority' : 'normal',
  };
}

/**
 * Generate a batch of comm messages.
 * - If flightCallsign is provided → uses the phase-based ATC engine
 * - Otherwise → generates random global chatter
 */
export function generateCommsMessages(
  airport: string = 'KJFK',
  frequency: string = '119.100',
  count: number = 8,
  flightCallsign?: string,
  ctx?: FlightContext,
): CommMessage[] {
  // Flight-specific: delegate to the phase-based engine
  if (flightCallsign && ctx) {
    return generateFlightHistory(flightCallsign, ctx, airport, frequency, count);
  }

  // Global chatter
  const msgs: CommMessage[] = [];
  let currentTime = Date.now();
  for (let i = 0; i < count; i++) {
    const msg = generateGlobalSingle(airport, frequency);
    currentTime = currentTime - randInt(3000, 12000);
    msg.timestamp = currentTime;
    msgs.push(msg);
  }
  return msgs.reverse();
}

/**
 * Generate a single new message.
 * - If flightCallsign is provided → uses the phase-based ATC engine
 * - Otherwise → generates random global chatter
 */
export function generateNewMessage(
  airport: string = 'KJFK',
  frequency: string = '119.100',
  flightCallsign?: string,
  ctx?: FlightContext,
): CommMessage {
  if (flightCallsign && ctx) {
    return generateFlightMessage(flightCallsign, ctx, airport, frequency);
  }
  return generateGlobalSingle(airport, frequency);
}

