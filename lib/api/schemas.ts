import { z } from 'zod';

// ============================================
// Zod Schemas for External Data Sources (and a few internal derived shapes)
// These provide runtime validation + TypeScript inference
// for all NOAA SWPC + NASA + Open-Meteo responses used in AuroraWatch.
// All schemas are intentionally defensive (nullable/optional) to tolerate
// real-world variations, missing fields, or upstream data glitches.
// ============================================

// --- NOAA Planetary K-index ---
export const KpEntrySchema = z.object({
  time_tag: z.string().nullable().optional(),
  Kp: z.number().nullable().optional(),
  a_running: z.number().nullable().optional(),
  station_count: z.number().nullable().optional(),
});
export const KpResponseSchema = z.array(KpEntrySchema);
export type KpEntry = z.infer<typeof KpEntrySchema>;

// --- NOAA OVATION Aurora Data ---
export const OvationResponseSchema = z.object({
  "Observation Time": z.string().optional(),
  "Forecast Time": z.string().optional(),
  "Data Format": z.string().optional(),
  coordinates: z.array(z.array(z.unknown())).optional(), // [lon, lat, prob] - tolerant of partial/missing data; cleaned in filterOvationCoordinates
});
export type OvationResponse = z.infer<typeof OvationResponseSchema>;

// --- NOAA Solar Wind (Plasma + Mag) ---
// These come as string[][] from API, we validate after parsing in fetchers
export const PlasmaEntrySchema = z.object({
  time_tag: z.string().nullable().optional(),
  density: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  temperature: z.number().nullable().optional(),
});
export type PlasmaEntry = z.infer<typeof PlasmaEntrySchema>;

export const MagEntrySchema = z.object({
  time_tag: z.string().nullable().optional(),
  bx_gsm: z.number().nullable().optional(),
  by_gsm: z.number().nullable().optional(),
  bz_gsm: z.number().nullable().optional(),
  lon_gsm: z.number().nullable().optional(),
  lat_gsm: z.number().nullable().optional(),
  bt: z.number().nullable().optional(),
});
export type MagEntry = z.infer<typeof MagEntrySchema>;

// --- NASA JPL CNEOS Fireball API ---
// Raw tabular response: fields array + data rows (values can be null for unrecorded fields).
export const NASAFireballRawSchema = z.object({
  signature: z.object({ source: z.string(), version: z.string() }).optional(),
  count: z.string().optional(),
  fields: z.array(z.string()),
  data: z.array(z.array(z.string().nullable())),
});

// Normalized fireball — parsed from tabular rows in the fetcher.
export const FireballSchema = z.object({
  date: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  energy: z.string().nullable(),  // radiated energy (joules, scientific notation)
  impactE: z.string().nullable(), // impact energy (kt TNT)
  alt: z.string().nullable(),     // peak altitude (km)
  vel: z.string().nullable(),     // velocity (km/s)
});
export type Fireball = z.infer<typeof FireballSchema>;

// --- NOAA X-ray Flares (GOES) ---
export const XrayFlareSchema = z.object({
  time_tag: z.string(),
  satellite: z.number(),
  current_class: z.string().optional(),
  max_class: z.string().optional(),
  begin_time: z.string().optional(),
  max_time: z.string().optional(),
  end_time: z.string().optional(),
  region: z.number().optional(),
});
export type XrayFlare = z.infer<typeof XrayFlareSchema>;

export const AlertSchema = z.object({
  product_id: z.string(),
  issue_datetime: z.string(),
  message: z.string(),
});
export type Alert = z.infer<typeof AlertSchema>;

export const SolarRegionSchema = z.object({
  observed_date: z.string().optional(),
  region: z.number().optional(),
  number_spots: z.number().nullable().optional(),
  // Additional fields from NOAA exist; extra props allowed by Zod by default.
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
});
export type SolarRegion = z.infer<typeof SolarRegionSchema>;

export const CmeSummarySchema = z.object({
  time: z.string(),
  speed: z.number().optional(),
  direction: z.string().optional(),
  earthImpact: z.string().optional(),
  note: z.string(),
  associatedFlare: z.string().optional(),
});
export type CmeSummary = z.infer<typeof CmeSummarySchema>;

// --- NOAA Planetary K-index Forecast ---
// Uses lowercase `kp` field (unlike historical KpEntry which uses uppercase `Kp`)
export const KpForecastEntrySchema = z.object({
  time_tag: z.string().nullable().optional(),
  kp: z.number().nullable().optional(),
  observed: z.string().nullable().optional(), // "observed", "estimated", "predicted"
  noaa_scale: z.string().nullable().optional(),
});
export const KpForecastResponseSchema = z.array(KpForecastEntrySchema);
export type KpForecastEntry = z.infer<typeof KpForecastEntrySchema>;

// Meteor shower (static data, not from external API but for type safety)
export const MeteorShowerSchema = z.object({
  name: z.string(),
  peakMonth: z.number(),
  peakDay: z.number(),
  peakEndMonth: z.number().optional(),
  peakEndDay: z.number().optional(),
  description: z.string(),
  activityLevel: z.string(),
});
export type MeteorShower = z.infer<typeof MeteorShowerSchema>;
