// ── Location Data ─────────────────────────────────────────────────────────────
// A curated list of countries, states/regions, and major cities.
// Particularly comprehensive for African countries — specifically Nigeria.

export interface Country {
  code: string;
  name: string;
}

export interface State {
  code: string;
  name: string;
  countryCode: string;
}

export interface City {
  name: string;
  stateCode: string;
  countryCode: string;
}

// ── Countries ──────────────────────────────────────────────────────────────────

export const COUNTRIES: Country[] = [
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "ET", name: "Ethiopia" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "CM", name: "Cameroon" },
  { code: "SN", name: "Senegal" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "IN", name: "India" },
];

// ── States / Regions ───────────────────────────────────────────────────────────

export const STATES: State[] = [
  // Nigeria — all 36 states + FCT
  { code: "AB", name: "Abia", countryCode: "NG" },
  { code: "AD", name: "Adamawa", countryCode: "NG" },
  { code: "AK", name: "Akwa Ibom", countryCode: "NG" },
  { code: "AN", name: "Anambra", countryCode: "NG" },
  { code: "BA", name: "Bauchi", countryCode: "NG" },
  { code: "BY", name: "Bayelsa", countryCode: "NG" },
  { code: "BE", name: "Benue", countryCode: "NG" },
  { code: "BO", name: "Borno", countryCode: "NG" },
  { code: "CR", name: "Cross River", countryCode: "NG" },
  { code: "DE", name: "Delta", countryCode: "NG" },
  { code: "EB", name: "Ebonyi", countryCode: "NG" },
  { code: "ED", name: "Edo", countryCode: "NG" },
  { code: "EK", name: "Ekiti", countryCode: "NG" },
  { code: "EN", name: "Enugu", countryCode: "NG" },
  { code: "FC", name: "FCT — Abuja", countryCode: "NG" },
  { code: "GO", name: "Gombe", countryCode: "NG" },
  { code: "IM", name: "Imo", countryCode: "NG" },
  { code: "JI", name: "Jigawa", countryCode: "NG" },
  { code: "KD", name: "Kaduna", countryCode: "NG" },
  { code: "KN", name: "Kano", countryCode: "NG" },
  { code: "KT", name: "Katsina", countryCode: "NG" },
  { code: "KB", name: "Kebbi", countryCode: "NG" },
  { code: "KO", name: "Kogi", countryCode: "NG" },
  { code: "KW", name: "Kwara", countryCode: "NG" },
  { code: "LA", name: "Lagos", countryCode: "NG" },
  { code: "NA", name: "Nasarawa", countryCode: "NG" },
  { code: "NI", name: "Niger", countryCode: "NG" },
  { code: "OG", name: "Ogun", countryCode: "NG" },
  { code: "ON", name: "Ondo", countryCode: "NG" },
  { code: "OS", name: "Osun", countryCode: "NG" },
  { code: "OY", name: "Oyo", countryCode: "NG" },
  { code: "PL", name: "Plateau", countryCode: "NG" },
  { code: "RI", name: "Rivers", countryCode: "NG" },
  { code: "SO", name: "Sokoto", countryCode: "NG" },
  { code: "TA", name: "Taraba", countryCode: "NG" },
  { code: "YO", name: "Yobe", countryCode: "NG" },
  { code: "ZA", name: "Zamfara", countryCode: "NG" },

  // Ghana
  { code: "AH", name: "Ashanti", countryCode: "GH" },
  { code: "GT", name: "Greater Accra", countryCode: "GH" },
  { code: "WE", name: "Western", countryCode: "GH" },
  { code: "CE", name: "Central", countryCode: "GH" },
  { code: "EP", name: "Eastern", countryCode: "GH" },
  { code: "NR", name: "Northern", countryCode: "GH" },
  { code: "UE", name: "Upper East", countryCode: "GH" },
  { code: "UW", name: "Upper West", countryCode: "GH" },
  { code: "VR", name: "Volta", countryCode: "GH" },

  // Kenya
  { code: "NB", name: "Nairobi", countryCode: "KE" },
  { code: "KI", name: "Kikuyu", countryCode: "KE" },
  { code: "MS", name: "Mombasa", countryCode: "KE" },
  { code: "KS", name: "Kisumu", countryCode: "KE" },
  { code: "NK", name: "Nakuru", countryCode: "KE" },

  // South Africa
  { code: "GP", name: "Gauteng", countryCode: "ZA" },
  { code: "WC", name: "Western Cape", countryCode: "ZA" },
  { code: "KZ", name: "KwaZulu-Natal", countryCode: "ZA" },
  { code: "EC", name: "Eastern Cape", countryCode: "ZA" },
  { code: "LP", name: "Limpopo", countryCode: "ZA" },
  { code: "MP", name: "Mpumalanga", countryCode: "ZA" },
  { code: "FS", name: "Free State", countryCode: "ZA" },
  { code: "NC", name: "Northern Cape", countryCode: "ZA" },
  { code: "NW", name: "North West", countryCode: "ZA" },

  // United States (selected)
  { code: "CA", name: "California", countryCode: "US" },
  { code: "NY", name: "New York", countryCode: "US" },
  { code: "TX", name: "Texas", countryCode: "US" },
  { code: "FL", name: "Florida", countryCode: "US" },
  { code: "GA", name: "Georgia", countryCode: "US" },
  { code: "IL", name: "Illinois", countryCode: "US" },
  { code: "WA", name: "Washington", countryCode: "US" },
  { code: "TN", name: "Tennessee", countryCode: "US" },
  { code: "NC", name: "North Carolina", countryCode: "US" },

  // United Kingdom
  { code: "ENG", name: "England", countryCode: "GB" },
  { code: "SCT", name: "Scotland", countryCode: "GB" },
  { code: "WLS", name: "Wales", countryCode: "GB" },
  { code: "NIR", name: "Northern Ireland", countryCode: "GB" },

  // Canada
  { code: "ON", name: "Ontario", countryCode: "CA" },
  { code: "QC", name: "Quebec", countryCode: "CA" },
  { code: "BC", name: "British Columbia", countryCode: "CA" },
  { code: "AB", name: "Alberta", countryCode: "CA" },
];

