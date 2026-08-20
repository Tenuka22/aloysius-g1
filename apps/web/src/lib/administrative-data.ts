export type AdministrativeData = {
  districts: string[];
  dsDivisions: string[];
  gnDivisions: string[];
};

const CACHE_KEY = "aloysius-g1:lk-administrative-data:v1";
const CACHE_TTL = 24 * 60 * 60 * 1000;
let cachedPromise: Promise<AdministrativeData> | undefined;

function rows(payload: any): any[] {
  return Array.isArray(payload) ? payload : payload?.data ?? payload?.records ?? payload?.items ?? [];
}

function nameOf(row: any): string | undefined {
  return typeof row?.name === "string" ? row.name : row?.name?.en ?? row?.name_en ?? row?.label;
}

async function fetchAdministrativeData(): Promise<AdministrativeData> {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as { timestamp: number; data: AdministrativeData };
      if (Date.now() - parsed.timestamp < CACHE_TTL) return parsed.data;
    } catch { localStorage.removeItem(CACHE_KEY); }
  }

  const base = "https://raw.githubusercontent.com/open-admin-data/sri-lanka-administrative-divisions/main/data";
  const payloads = await Promise.all(["all-district.json", "all-dsd.json", "all-gnd.json"].map(async (file) => {
    const response = await fetch(`${base}/${file}`);
    if (!response.ok) throw new Error(`Could not load ${file}`);
    return response.json();
  }));
  const data = {
    districts: [...new Set(rows(payloads[0]).map(nameOf).filter(Boolean))] as string[],
    dsDivisions: [...new Set(rows(payloads[1]).map(nameOf).filter(Boolean))] as string[],
    gnDivisions: [...new Set(rows(payloads[2]).map(nameOf).filter(Boolean))] as string[],
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  return data;
}

export function loadAdministrativeData() {
  cachedPromise ??= fetchAdministrativeData();
  return cachedPromise;
}
