export const STUDIO_CATEGORIES = [
  "Photo Studio",
  "Film Stage",
  "Podcast Lounge",
  "Music Suite",
  "Workshop",
];

export const BOOKING_STATUS = ["Pending", "Confirmed", "Completed", "Cancelled"];

/**
 * The home page category cards use plural marketing labels ("Photo Studios",
 * "Sound Stages", ...) while listings store the canonical category names.
 * This resolver keeps both spellings working in `?category=` filters.
 */
export const CATEGORY_ALIASES = {
  "photo studio": "Photo Studio",
  "photo studios": "Photo Studio",
  photography: "Photo Studio",
  "film stage": "Film Stage",
  "film stages": "Film Stage",
  "sound stage": "Film Stage",
  "sound stages": "Film Stage",
  "podcast lounge": "Podcast Lounge",
  "podcast lounges": "Podcast Lounge",
  "podcast room": "Podcast Lounge",
  "podcast rooms": "Podcast Lounge",
  "music suite": "Music Suite",
  "music suites": "Music Suite",
  "recording studio": "Music Suite",
  workshop: "Workshop",
  workshops: "Workshop",
  "art workshop": "Workshop",
  "art workshops": "Workshop",
};

export function resolveCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "";
  return CATEGORY_ALIASES[key] || null;
}


export const CATEGORY_PRESETS = [
  {
    name: "Photo Studio",
    label: "Photo Studios",
    icon: "camera",
    blurb: "Cyc walls, seamless backdrops and daylight bays for editorial shoots.",
  },
  {
    name: "Film Stage",
    label: "Sound Stages",
    icon: "clapperboard",
    blurb: "High-ceiling stages with rigging, blackout and silent HVAC.",
  },
  {
    name: "Podcast Lounge",
    label: "Podcast Rooms",
    icon: "mic",
    blurb: "Acoustically treated lounges with mics, mixers and cameras ready.",
  },
  {
    name: "Music Suite",
    label: "Music Suites",
    icon: "music",
    blurb: "Tracking rooms and control rooms tuned for full-band sessions.",
  },
  {
    name: "Workshop",
    label: "Art Workshops",
    icon: "palette",
    blurb: "Mess-friendly benches, sinks and north light for making things.",
  },
];
