export type GenderType = "boys" | "girls" | "mixed";
export type SchoolType = "national" | "provincial";

export interface School { id: string; en: string; si: string; lat: number; lng: number; genderType: GenderType; schoolType: SchoolType; districtId: string; dsId: string; }

export const SCHOOLS: School[] = [
  { id: "st-aloysius-galle",      en: "St. Aloysius' College",            si: "ශා. ඇලෝසියස් විදුහල",            lat: 6.0343, lng: 80.2170, genderType: "boys",  schoolType: "national",   districtId: "galle",  dsId: "galle-fg" },
  { id: "richmond-galle",         en: "Richmond College",                 si: "රිච්මන්ඩ් විද්‍යාලය",            lat: 6.0562, lng: 80.2205, genderType: "boys",  schoolType: "national",   districtId: "galle",  dsId: "galle-fg" },
  { id: "mahinda-galle",          en: "Mahinda College",                  si: "මහින්ද විද්‍යාලය",               lat: 6.0578, lng: 80.2138, genderType: "boys",  schoolType: "national",   districtId: "galle",  dsId: "galle-fg" },
  { id: "sanghamitta-galle",      en: "Sanghamitta Balika Vidyalaya",     si: "සංඝමිත්තා බාලිකා විද්‍යාලය",     lat: 6.0647, lng: 80.2253, genderType: "girls", schoolType: "national",   districtId: "galle",  dsId: "galle-fg" },
  { id: "southlands-galle",       en: "Southlands College",               si: "සවුත්ලන්ඩ් විද්‍යාලය",           lat: 6.0369, lng: 80.2196, genderType: "girls", schoolType: "national",   districtId: "galle",  dsId: "galle-fg" },
  { id: "rippon-galle",           en: "Rippon Girls' College",            si: "රිපන් බාලිකා විද්‍යාලය",         lat: 6.0412, lng: 80.2228, genderType: "girls", schoolType: "provincial", districtId: "galle",  dsId: "galle-fg" },
  { id: "sacred-heart-galle",     en: "Sacred Heart Convent",             si: "ශා. හෘදය කන්‍යාරාම විද්‍යාලය",   lat: 6.0435, lng: 80.2185, genderType: "girls", schoolType: "provincial", districtId: "galle",  dsId: "galle-fg" },
  { id: "vidyaloka-galle",        en: "Vidyaloka College",                si: "විද්‍යාලෝක විද්‍යාලය",           lat: 6.0762, lng: 80.2418, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "galle-fg" },
  { id: "wakwella-mv",            en: "Wakwella Maha Vidyalaya",          si: "වක්වැල්ල මහා විද්‍යාලය",         lat: 6.0830, lng: 80.2530, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "bope-poddala" },
  { id: "dadalla-siddhartha",     en: "Dadalla Siddhartha MV",            si: "දඩල්ල සිද්ධාර්ථ ම.වි.",          lat: 6.0500, lng: 80.2380, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "galle-fg" },
  { id: "unawatuna-mv",           en: "Unawatuna Maha Vidyalaya",         si: "උණවටුන මහා විද්‍යාලය",           lat: 6.0100, lng: 80.2480, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "habaraduwa" },
  { id: "thalpe-mv",              en: "Dalawela/Thalpe MV",               si: "තල්පේ ම.වි.",                    lat: 6.0060, lng: 80.2740, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "habaraduwa" },
  { id: "ahangama-shariputhra",   en: "Ahangama Shariputhra College",     si: "අහංගම ශාරීපුත්‍ර විද්‍යාලය",     lat: 5.9740, lng: 80.3760, genderType: "boys",  schoolType: "provincial", districtId: "galle",  dsId: "imaduwa" },
  { id: "kathaluwa-central",      en: "Kathaluwa Central College",        si: "කතළුව මධ්‍ය විද්‍යාලය",          lat: 5.9620, lng: 80.3830, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "imaduwa" },
  { id: "devananda-ambalangoda",  en: "Devananda College",                si: "දෙවනන්ද විද්‍යාලය",              lat: 6.2354, lng: 80.0538, genderType: "boys",  schoolType: "provincial", districtId: "galle",  dsId: "ambalangoda" },
  { id: "dharmasoka-ambalangoda", en: "Dharmasoka College",               si: "ධර්මසෝකා විද්‍යාලය",             lat: 6.2384, lng: 80.0545, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "ambalangoda" },
  { id: "prajapathi-ambalangoda", en: "Prajapathi Balika Vidyalaya",      si: "ප්‍රඥාපති බාලිකා විද්‍යාලය",     lat: 6.2400, lng: 80.0520, genderType: "girls", schoolType: "provincial", districtId: "galle",  dsId: "ambalangoda" },
  { id: "siddhartha-balapitiya",  en: "Siddhartha Central College",       si: "සිද්ධාර්ථ මධ්‍ය විද්‍යාලය",      lat: 6.2805, lng: 80.0460, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "balapitiya" },
  { id: "karandeniya-central",    en: "Karandeniya Central College",      si: "කරන්දෙණිය මධ්‍ය විද්‍යාලය",      lat: 6.2260, lng: 80.0980, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "karandeniya" },
  { id: "elpitiya-seevali",       en: "Seevali Central College Elpitiya", si: "සීවලී මධ්‍ය විද්‍යාලය",          lat: 6.3040, lng: 80.1500, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "elpitiya" },
  { id: "neluwa-central",         en: "Neluwa Central College",           si: "නෙළුව මධ්‍ය විද්‍යාලය",          lat: 6.2130, lng: 80.2830, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "neluwa" },
  { id: "baddegama-central",      en: "Baddegama Central College",        si: "බද්දේගම මධ්‍ය විද්‍යාලය",        lat: 6.1660, lng: 80.1800, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "baddegama" },
  { id: "gonapinuwala-mv",        en: "Gonapinuwala Maha Vidyalaya",      si: "ගොනාපිනුවල ම.වි.",               lat: 6.2680, lng: 80.1230, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "gonapinuwala" },
  { id: "hikkaduwa-mv",           en: "Hikkaduwa Maha Vidyalaya",         si: "හික්කඩුව ම.වි.",                 lat: 6.1390, lng: 80.1010, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "hikkaduwa" },
  { id: "nagoda-janadipathi",     en: "Janadipathi Vidyalaya Nagoda",     si: "ජනාධිපති වි. නාගොඩ",             lat: 6.1900, lng: 80.2100, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "nagoda" },
  { id: "poddala-central",        en: "Poddala Central College",          si: "පෝද්දල මධ්‍ය විද්‍යාලය",         lat: 6.0930, lng: 80.2300, genderType: "mixed", schoolType: "provincial", districtId: "galle",  dsId: "bope-poddala" },
  { id: "rahula-matara",          en: "Rahula College",                   si: "රාහුල විද්‍යාලය",                lat: 5.9549, lng: 80.5549, genderType: "boys",  schoolType: "national",   districtId: "matara", dsId: "matara-ds" },
  { id: "st-thomas-matara",       en: "St. Thomas' College",              si: "ශා. තෝමස් විද්‍යාලය",            lat: 5.9480, lng: 80.5360, genderType: "boys",  schoolType: "national",   districtId: "matara", dsId: "matara-ds" },
  { id: "st-servatius-matara",    en: "St. Servatius' College",           si: "ශා. සර්වේෂියස් විද්‍යාලය",       lat: 5.9430, lng: 80.5400, genderType: "boys",  schoolType: "national",   districtId: "matara", dsId: "matara-ds" },
  { id: "sujatha-matara",         en: "Sujatha Vidyalaya",                si: "සුජාතා විද්‍යාලය",               lat: 5.9520, lng: 80.5460, genderType: "girls", schoolType: "national",   districtId: "matara", dsId: "matara-ds" },
  { id: "st-thomas-girls-matara", en: "St. Thomas' Girls' High School",   si: "ශා. තෝමස් බාලිකා විද්‍යාලය",     lat: 5.9460, lng: 80.5340, genderType: "girls", schoolType: "national",   districtId: "matara", dsId: "matara-ds" },
  { id: "matara-central",         en: "Matara Central College",           si: "මාතර මධ්‍ය විද්‍යාලය",           lat: 5.9620, lng: 80.5390, genderType: "mixed", schoolType: "national",   districtId: "matara", dsId: "matara-ds" },
  { id: "sariputhra-pamburana",   en: "Sariputhra Vidyalaya Pamburana",   si: "සාරිපුත්‍ර වි. පම්බුරාන",        lat: 5.9600, lng: 80.5580, genderType: "mixed", schoolType: "provincial", districtId: "matara", dsId: "matara-ds" },
  { id: "mihindu-talpavila",      en: "Mihindu Vidyalaya Talpavila",      si: "මිහිඳු වි. තල්පාවිල",            lat: 5.9700, lng: 80.5420, genderType: "mixed", schoolType: "provincial", districtId: "matara", dsId: "matara-ds" },
  { id: "weligama-stmary",        en: "St. Mary's Convent Weligama",      si: "ශා. මරියා කන්‍යාරාම වි. වැලිගම", lat: 5.9750, lng: 80.4300, genderType: "girls", schoolType: "provincial", districtId: "matara", dsId: "weligama" },
  { id: "mirissa-mv",             en: "Mirissa Maha Vidyalaya",           si: "මිරිස්ස ම.වි.",                  lat: 5.9480, lng: 80.4730, genderType: "mixed", schoolType: "provincial", districtId: "matara", dsId: "weligama" },
  { id: "dickwella-central",      en: "Dickwella Central College",        si: "දික්වැල්ල මධ්‍ය විද්‍යාලය",      lat: 5.9100, lng: 80.6500, genderType: "mixed", schoolType: "provincial", districtId: "matara", dsId: "dickwella" },
  { id: "akuressa-central",       en: "Akuressa Central College",         si: "අකුරැස්ස මධ්‍ය විද්‍යාලය",       lat: 6.1050, lng: 80.5200, genderType: "mixed", schoolType: "provincial", districtId: "matara", dsId: "akuressa" },
  { id: "kamburupitiya-central",  en: "Kamburupitiya Central College",    si: "කඹුරුපිටිය මධ්‍ය විද්‍යාලය",     lat: 6.0780, lng: 80.5630, genderType: "mixed", schoolType: "provincial", districtId: "matara", dsId: "kamburupitiya" },
  { id: "morawaka-central",       en: "Morawaka Central College",         si: "මොරවක මධ්‍ය විද්‍යාලය",          lat: 6.1120, lng: 80.4930, genderType: "mixed", schoolType: "provincial", districtId: "matara", dsId: "kotapola" },
];

export const HOME_SCHOOL_ID = "st-aloysius-galle";
