const fs = require('fs');
const path = require('path');

// Years: 2021-2033
const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

// Geographies with hierarchical region → sub-region grouping (per spec images)
const regions = {
  "North America": ["U.S.", "Canada"],
  "Europe": ["U.K.", "Germany", "Italy", "France", "Spain", "Russia", "Rest of Europe"],
  "Asia Pacific": ["China", "India", "Japan", "South Korea", "ASEAN", "Australia", "Rest of Asia Pacific"],
  "Latin America": ["Brazil", "Argentina", "Mexico", "Rest of Latin America"],
  "Middle East": ["GCC", "Israel", "Rest of Middle East"],
  "Africa": ["North Africa", "Central Africa", "South Africa"]
};

// Shares within each segment type (must sum to ~1.0).
// Hair removal / Skin Tone / Others are folded into By Application (same hierarchy as Excel) — weights use
// ~1547.9 / 1630.7 clinical vs ~82.8 / 1630.7 consumer split so synthetic totals behave like the workbook.
const APP_CLINICAL_WEIGHT = 1547.9 / 1630.7;
const APP_CONSUMER_WEIGHT = 82.8 / 1630.7;
const APP_CLINICAL_FACTOR = APP_CLINICAL_WEIGHT / 0.95;

const segmentTypes = {
  "By Technology": {
    "Fractional CO₂ Laser": 0.17,
    "Nd:YAG Laser": 0.19,
    "Picosecond laser": 0.16,
    "Erbium (Er:YAG) Laser": 0.14,
    "Diode Laser": 0.18,
    "Alexandrite Laser": 0.16
  },
  "By Modality": {
    "Portable (tabletop/handheld)": 0.38,
    "Standalone": 0.62
  },
  "By Application": {
    "Resurfacing/Mild Resurfacing": 0.10 * APP_CLINICAL_FACTOR,
    "Wrinkles/Fine Lines": 0.11 * APP_CLINICAL_FACTOR,
    "Acne Scars": 0.09 * APP_CLINICAL_FACTOR,
    "Sun Damage": 0.10 * APP_CLINICAL_FACTOR,
    "Vascular Lesions": 0.08 * APP_CLINICAL_FACTOR,
    "Pigmentation/ Mild Pigmentation/ Benign pigmented lesions": 0.10 * APP_CLINICAL_FACTOR,
    "Skin Tightening": 0.10 * APP_CLINICAL_FACTOR,
    "Rosacea": 0.07 * APP_CLINICAL_FACTOR,
    "Tattoo Removal": 0.08 * APP_CLINICAL_FACTOR,
    "Skin Rejuvenation": 0.12 * APP_CLINICAL_FACTOR,
    "Hair removal": 0.42 * APP_CONSUMER_WEIGHT,
    "Skin Tone": 0.35 * APP_CONSUMER_WEIGHT,
    "Others": 0.23 * APP_CONSUMER_WEIGHT
  },
  "By Physician Suitability": {
    "Dermatologists": 0.24,
    "Plastic Surgeons": 0.22,
    "Aesthetic Physicians": 0.21,
    "General Practitioner/Physicians": 0.17,
    "Others (Aspiring Physicians, etc)": 0.16
  },
  "By Setting Type": {
    "Hospitals": 0.36,
    "Dermatology /Aesthetic Clinics": 0.49,
    "Others (Academic and Research Institutes, etc.)": 0.15
  },
  "By Purchase Mode": {
    "Online": 0.43,
    "Offline": 0.57
  },
  "By Pricing Catalog": {
    "Low/Mid (~6000 US$)": 0.64,
    "Premium (More than 6000 US$)": 0.36
  }
};

// Regional base values (USD Million) for 2021 - total market per region (demo scale)
const regionBaseValues = {
  "North America": 120,
  "Europe": 90,
  "Asia Pacific": 50,
  "Latin America": 20,
  "Middle East": 9,
  "Africa": 6
};

// Country share within region (must sum to ~1.0)
const countryShares = {
  "North America": { "U.S.": 0.82, "Canada": 0.18 },
  "Europe": { "U.K.": 0.18, "Germany": 0.22, "Italy": 0.12, "France": 0.16, "Spain": 0.10, "Russia": 0.08, "Rest of Europe": 0.14 },
  "Asia Pacific": { "China": 0.28, "India": 0.12, "Japan": 0.25, "South Korea": 0.12, "ASEAN": 0.10, "Australia": 0.07, "Rest of Asia Pacific": 0.06 },
  "Latin America": { "Brazil": 0.45, "Argentina": 0.15, "Mexico": 0.25, "Rest of Latin America": 0.15 },
  "Middle East": { "GCC": 0.48, "Israel": 0.22, "Rest of Middle East": 0.30 },
  "Africa": { "North Africa": 0.38, "Central Africa": 0.27, "South Africa": 0.35 }
};

// Growth rates (CAGR) per region - slightly different for variety
const regionGrowthRates = {
  "North America": 0.115,
  "Europe": 0.108,
  "Asia Pacific": 0.145,
  "Latin America": 0.125,
  "Middle East": 0.12,
  "Africa": 0.118
};

