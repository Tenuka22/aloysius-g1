import { DivIcon } from "leaflet";
import { MAP_MARKER_COLORS } from "@/lib/g1/school-config";

// Shared between every Leaflet map in the application flow
// (location-step-map.tsx, school-map-picker-map.tsx) so the home pin and the
// applied-to school pin always look identical wherever they appear.
export const SCHOOL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
export const HOME_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;

export function createIcon(svg: string, bgColor: string, borderColor: string, size = 32) {
  return new DivIcon({
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${bgColor};border:2.5px solid ${borderColor};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.25);color:#fff;transform:translateY(-8px)">${svg}<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid ${borderColor}"/></div>`,
  });
}

export const iconHome = createIcon(HOME_SVG, MAP_MARKER_COLORS.home.bg, MAP_MARKER_COLORS.home.border, 34);
export const iconApplied = createIcon(SCHOOL_SVG, MAP_MARKER_COLORS.applied.bg, MAP_MARKER_COLORS.applied.border, 36);