// ── Cities ─────────────────────────────────────────────────────────────────────

export const CITIES: City[] = [
  // Lagos
  { name: "Lagos Island", stateCode: "LA", countryCode: "NG" },
  { name: "Ikeja", stateCode: "LA", countryCode: "NG" },
  { name: "Lekki", stateCode: "LA", countryCode: "NG" },
  { name: "Victoria Island", stateCode: "LA", countryCode: "NG" },
  { name: "Surulere", stateCode: "LA", countryCode: "NG" },
  { name: "Yaba", stateCode: "LA", countryCode: "NG" },
  { name: "Ajah", stateCode: "LA", countryCode: "NG" },
  { name: "Badagry", stateCode: "LA", countryCode: "NG" },
  { name: "Epe", stateCode: "LA", countryCode: "NG" },
  { name: "Ikorodu", stateCode: "LA", countryCode: "NG" },
  { name: "Mushin", stateCode: "LA", countryCode: "NG" },
  { name: "Oshodi", stateCode: "LA", countryCode: "NG" },

  // FCT Abuja
  { name: "Abuja", stateCode: "FC", countryCode: "NG" },
  { name: "Garki", stateCode: "FC", countryCode: "NG" },
  { name: "Wuse", stateCode: "FC", countryCode: "NG" },
  { name: "Maitama", stateCode: "FC", countryCode: "NG" },
  { name: "Asokoro", stateCode: "FC", countryCode: "NG" },
  { name: "Gwarinpa", stateCode: "FC", countryCode: "NG" },

  // Rivers
  { name: "Port Harcourt", stateCode: "RI", countryCode: "NG" },
  { name: "Bonny", stateCode: "RI", countryCode: "NG" },
  { name: "Obio-Akpor", stateCode: "RI", countryCode: "NG" },

  // Kano
  { name: "Kano City", stateCode: "KN", countryCode: "NG" },
  { name: "Wudil", stateCode: "KN", countryCode: "NG" },
  { name: "Gaya", stateCode: "KN", countryCode: "NG" },

  // Kaduna
  { name: "Kaduna", stateCode: "KD", countryCode: "NG" },
  { name: "Zaria", stateCode: "KD", countryCode: "NG" },

  // Oyo
  { name: "Ibadan", stateCode: "OY", countryCode: "NG" },
  { name: "Ogbomosho", stateCode: "OY", countryCode: "NG" },
  { name: "Oyo", stateCode: "OY", countryCode: "NG" },

  // Enugu
  { name: "Enugu", stateCode: "EN", countryCode: "NG" },
  { name: "Nsukka", stateCode: "EN", countryCode: "NG" },

  // Anambra
  { name: "Awka", stateCode: "AN", countryCode: "NG" },
  { name: "Onitsha", stateCode: "AN", countryCode: "NG" },
  { name: "Nnewi", stateCode: "AN", countryCode: "NG" },

  // Delta
  { name: "Asaba", stateCode: "DE", countryCode: "NG" },
  { name: "Warri", stateCode: "DE", countryCode: "NG" },
  { name: "Sapele", stateCode: "DE", countryCode: "NG" },

  // Edo
  { name: "Benin City", stateCode: "ED", countryCode: "NG" },
  { name: "Auchi", stateCode: "ED", countryCode: "NG" },

  // Taraba
  { name: "Jalingo", stateCode: "TA", countryCode: "NG" },
  { name: "Wukari", stateCode: "TA", countryCode: "NG" },

  // Ghana cities
  { name: "Accra", stateCode: "GT", countryCode: "GH" },
  { name: "Kumasi", stateCode: "AH", countryCode: "GH" },
  { name: "Takoradi", stateCode: "WE", countryCode: "GH" },
  { name: "Tamale", stateCode: "NR", countryCode: "GH" },

  // Kenya cities
  { name: "Nairobi", stateCode: "NB", countryCode: "KE" },
  { name: "Mombasa", stateCode: "MS", countryCode: "KE" },
  { name: "Kisumu", stateCode: "KS", countryCode: "KE" },

  // South Africa cities
  { name: "Johannesburg", stateCode: "GP", countryCode: "ZA" },
  { name: "Pretoria", stateCode: "GP", countryCode: "ZA" },
  { name: "Cape Town", stateCode: "WC", countryCode: "ZA" },
  { name: "Durban", stateCode: "KZ", countryCode: "ZA" },

  // US cities
  { name: "Los Angeles", stateCode: "CA", countryCode: "US" },
  { name: "San Francisco", stateCode: "CA", countryCode: "US" },
  { name: "New York City", stateCode: "NY", countryCode: "US" },
  { name: "Houston", stateCode: "TX", countryCode: "US" },
  { name: "Miami", stateCode: "FL", countryCode: "US" },
  { name: "Atlanta", stateCode: "GA", countryCode: "US" },
  { name: "Nashville", stateCode: "TN", countryCode: "US" },

  // UK cities
  { name: "London", stateCode: "ENG", countryCode: "GB" },
  { name: "Manchester", stateCode: "ENG", countryCode: "GB" },
  { name: "Birmingham", stateCode: "ENG", countryCode: "GB" },
  { name: "Edinburgh", stateCode: "SCT", countryCode: "GB" },

  // Canada cities
  { name: "Toronto", stateCode: "ON", countryCode: "CA" },
  { name: "Ottawa", stateCode: "ON", countryCode: "CA" },
  { name: "Montreal", stateCode: "QC", countryCode: "CA" },
  { name: "Vancouver", stateCode: "BC", countryCode: "CA" },
  { name: "Calgary", stateCode: "AB", countryCode: "CA" },
];

// ── Helper functions ───────────────────────────────────────────────────────────

export function getStatesByCountry(countryCode: string): State[] {
  return STATES.filter((s) => s.countryCode === countryCode);
}

export function getCitiesByState(stateCode: string, countryCode: string): City[] {
  return CITIES.filter(
    (c) => c.stateCode === stateCode && c.countryCode === countryCode
  );
}
