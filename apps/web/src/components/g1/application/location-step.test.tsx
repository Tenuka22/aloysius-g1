// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocationStep } from "./location-step";

type LocationValue = { label: string; address: string; latitude: number | null; longitude: number | null; source: "manual" | "device" | "map" | "" };

const { geolocationMock, fetchMock, mapMock } = vi.hoisted(() => ({
  geolocationMock: { getCurrentPosition: vi.fn(), watchPosition: vi.fn(), clearWatch: vi.fn() },
  fetchMock: vi.fn(),
  mapMock: {
    flyTo: vi.fn(),
    getZoom: vi.fn(() => 7),
    invalidateSize: vi.fn(),
    getContainer: vi.fn(() => document.createElement("div")),
    getSize: vi.fn(() => ({ x: 800, y: 600 })),
    setView: vi.fn(),
  },
}));

vi.mock("react-leaflet", () => ({
  Circle: ({ children }: { children?: ReactNode }) => <>{children}</>,
  CircleMarker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Marker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Polyline: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TileLayer: () => null,
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMap: () => mapMock,
  useMapEvents: () => undefined,
}));

const emptyLocation: LocationValue = { label: "", address: "", latitude: null, longitude: null, source: "" };

function renderLocation(onAvailabilityChange = vi.fn()) {
  const onChange = vi.fn();
  render(<LocationStep value={emptyLocation} defaultValue={emptyLocation} onChange={onChange} onAvailabilityChange={onAvailabilityChange} />);
  return { onChange, onAvailabilityChange };
}

