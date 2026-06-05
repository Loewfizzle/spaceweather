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

// --- NASA Fireball API Response ---
// Note: proxied via /api/fireballs, but we validate the shape here too
export const FireballApiResponseSchema = z.object({
  signature: z.object({
    source: z.string(),
    version: z.string(),
  }).optional(),
  count: z.string().optional(),
  fields: z.array(z.string()),
  data: z.array(z.array(z.unknown())),
});
export type FireballApiResponse = z.infer<typeof FireballApiResponseSchema>;

// Parsed Fireball item (after our transformation)
export const FireballSchema = z.object({
  date: z.string(),
  energy: z.number().nullable(),
  impactE: z.number().nullable(),
  lat: z.number().nullable(),
  latDir: z.string().nullable(),
  lon: z.number().nullable(),
  lonDir: z.string().nullable(),
  alt: z.number().nullable(),
  vel: z.number().nullable(),
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
});
export type CmeSummary = z.infer<typeof CmeSummarySchema>;

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

// Cloud cover from Open-Meteo (used in sky, though section removed)
export const CloudCoverDataSchema = z.object({
  time: z.array(z.string()),
  cloudcover: z.array(z.number()),
});
export type CloudCoverData = z.infer<typeof CloudCoverDataSchema>;
