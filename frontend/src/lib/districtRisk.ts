// Synthetic district-level risk scores layered on real district boundaries
// (source: datta07/INDIAN-SHAPEFILES, India_Districts.geojson, filtered to
// Himachal Pradesh / Kerala / Maharashtra). Scores are illustrative —
// informed by which districts were worst affected in the named historical
// events / are most drought-prone — not an official hazard model output.

// A handful of district names in the HP source file carry character
// corruption from the original shapefile encoding (e.g. "A" -> ">").
const NAME_FIXES: Record<string, string> = {
  'BIL>SPUR': 'BILASPUR',
  'K>NGRA': 'KANGRA',
  'HAM|RPUR': 'HAMIRPUR',
}

export function cleanDistrictName(raw: string) {
  return NAME_FIXES[raw] ?? raw
}

const RISK: Record<string, Record<string, number>> = {
  HP: {
    KULLU: 92,
    MANDI: 85,
    SHIMLA: 80,
    KANGRA: 78,
    SOLAN: 70,
    SIRMAUR: 68,
    CHAMBA: 72,
    HAMIRPUR: 45,
    UNA: 42,
    BILASPUR: 48,
    KINNAUR: 55,
    'LAHUL & SPITI': 30,
  },
  KL: {
    WAYANAD: 88,
    IDUKKI: 90,
    ERNAKULAM: 75,
    PATHANAMTHITTA: 82,
    ALAPPUZHA: 78,
    THRISSUR: 68,
    KOTTAYAM: 60,
    KOLLAM: 55,
    PALAKKAD: 50,
    MALAPPURAM: 52,
    THIRUVANANTHAPURAM: 35,
    KOZHIKODE: 40,
    KANNUR: 32,
    KASARAGOD: 30,
  },
  MH: {
    BEED: 85,
    DHARASHIV: 88,
    LATUR: 86,
    SOLAPUR: 80,
    JALNA: 78,
    PARBHANI: 75,
    NANDED: 70,
    BULDHANA: 72,
    YAVATMAL: 68,
    AHMEDNAGAR: 74,
    AKOLA: 65,
    AMRAVATI: 60,
    HINGOLI: 73,
    WASHIM: 66,
    NASHIK: 40,
    JALGAON: 45,
    SANGLI: 42,
    SATARA: 38,
    CHANDRAPUR: 35,
    NAGPUR: 30,
    'CHHATRAPATI SAMBHAJINAGAR': 55,
    WARDHA: 32,
    GONDIA: 28,
    DHULE: 44,
    NANDURBAR: 46,
    MUMBAI: 15,
    'MUMBAI SUBURBAN': 15,
    THANE: 18,
    PALGHAR: 22,
    RAIGARH: 20,
    RATNAGIRI: 20,
    SINDHUDURG: 18,
    PUNE: 25,
    KOLHAPUR: 24,
    GADCHIROLI: 26,
    BHANDARA: 27,
  },
}

export function getDistrictRisk(stateKey: 'HP' | 'KL' | 'MH' | 'UK', rawDistrictName: string) {
  const name = cleanDistrictName(rawDistrictName).toUpperCase().trim()
  return RISK[stateKey]?.[name] ?? 20
}

export function riskLevel(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 70) return 'High'
  if (score >= 45) return 'Medium'
  return 'Low'
}
