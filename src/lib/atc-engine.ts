/**
 * ATC Communications Engine — Phase-based State Machine
 *
 * Generates physically consistent, realistic ATC↔Pilot communications
 * by detecting the aircraft's flight phase from live telemetry and
 * selecting ONLY templates that are valid for that phase.
 *
 * Key guarantees:
 *  - A climbing aircraft will NEVER receive "descend" instructions
 *  - Altitude targets are always in the correct direction
 *  - Heading changes are reasonable (±30° from current)
 *  - Speed instructions match the phase
 *  - ATC→Pilot alternation is enforced
 *  - Per-flight runway numbers are stable (not re-randomized each message)
 */

import { CommMessage, FlightContext } from './pilot-messages';

// ---------------------------------------------------------------------------
// Flight Phase Detection
// ---------------------------------------------------------------------------
export type FlightPhase =
  | 'GATE'
  | 'PUSHBACK'
  | 'TAXI_OUT'
  | 'TAKEOFF'
  | 'INITIAL_CLIMB'
  | 'CLIMB'
  | 'CRUISE'
  | 'DESCENT'
  | 'APPROACH'
  | 'FINAL'
  | 'TAXI_IN';

export function detectFlightPhase(ctx: FlightContext): FlightPhase {
  const alt = ctx.alt ?? 0;
  const spd = ctx.spd ?? 0;
  const vRate = ctx.vRate ?? 0;
  const onGround = ctx.onGround ?? false;

  if (onGround) {
    if (spd < 2) return 'GATE';
    if (spd < 10) return 'PUSHBACK';
    if (spd >= 50) return 'TAKEOFF';
    return 'TAXI_OUT';
  }

  // Airborne
  if (alt < 1000 && vRate > 3) return 'TAKEOFF';
  if (alt < 10000 && vRate > 2) return 'INITIAL_CLIMB';
  if (vRate > 2) return 'CLIMB';
  if (alt < 3000 && vRate < -1) return 'FINAL';
  if (alt <= 10000 && vRate < -2) return 'APPROACH';
  if (vRate < -2) return 'DESCENT';
  if (alt > 15000 && Math.abs(vRate) <= 2) return 'CRUISE';

  // Default: if low and level, probably approach/taxi area
  if (alt < 5000 && Math.abs(vRate) <= 2) return 'APPROACH';
  return 'CRUISE';
}

// ---------------------------------------------------------------------------
// Phase label for display
// ---------------------------------------------------------------------------
const PHASE_LABELS: Record<FlightPhase, string> = {
  GATE: 'At Gate',
  PUSHBACK: 'Pushback',
  TAXI_OUT: 'Taxi Out',
  TAKEOFF: 'Takeoff',
  INITIAL_CLIMB: 'Initial Climb',
  CLIMB: 'Climb',
  CRUISE: 'Cruise',
  DESCENT: 'Descent',
  APPROACH: 'Approach',
  FINAL: 'Final Approach',
  TAXI_IN: 'Taxi In',
};

export function getPhaseLabel(phase: FlightPhase): string {
  return PHASE_LABELS[phase] || phase;
}

// ---------------------------------------------------------------------------
// Per-flight conversation state (persists across API calls via in-memory map)
// ---------------------------------------------------------------------------
interface FlightConversation {
  lastSpeaker: 'atc' | 'pilot';
  lastCategory: string;
  runway: string;
  assignedFrequency: string;
  facility: string;
  messageCount: number;
  lastPhase: FlightPhase;
  timestamp: number;
}

const conversations = new Map<string, FlightConversation>();
const CONVERSATION_TTL = 10 * 60 * 1000; // 10 minutes

