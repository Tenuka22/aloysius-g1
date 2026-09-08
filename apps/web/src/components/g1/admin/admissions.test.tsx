// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { AdmissionsPage } from "@/routes/_auth/g1/admin/admissions";

const mockNavigate = vi.fn();

const mockState = vi.hoisted(() => ({
  settings: { closesAt: new Date("2099-09-12T00:00:00.000Z") },
  list: { total: 0, items: [] as Array<Record<string, unknown>> },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({ ...config, useSearch: () => ({ intakeYear: "2027" }) }),
  Link: ({ children, to, params }: { children: ReactNode; to: string; params?: { id?: string } }) => <a href={`${to}${params?.id ? `/${params.id}` : ""}`}>{children}</a>,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/g1/admin/admissions" }),
  Outlet: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey?: string[] }) => {
    const key = options.queryKey?.[0];
    if (key === "settings") return { data: mockState.settings, isLoading: false, error: null };
    if (key === "admissions-list") return { data: mockState.list, isLoading: false, error: null };
    return { data: null, isLoading: false, error: null };
  },
  useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/utils/orpc", () => ({
  client: {
    admin: { admissions: { updateReview: vi.fn(), getMarks: vi.fn(), saveMarks: vi.fn() } },
    application: {
      liveCount: vi.fn().mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ done: true, value: undefined }),
        }),
      }),
    },
  },
  orpc: {
    admin: {
      settings: { get: { queryOptions: () => ({ queryKey: ["settings"] }) } },
      admissions: {
        list: { queryOptions: () => ({ queryKey: ["admissions-list"] }), key: () => ["admissions-list"] },
        get: { queryOptions: () => ({ queryKey: ["admissions-detail"] }), key: () => ["admissions-detail"] },
        getMarks: { queryOptions: () => ({ queryKey: ["admissions-marks"] }), key: () => ["admissions-marks"] },
      },
    },
  },
}));

function setOpenAdmissionsData() {
  mockState.settings = { closesAt: new Date("2000-09-11T00:00:00.000Z") };
  mockState.list = {
    total: 1,
    items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        applicantName: "Amaya Perera",
        birthCertificateNumber: "BC-100",
        sessionCode: "26ABC123",
        submittedAt: new Date("2026-09-10T00:00:00.000Z"),
        updatedAt: new Date("2026-09-10T00:00:00.000Z"),
        categoryCount: 2,
        categoryTypes: ["6.1", "6.3"],
        admissionStatus: "pending",
        isBanned: false,
        banReason: null,
        admissionUpdatedAt: null,
      },
    ],
  };
}

describe("AdmissionsPage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockState.settings = { closesAt: new Date("2099-09-12T00:00:00.000Z") };
    mockState.list = { total: 0, items: [] };
  });

  it("shows a warning and allows opening admissions early", async () => {
    const user = userEvent.setup();
    render(<AdmissionsPage />);

    expect(screen.getByText("Admissions is not open yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /open admissions early/i }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Open admissions before the window closes?");
    expect(screen.queryByText("All applicants")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Open admissions$/ }));
    expect(await screen.findByText("All applicants")).toBeInTheDocument();
  });

  it("renders one row per applicant with category badges", async () => {
    setOpenAdmissionsData();
    render(<AdmissionsPage />);

    expect(screen.getByText("All applicants")).toBeInTheDocument();
    expect(screen.getByText("Amaya Perera")).toBeInTheDocument();
    expect(screen.getByText("6.1")).toBeInTheDocument();
    expect(screen.getByText("6.3")).toBeInTheDocument();
  });

  it("navigates to the category selection page when clicking an applicant name", async () => {
    setOpenAdmissionsData();
    const user = userEvent.setup();
    render(<AdmissionsPage />);

    await user.click(screen.getByText("Amaya Perera"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/g1/admin/admissions/$id",
      params: { id: "11111111-1111-4111-8111-111111111111" },
      search: true,
    });
  });

  it("does not render interview workspace components", () => {
    setOpenAdmissionsData();
    render(<AdmissionsPage />);

    expect(screen.queryByText("Interview workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Applicant and guardian")).not.toBeInTheDocument();
    expect(screen.queryByText("Location evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit application")).not.toBeInTheDocument();
    expect(screen.queryByText("Mark allocation")).not.toBeInTheDocument();
  });
});