// Segment-specific growth multipliers (relative to regional base CAGR)
const segmentGrowthMultipliers = {
  "By Technology": {
    "Fractional CO₂ Laser": 1.05,
    "Nd:YAG Laser": 1.04,
    "Picosecond laser": 1.12,
    "Erbium (Er:YAG) Laser": 1.03,
    "Diode Laser": 1.06,
    "Alexandrite Laser": 1.02
  },
  "By Modality": {
    "Portable (tabletop/handheld)": 1.10,
    "Standalone": 0.97
  },
  "By Application": {
    "Resurfacing/Mild Resurfacing": 1.04,
    "Wrinkles/Fine Lines": 1.03,
    "Acne Scars": 1.06,
    "Sun Damage": 1.02,
    "Vascular Lesions": 1.05,
    "Pigmentation/ Mild Pigmentation/ Benign pigmented lesions": 1.04,
    "Skin Tightening": 1.08,
    "Rosacea": 1.05,
    "Tattoo Removal": 1.09,
    "Skin Rejuvenation": 1.03,
    "Hair removal": 1.02,
    "Skin Tone": 1.08,
    "Others": 1.04
  },
  "By Physician Suitability": {
    "Dermatologists": 1.03,
    "Plastic Surgeons": 1.05,
    "Aesthetic Physicians": 1.04,
    "General Practitioner/Physicians": 1.06,
    "Others (Aspiring Physicians, etc)": 1.07
  },
  "By Setting Type": {
    "Hospitals": 0.98,
    "Dermatology /Aesthetic Clinics": 1.05,
    "Others (Academic and Research Institutes, etc.)": 1.02
  },
  "By Purchase Mode": {
    "Online": 1.12,
    "Offline": 0.96
  },
  "By Pricing Catalog": {
    "Low/Mid (~6000 US$)": 1.05,
    "Premium (More than 6000 US$)": 1.04
  }
};

// Volume multiplier: units per USD Million (demo)
const volumePerMillionUSD = 420;

// Seeded pseudo-random for reproducibility
let seed = 42;
function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

function addNoise(value, noiseLevel = 0.03) {
  return value * (1 + (seededRandom() - 0.5) * 2 * noiseLevel);
}

function roundTo1(val) {
  return Math.round(val * 10) / 10;
}

function roundToInt(val) {
  return Math.round(val);
}

function generateTimeSeries(baseValue, growthRate, roundFn) {
  const series = {};
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const rawValue = baseValue * Math.pow(1 + growthRate, i);
    series[year] = roundFn(addNoise(rawValue));
  }
  return series;
}

function generateData(isVolume) {
  const data = {};
  const roundFn = isVolume ? roundToInt : roundTo1;
  const multiplier = isVolume ? volumePerMillionUSD : 1;

  // Generate data for each region and country
  for (const [regionName, countries] of Object.entries(regions)) {
    const regionBase = regionBaseValues[regionName] * multiplier;
    const regionGrowth = regionGrowthRates[regionName];

    // Region-level data
    data[regionName] = {};
    for (const [segType, segments] of Object.entries(segmentTypes)) {
      data[regionName][segType] = {};
      for (const [segName, share] of Object.entries(segments)) {
        const segGrowth = regionGrowth * segmentGrowthMultipliers[segType][segName];
        const segBase = regionBase * share;
        data[regionName][segType][segName] = generateTimeSeries(segBase, segGrowth, roundFn);
      }
    }

    // Add "By Country" for each region
    data[regionName]["By Country"] = {};
    for (const country of countries) {
      const cShare = countryShares[regionName][country];
      // Use a slight variation of region growth per country
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.06;
      const countryBase = regionBase * cShare;
      const countryGrowth = regionGrowth * countryGrowthVariation;
      data[regionName]["By Country"][country] = generateTimeSeries(countryBase, countryGrowth, roundFn);
    }

    // Country-level data
    for (const country of countries) {
      const cShare = countryShares[regionName][country];
      const countryBase = regionBase * cShare;
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.04;
      const countryGrowth = regionGrowth * countryGrowthVariation;

      data[country] = {};
      for (const [segType, segments] of Object.entries(segmentTypes)) {
        data[country][segType] = {};
        for (const [segName, share] of Object.entries(segments)) {
          const segGrowth = countryGrowth * segmentGrowthMultipliers[segType][segName];
          const segBase = countryBase * share;
          // Add slight country-specific variation to segment share
          const shareVariation = 1 + (seededRandom() - 0.5) * 0.1;
          data[country][segType][segName] = generateTimeSeries(segBase * shareVariation, segGrowth, roundFn);
        }
      }
    }
  }

  return data;
}

// Generate both datasets
seed = 42;
const valueData = generateData(false);
seed = 7777;
const volumeData = generateData(true);

// Write files
const outDir = path.join(__dirname, 'public', 'data');
fs.writeFileSync(path.join(outDir, 'value.json'), JSON.stringify(valueData, null, 2));
fs.writeFileSync(path.join(outDir, 'volume.json'), JSON.stringify(volumeData, null, 2));

console.log('Generated value.json and volume.json successfully');
console.log('Value geographies:', Object.keys(valueData).length);
console.log('Volume geographies:', Object.keys(volumeData).length);
console.log('Segment types:', Object.keys(valueData['North America']));
console.log('Sample - North America, By Technology:', JSON.stringify(valueData['North America']['By Technology'], null, 2));