describe("LocationStep", () => {
  beforeEach(() => {
    geolocationMock.getCurrentPosition.mockReset();
    geolocationMock.watchPosition.mockReset();
    geolocationMock.clearWatch.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ json: async () => ({ display_name: "12 Lighthouse Street, Galle", name: "Galle" }) });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.navigator, "geolocation", { configurable: true, value: geolocationMock });
  });

  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("keeps the map usable when browser location is denied", async () => {
    geolocationMock.watchPosition.mockImplementation((_success, error) => { error?.({ code: 1, message: "Permission denied" } as GeolocationPositionError); return 1; });
    const { onAvailabilityChange } = renderLocation();

    expect(await screen.findByRole("alert")).toHaveTextContent("Allow location access");
    expect(screen.getByLabelText("OpenStreetMap location picker")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onAvailabilityChange).toHaveBeenCalledWith(true);
  });

  it("uses an approximate network location when GPS is unavailable", async () => {
    geolocationMock.watchPosition.mockImplementation((_success, error) => { error?.({ code: 1, message: "Permission denied" } as GeolocationPositionError); return 1; });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ latitude: "6.03241", longitude: "80.21692", city: "Galle", region: "Southern Province", country_name: "Sri Lanka", postal: "80000" }) });
    const { onChange } = renderLocation();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Use approximate network location" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: 6.03241, longitude: 80.21692, source: "network" }), undefined));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: 6.03241, longitude: 80.21692, address: "12 Lighthouse Street, Galle", source: "network" }), undefined));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://ipapi.co/json/", expect.objectContaining({ headers: { Accept: "application/json" } }));
  });

  it("saves a device location when the browser returns a position", async () => {
    geolocationMock.watchPosition.mockImplementation((success) => { success?.({ coords: { latitude: 6.03241, longitude: 80.21692 } } as GeolocationPosition); return 1; });
    const { onChange, onAvailabilityChange } = renderLocation();

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: 6.03241, longitude: 80.21692, source: "device" }), expect.objectContaining({ latitude: 6.03241, longitude: 80.21692, source: "device" })));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: 6.03241, longitude: 80.21692, address: "12 Lighthouse Street, Galle", source: "device" }), expect.objectContaining({ latitude: 6.03241, longitude: 80.21692, address: "12 Lighthouse Street, Galle", source: "device" })));
    expect(onAvailabilityChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps waiting for GPS after a temporary location failure", async () => {
    geolocationMock.watchPosition.mockImplementation((_success, error) => { error?.({ code: 2, message: "Position unavailable" } as GeolocationPositionError); return 1; });
    renderLocation();

    expect(await screen.findByRole("status")).toHaveTextContent("Finding your current location");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("falls back to the cached device location after GPS times out", async () => {
    vi.useFakeTimers();
    geolocationMock.watchPosition.mockReturnValue(1);
    geolocationMock.getCurrentPosition.mockImplementation((success) => success?.({ coords: { latitude: 6.03241, longitude: 80.21692 } } as GeolocationPosition));
    renderLocation();

    await vi.advanceTimersByTimeAsync(30000);
    expect(geolocationMock.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), expect.objectContaining({ enableHighAccuracy: false, maximumAge: 600000 }));
  });

  it("lets the applicant retry device location without hiding the map", async () => {
    geolocationMock.watchPosition.mockImplementation((_success, error) => { error?.({ code: 1, message: "Permission denied" } as GeolocationPositionError); return 1; });
    renderLocation();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(geolocationMock.watchPosition).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("OpenStreetMap location picker")).toBeInTheDocument();
  });

  it("shows all previously selected locations, newest first, excluding the current selection", () => {
    render(<LocationStep value={emptyLocation} defaultValue={emptyLocation} autoRequestLocation={false} onChange={vi.fn()} userLocationHistory={[{ label: "Newest pin", address: "18 Church Street, Galle", latitude: 6.03022, longitude: 80.21461, source: "map" }, { label: "Older pin", address: "12 Lighthouse Street, Galle", latitude: 6.03241, longitude: 80.21692, source: "map" }]} deviceLocationHistory={[{ label: "Device fix", address: "Device address", latitude: 6.031, longitude: 80.215, source: "device" }]} />);

    expect(screen.getByText("Latest saved location")).toBeInTheDocument();
    expect(screen.getByText("18 Church Street, Galle")).toBeInTheDocument();
    expect(screen.getByText("12 Lighthouse Street, Galle")).toBeInTheDocument();
    expect(screen.getByText("Device address")).toBeInTheDocument();
  });

  it("excludes the currently selected point from the previous-locations list", () => {
    const current = { label: "", address: "18 Church Street, Galle", latitude: 6.03022, longitude: 80.21461, source: "map" as const };
    render(<LocationStep value={current} defaultValue={emptyLocation} autoRequestLocation={false} onChange={vi.fn()} userLocationHistory={[current, { label: "Older pin", address: "12 Lighthouse Street, Galle", latitude: 6.03241, longitude: 80.21692, source: "map" }]} />);

    expect(screen.getByText("Latest saved location")).toBeInTheDocument();
    // The current selection's address still appears once, in the resolved-location card above - 
    // just not repeated inside the previous-locations list.
    expect(screen.getAllByText("18 Church Street, Galle")).toHaveLength(1);
    expect(screen.getByText("12 Lighthouse Street, Galle")).toBeInTheDocument();
  });

  it("lets the applicant enter coordinates manually via the settings popover", async () => {
    const { onChange } = renderLocation();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enter coordinates manually" }));
    await user.type(await screen.findByLabelText("Latitude"), "6.9271");
    await user.type(screen.getByLabelText("Longitude"), "79.8612");
    await user.click(screen.getByRole("button", { name: "Use these coordinates" }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 6.9271, longitude: 79.8612, source: "manual" }),
        undefined,
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rejects an out-of-range manual coordinate instead of applying it", async () => {
    const { onChange } = renderLocation();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enter coordinates manually" }));
    await user.type(await screen.findByLabelText("Latitude"), "999");
    await user.type(screen.getByLabelText("Longitude"), "79.8612");
    await user.click(screen.getByRole("button", { name: "Use these coordinates" }));

    expect(await screen.findByText(/enter a valid latitude/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
