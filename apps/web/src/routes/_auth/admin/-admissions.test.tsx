// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { AdmissionsPage } from "./admissions";

const mockState = vi.hoisted(() => ({
  settings: { closesAt: new Date("2099-09-12T00:00:00.000Z") },
  list: { total: 0, items: [] as Array<Record<string, unknown>> },
  detail: null as Record<string, unknown> | null,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children, to, params }: { children: ReactNode; to: string; params?: { id?: string } }) => <a href={`${to}${params?.id ? `/${params.id}` : ""}`}>{children}</a>,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey?: string[] }) => {
    const key = options.queryKey?.[0];
    if (key === "settings") return { data: mockState.settings, isLoading: false, error: null };
    if (key === "admissions-list") return { data: mockState.list, isLoading: false, error: null };
    return { data: mockState.detail, isLoading: false, error: null };
  },
  useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/utils/orpc", () => ({
  client: { admin: { admissions: { updateReview: vi.fn() } } },
  orpc: {
    admin: {
      settings: { get: { queryOptions: () => ({ queryKey: ["settings"] }) } },
      admissions: {
        list: { queryOptions: () => ({ queryKey: ["admissions-list"] }), key: () => ["admissions-list"] },
        get: { queryOptions: () => ({ queryKey: ["admissions-detail"] }), key: () => ["admissions-detail"] },
      },
    },
  },
}));

function setOpenAdmissionsData() {
  mockState.settings = { closesAt: new Date("2000-09-11T00:00:00.000Z") };
  mockState.list = {
    total: 1,
    items: [{ id: "11111111-1111-4111-8111-111111111111", applicantName: "Amaya Perera", birthCertificateNumber: "BC-100", sessionCode: "26ABC123", submittedAt: new Date("2026-09-10T00:00:00.000Z"), updatedAt: new Date("2026-09-10T00:00:00.000Z"), categoryCount: 1, categoryTypes: ["6.1"], admissionStatus: "pending", isBanned: false, banReason: null, admissionUpdatedAt: null }],
  };
  mockState.detail = {
    ...mockState.list.items[0],
    interviewNotes: "",
    createdAt: new Date("2026-09-09T00:00:00.000Z"),
    data: {
      applicant: { fullName: "Amaya Perera", sinhalaName: "අමයා පෙරේරා", dateOfBirth: "2019-01-01", birthCertificateNumber: "BC-100", gender: "Female", religion: "Buddhist", educationMedium: "Sinhala" },
      guardian: { fullName: "Nimal Perera", relationship: "Father", nic: "901234567V", phone: "+94771234567", email: "nimal@example.com" },
      residence: { permanentAddress: "12 Main Street", currentAddress: "12 Main Street", district: "Galle", dsDivision: "Galle", gnDivision: "Fort", electoralDistrict: "Galle" },
      location: { label: "Submitted location", address: "12 Main Street", latitude: 6.03, longitude: 80.21, source: "map" },
      defaultLocation: { label: "Browser fix", address: "12 Main Street", latitude: 6.031, longitude: 80.211, source: "device" },
      selectedLocation: { label: "Home", address: "12 Main Street", latitude: 6.03, longitude: 80.21, source: "map" },
      userLocationHistory: [{ label: "Earlier selected pin", address: "11 Main Street", latitude: 6.032, longitude: 80.212, source: "map" }],
      deviceLocationHistory: [{ label: "Earlier device fix", address: "10 Main Street", latitude: 6.033, longitude: 80.213, source: "device" }],
      categories: [{ id: "category-1", categoryType: "6.1", scoringInputs: { mainDocumentType: "title-deed" }, locked: false }],
    },
  };
}

describe("AdmissionsPage", () => {
  beforeEach(() => {
    mockState.settings = { closesAt: new Date("2099-09-12T00:00:00.000Z") };
    mockState.list = { total: 0, items: [] };
    mockState.detail = null;
  });

  it("requires confirmation before opening admissions early", async () => {
    const user = userEvent.setup();
    render(<AdmissionsPage />);

    expect(screen.getByText("Admissions is not open yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /open admissions early/i }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Open admissions before the window closes?");
    expect(screen.queryByText("Applicant queue")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Open admissions$/ }));
    expect(await screen.findByText("Applicant queue")).toBeInTheDocument();
  });

  it("opens one applicant interview workspace with base data and categories", async () => {
    setOpenAdmissionsData();
    const user = userEvent.setup();
    render(<AdmissionsPage />);

    expect(screen.getByRole("button", { name: /Amaya Perera/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Interview workspace")).toBeInTheDocument();
    expect(screen.getByText("Applicant and guardian")).toBeInTheDocument();
    expect(screen.getByText("6.1 – Residence Verification & Proximity")).toBeInTheDocument();
    expect(screen.getByText("Edit application")).toBeInTheDocument();
    expect(screen.getByText("Location evidence")).toBeInTheDocument();
    expect(screen.getByText("Previous device fix 1")).toBeInTheDocument();
    expect(screen.getByText("Radius overlays")).toBeInTheDocument();
    const previousDeviceFix = screen.getAllByRole("checkbox")[4];
    expect(previousDeviceFix).toBeChecked();
    await user.click(previousDeviceFix);
    expect(previousDeviceFix).not.toBeChecked();
    const halfKilometerRadius = screen.getAllByRole("checkbox")[5];
    expect(halfKilometerRadius).not.toBeChecked();
    await user.click(halfKilometerRadius);
    expect(halfKilometerRadius).toBeChecked();
  });
});