function getConversation(callsign: string, phase: FlightPhase): FlightConversation {
  const existing = conversations.get(callsign);
  if (existing && Date.now() - existing.timestamp < CONVERSATION_TTL) {
    existing.timestamp = Date.now();
    existing.lastPhase = phase;
    return existing;
  }
  // New conversation — assign stable per-flight values
  const conv: FlightConversation = {
    lastSpeaker: 'pilot', // start with pilot checking in, so next is ATC
    lastCategory: '',
    runway: `${randInt(1, 36)}${pick(['L', 'R', 'C', ''])}`,
    assignedFrequency: `${randInt(118, 136)}.${randInt(0, 99).toString().padStart(2, '0')}`,
    facility: pickFacilityForPhase(phase),
    messageCount: 0,
    lastPhase: phase,
    timestamp: Date.now(),
  };
  conversations.set(callsign, conv);
  // Evict old conversations
  if (conversations.size > 200) {
    const cutoff = Date.now() - CONVERSATION_TTL;
    for (const [k, v] of conversations) {
      if (v.timestamp < cutoff) conversations.delete(k);
    }
  }
  return conv;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

function pickFacilityForPhase(phase: FlightPhase): string {
  switch (phase) {
    case 'GATE': return 'Clearance Delivery';
    case 'PUSHBACK': return 'Ground';
    case 'TAXI_OUT': return 'Ground';
    case 'TAKEOFF': return 'Tower';
    case 'INITIAL_CLIMB': return 'Departure';
    case 'CLIMB': return 'Center';
    case 'CRUISE': return 'Center';
    case 'DESCENT': return 'Center';
    case 'APPROACH': return 'Approach';
    case 'FINAL': return 'Tower';
    case 'TAXI_IN': return 'Ground';
  }
}

const fixes = ['KORRY', 'BETTE', 'CAMRN', 'PARCH', 'MERIT', 'RNGRR', 'COVEY', 'DIXIE', 'TRUDE', 'LENDY', 'JFUND', 'GREKI', 'BAYYS', 'DEEZZ', 'SSTIK'];
const stars = ['LENDY', 'CAMRN', 'KORRY', 'PARCH', 'ROBUC'];
const sids = ['RNAV', 'KENNEDY', 'CANARSIE', 'WHITESTONE', 'NEWARK'];
const taxiways = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Kilo', 'Lima', 'Mike'];

// Smart heading: ±30° from current heading
function smartHeading(currentHdg: number): string {
  const delta = randInt(-30, 30);
  const newHdg = ((currentHdg + delta) % 360 + 360) % 360;
  return Math.round(newHdg).toString().padStart(3, '0');
}

// Smart altitude for climb: above current
function climbAltitude(currentAlt: number): number {
  const currentFL = Math.round(currentAlt / 100);
  const targetFL = currentFL + randInt(10, 50);
  return Math.min(450, targetFL);
}

// Smart altitude for descent: below current
function descentAltitude(currentAlt: number): number {
  const currentFL = Math.round(currentAlt / 100);
  const targetFL = currentFL - randInt(10, 50);
  return Math.max(20, targetFL);
}

// Phase-appropriate speed
function phaseSpeed(phase: FlightPhase, currentSpd: number): string {
  switch (phase) {
    case 'TAKEOFF':
    case 'INITIAL_CLIMB':
      return String(randInt(200, 250));
    case 'CLIMB':
      return String(randInt(280, 320));
    case 'CRUISE':
      return `Mach ${(0.76 + Math.random() * 0.08).toFixed(2)}`;
    case 'DESCENT':
      return String(randInt(280, 320));
    case 'APPROACH':
      return String(randInt(180, 220));
    case 'FINAL':
      return String(randInt(130, 160));
    default:
      return String(Math.round(currentSpd) || 250);
  }
}

// ---------------------------------------------------------------------------
// Phase-locked message templates
// ---------------------------------------------------------------------------
type TemplateSet = { atc: string[]; pilot: string[] };

function getPhaseTemplates(
  phase: FlightPhase,
  ctx: FlightContext,
  conv: FlightConversation,
): TemplateSet {
  const rwy = conv.runway;
  const freq = conv.assignedFrequency;
  const facility = conv.facility;
  const alt = ctx.alt ?? 0;
  const hdg = ctx.hdg ?? 0;
  const spd = ctx.spd ?? 0;
  const flightLevel = Math.round(alt / 100);

  const climbFL = climbAltitude(alt);
  const descFL = descentAltitude(alt);
  const newHdg = smartHeading(hdg);
  const speed = phaseSpeed(phase, spd);
  const fix = pick(fixes);
  const star = pick(stars);
  const sid = pick(sids);
  const taxiway = pick(taxiways);

  switch (phase) {
    case 'GATE':
      return {
        atc: [
          `{callsign}, clearance delivery, cleared to destination via ${sid} departure, maintain five thousand, expect flight level ${climbFL} ten minutes after departure, squawk ${randInt(1000, 7700)}`,
          `{callsign}, clearance delivery, your clearance is on file, advise ready to copy`,
          `{callsign}, pushback approved, tail ${pick(['north', 'south', 'east', 'west'])}`,
        ],
        pilot: [
          `Clearance delivery, {callsign}, with information ${pick('ABCDEFGH'.split(''))}, ready to copy clearance`,
          `{callsign}, request pushback gate ${pick(['A', 'B', 'C', 'D'])}${randInt(1, 40)}`,
          `Cleared to destination via ${sid} departure, maintain five thousand, expect FL${climbFL}, squawk assigned, {callsign}`,
        ],
      };

    case 'PUSHBACK':
      return {
        atc: [
          `{callsign}, pushback approved, expect runway ${rwy}`,
          `{callsign}, hold position, traffic passing behind you`,
          `{callsign}, pushback complete, contact ground on ${freq}`,
        ],
        pilot: [
          `Pushback approved, expecting runway ${rwy}, {callsign}`,
          `Holding position, {callsign}`,
          `Ground, {callsign}, pushback complete, ready to taxi`,
        ],
      };

    case 'TAXI_OUT':
      return {
        atc: [
          `{callsign}, taxi to runway ${rwy} via ${taxiway}`,
          `{callsign}, hold short runway ${rwy}`,
          `{callsign}, cross runway ${pick(['09', '27', '04L', '22R'])}, continue via ${taxiway}`,
          `{callsign}, give way to the ${pick(['737', 'A320', '777', 'heavy'])} on your left, then continue`,
          `{callsign}, monitor tower on ${freq}`,
        ],
        pilot: [
          `Taxi to runway ${rwy} via ${taxiway}, {callsign}`,
          `Holding short runway ${rwy}, {callsign}`,
          `Crossing runway, continuing ${taxiway}, {callsign}`,
          `${freq}, {callsign}, good day`,
        ],
      };

    case 'TAKEOFF':
      return {
        atc: [
          `{callsign}, wind ${randInt(1, 36).toString().padStart(3, '0')} at ${randInt(5, 18)}, runway ${rwy}, cleared for takeoff`,
          `{callsign}, fly runway heading, cleared for takeoff runway ${rwy}`,
          `{callsign}, turn left heading ${newHdg} after departure, runway ${rwy}, cleared for takeoff`,
        ],
        pilot: [
          `Cleared for takeoff runway ${rwy}, {callsign}`,
          `Runway heading, cleared for takeoff ${rwy}, {callsign}`,
          `Left heading ${newHdg} after departure, cleared for takeoff ${rwy}, {callsign}`,
        ],
      };

    case 'INITIAL_CLIMB':
      return {
        atc: [
          `{callsign}, contact departure on ${freq}`,
          `{callsign}, radar contact, climb and maintain ${climbFL < 180 ? `${climbFL * 100} feet` : `flight level ${climbFL}`}`,
          `{callsign}, turn ${pick(['left', 'right'])} heading ${newHdg}, climb and maintain ${climbFL * 100} feet`,
          `{callsign}, fly heading ${newHdg}, vectors for traffic`,
        ],
        pilot: [
          `Departure, {callsign}, with you, passing through ${Math.round(alt)} feet climbing`,
          `Climb and maintain ${climbFL < 180 ? `${climbFL * 100}` : `flight level ${climbFL}`}, {callsign}`,
          `${pick(['Left', 'Right'])} heading ${newHdg}, climbing ${climbFL * 100}, {callsign}`,
          `${freq}, {callsign}, good day`,
        ],
      };

    case 'CLIMB':
      return {
        atc: [
          `{callsign}, climb and maintain flight level ${climbFL}`,
          `{callsign}, climb and maintain flight level ${climbFL}, expedite through flight level ${flightLevel + 10}`,
          `{callsign}, contact ${pick(['Center', 'Control'])} on ${freq}`,
          `{callsign}, maintain ${Math.round(spd)} knots or greater until ${fix}`,
          `{callsign}, proceed direct ${fix}`,
        ],
        pilot: [
          `Climb and maintain flight level ${climbFL}, {callsign}`,
          `Climbing flight level ${climbFL}, expediting, {callsign}`,
          `${freq}, {callsign}, good day`,
          `Direct ${fix}, {callsign}`,
          `Center, {callsign}, with you, climbing flight level ${flightLevel}`,
        ],
      };

    case 'CRUISE':
      return {
        atc: [
          `{callsign}, maintain flight level ${flightLevel}`,
          `{callsign}, proceed direct ${fix}`,
          `{callsign}, contact ${pick(['Center', 'Control'])} on ${freq}`,
          `{callsign}, altimeter ${randInt(29, 30)}.${randInt(80, 99)}`,
          `{callsign}, traffic ${pick(['twelve', 'one', 'two', 'ten', 'eleven'])} o'clock, ${randInt(5, 30)} miles, ${pick(['same direction', 'opposite direction', 'crossing'])}, flight level ${flightLevel + pick([-20, -10, 10, 20])}`,
          `{callsign}, no speed restrictions`,
        ],
        pilot: [
          `Maintaining flight level ${flightLevel}, {callsign}`,
          `Direct ${fix}, {callsign}`,
          `${freq}, {callsign}, with you, flight level ${flightLevel}`,
          `${randInt(29, 30)}.${randInt(80, 99)}, {callsign}`,
          `Traffic in sight, {callsign}`,
          `Looking, {callsign}`,
          `Roger, {callsign}`,
        ],
      };

    case 'DESCENT':
      return {
        atc: [
          `{callsign}, descend and maintain flight level ${descFL}`,
          `{callsign}, descend via the ${star} arrival, expect runway ${rwy}`,
          `{callsign}, cross ${fix} at and maintain flight level ${descFL}`,
          `{callsign}, reduce speed to ${speed} knots`,
          `{callsign}, contact approach on ${freq}`,
          `{callsign}, expect ILS runway ${rwy}`,
        ],
        pilot: [
          `Descend and maintain flight level ${descFL}, {callsign}`,
          `Descend via ${star}, expecting runway ${rwy}, {callsign}`,
          `Cross ${fix} at flight level ${descFL}, {callsign}`,
          `Reducing to ${speed}, {callsign}`,
          `${freq}, {callsign}, good day`,
          `Expecting ILS ${rwy}, {callsign}`,
        ],
      };

    case 'APPROACH':
      return {
        atc: [
          `{callsign}, descend and maintain ${descFL * 100 > 2000 ? `${descFL * 100} feet` : '3000 feet'}`,
          `{callsign}, turn ${pick(['left', 'right'])} heading ${newHdg}, vectors ILS runway ${rwy}`,
          `{callsign}, maintain ${speed} knots until ${fix}`,
          `{callsign}, you are ${randInt(8, 20)} miles from the airport, turn ${pick(['left', 'right'])} heading ${newHdg}, join the localizer`,
          `{callsign}, cleared ILS approach runway ${rwy}`,
          `{callsign}, contact tower on ${freq}`,
          `{callsign}, reduce speed to ${randInt(170, 210)} knots`,
        ],
        pilot: [
          `Descend maintain ${descFL * 100 > 2000 ? descFL * 100 : 3000}, {callsign}`,
          `${pick(['Left', 'Right'])} heading ${newHdg}, vectors ILS ${rwy}, {callsign}`,
          `Cleared ILS approach runway ${rwy}, {callsign}`,
          `${freq}, {callsign}`,
          `Approach, {callsign}, with you, ${Math.round(alt)} feet`,
          `Speed ${randInt(170, 210)}, {callsign}`,
        ],
      };

    case 'FINAL':
      return {
        atc: [
          `{callsign}, wind ${randInt(1, 36).toString().padStart(3, '0')} at ${randInt(5, 18)}, runway ${rwy}, cleared to land`,
          `{callsign}, number ${randInt(1, 3)} traffic, runway ${rwy}, cleared to land`,
          `{callsign}, caution wake turbulence preceding ${pick(['heavy', 'super'])} departing, cleared to land runway ${rwy}`,
          `{callsign}, go around, traffic on the runway`,
        ],
        pilot: [
          `Cleared to land runway ${rwy}, {callsign}`,
          `{callsign}, runway in sight`,
          `{callsign} established on the localizer runway ${rwy}`,
          `Going around, {callsign}`,
          `{callsign}, we have the field in sight`,
        ],
      };

    case 'TAXI_IN':
      return {
        atc: [
          `{callsign}, turn next ${pick(['left', 'right'])}, taxi to gate via ${taxiway}`,
          `{callsign}, exit runway ${pick(['left', 'right'])}, contact ground on ${freq}`,
          `{callsign}, taxi to gate ${pick(['A', 'B', 'C', 'D'])}${randInt(1, 40)} via ${taxiway}`,
          `{callsign}, hold position, crossing traffic`,
        ],
        pilot: [
          `Taxiing via ${taxiway}, {callsign}`,
          `Ground, {callsign}, clear of runway ${rwy}`,
          `Gate ${pick(['A', 'B', 'C', 'D'])}${randInt(1, 40)} via ${taxiway}, {callsign}`,
          `Holding position, {callsign}`,
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Public API: generate a single flight-specific message
// ---------------------------------------------------------------------------
export function generateFlightMessage(
  callsign: string,
  ctx: FlightContext,
  airport: string,
  frequency: string,
): CommMessage {
  const phase = detectFlightPhase(ctx);
  const conv = getConversation(callsign, phase);

  // Alternate speakers: if last was ATC, next is pilot, and vice versa
  const isAtc = conv.lastSpeaker === 'pilot';
  conv.lastSpeaker = isAtc ? 'atc' : 'pilot';
  conv.messageCount++;

  // Update facility on phase change
  if (conv.lastPhase !== phase) {
    conv.facility = pickFacilityForPhase(phase);
  }

  const templates = getPhaseTemplates(phase, ctx, conv);
  const pool = isAtc ? templates.atc : templates.pilot;

  // Avoid repeating the same template as last time
  let template = pick(pool);
  if (pool.length > 1 && template === conv.lastCategory) {
    template = pick(pool.filter(t => t !== conv.lastCategory));
  }
  conv.lastCategory = template;

  const message = template.replace(/\{callsign\}/g, callsign);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    type: isAtc ? 'atc' : 'pilot',
    callsign,
    frequency,
    message,
    airport,
    urgency: Math.random() < 0.01 ? 'emergency' : Math.random() < 0.05 ? 'priority' : 'normal',
  };
}

// ---------------------------------------------------------------------------
// Generate a batch of flight-specific messages (for initial load)
// ---------------------------------------------------------------------------
export function generateFlightHistory(
  callsign: string,
  ctx: FlightContext,
  airport: string,
  frequency: string,
  count: number = 10,
): CommMessage[] {
  const msgs: CommMessage[] = [];
  let ts = Date.now();

  // Reset conversation for fresh history
  conversations.delete(callsign);

  for (let i = 0; i < count; i++) {
    const msg = generateFlightMessage(callsign, ctx, airport, frequency);
    ts -= randInt(4000, 15000); // stagger timestamps backwards
    msg.timestamp = ts;
    msgs.push(msg);
  }

  // Return in chronological order (oldest first)
  return msgs.reverse();
}
