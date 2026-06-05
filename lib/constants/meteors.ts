// lib/constants/meteors.ts
// Static data for major annual meteor showers.
// Used by getNextMeteorShower (pure, no external dependency).

import type { MeteorShower } from "../api/schemas";

export const MAJOR_METEOR_SHOWERS: MeteorShower[] = [
  {
    name: "Quadrantids",
    peakMonth: 1,
    peakDay: 3,
    description: "Sharp, brief peak. Fast meteors best viewed after midnight.",
    activityLevel: "Moderate–High",
  },
  {
    name: "Lyrids",
    peakMonth: 4,
    peakDay: 22,
    description: "Moderate display of fast meteors from Comet Thatcher.",
    activityLevel: "Moderate",
  },
  {
    name: "Eta Aquariids",
    peakMonth: 5,
    peakDay: 6,
    description: "Associated with Halley's Comet; stronger in southern latitudes.",
    activityLevel: "Moderate",
  },
  {
    name: "Perseids",
    peakMonth: 8,
    peakDay: 12,
    peakEndMonth: 8,
    peakEndDay: 13,
    description: "One of the best and most reliable annual showers. High rates of bright meteors.",
    activityLevel: "High",
  },
  {
    name: "Orionids",
    peakMonth: 10,
    peakDay: 21,
    description: "Swift meteors from Halley's Comet debris. Good rates into late night.",
    activityLevel: "Moderate",
  },
  {
    name: "Leonids",
    peakMonth: 11,
    peakDay: 17,
    description: "Can produce occasional meteor storms. Fast and bright.",
    activityLevel: "Moderate–High",
  },
  {
    name: "Geminids",
    peakMonth: 12,
    peakDay: 13,
    peakEndMonth: 12,
    peakEndDay: 14,
    description: "Often considered the best shower of the year. Rich in bright, slow meteors.",
    activityLevel: "High",
  },
];
