// Labels for the farmer services (rentals, inputs). Shared by pages and server actions.
export const EQUIPMENT_KINDS: Record<string, { en: string; te: string; icon: string }> = {
  harvester: { en: 'Combine harvester', te: 'హార్వెస్టర్', icon: '🌾' },
  tractor: { en: 'Tractor', te: 'ట్రాక్టర్', icon: '🚜' },
  rotavator: { en: 'Rotavator', te: 'రోటవేటర్', icon: '⚙️' },
  power_tiller: { en: 'Power tiller', te: 'పవర్ టిల్లర్', icon: '🛞' },
  seed_drill: { en: 'Seed drill', te: 'సీడ్ డ్రిల్', icon: '🌱' },
  sprayer: { en: 'Sprayer', te: 'స్ప్రేయర్', icon: '💧' },
  drone: { en: 'Spraying drone', te: 'డ్రోన్', icon: '🛸' },
  thresher: { en: 'Thresher', te: 'నూర్పిడి యంత్రం', icon: '🌀' },
  other: { en: 'Other machine', te: 'ఇతర యంత్రం', icon: '🔧' },
};

export const INPUT_KINDS: Record<string, { en: string; te: string; icon: string }> = {
  seeds: { en: 'Seeds', te: 'విత్తనాలు', icon: '🌱' },
  saplings: { en: 'Saplings and grafts', te: 'మొక్కలు', icon: '🪴' },
  fertiliser: { en: 'Fertiliser', te: 'ఎరువులు', icon: '🧪' },
  bio_inputs: { en: 'Organic and bio inputs', te: 'సేంద్రియ ఎరువులు', icon: '🍂' },
  crop_protection: { en: 'Crop protection', te: 'పంట రక్షణ', icon: '🛡️' },
  tools: { en: 'Tools', te: 'పనిముట్లు', icon: '🧰' },
};

export const CATEGORY_LABELS: Record<string, { en: string; te: string }> = {
  vegetables: { en: 'Vegetables', te: 'కూరగాయలు' }, leafy: { en: 'Leafy greens', te: 'ఆకుకూరలు' }, fruits: { en: 'Fruits', te: 'పండ్లు' },
  grains: { en: 'Grains', te: 'ధాన్యాలు' }, pulses: { en: 'Pulses', te: 'పప్పు ధాన్యాలు' }, spices: { en: 'Spices', te: 'మసాలా పంటలు' },
};
