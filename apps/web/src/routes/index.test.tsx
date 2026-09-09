// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ───────── mock infrastructure (hoisted before imports) ───────── */

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
  orpc: {
    application: {
      get: {
        queryOptions: ({ input }: { input: { accessKey: string } }) => ({
          queryKey: ["application-get", input.accessKey],
          queryFn: () => getMock(input),
        }),
      },
    },
  },
}));

type MockQueryDescriptor = { queryKey: unknown[]; queryFn: () => unknown };
type MockQueryResult = { isPending: boolean; isError: boolean; data: unknown; error: unknown };

vi.mock("@tanstack/react-query", () => ({
  useQueries: ({ queries }: { queries: MockQueryDescriptor[] }) => {
    const [results, setResults] = useState<MockQueryResult[]>(() =>
      queries.map(() => ({ isPending: true, isError: false, data: undefined, error: undefined })),
    );
    const key = queries.map((q) => JSON.stringify(q.queryKey)).join("|");
    useEffect(() => {
      let cancelled = false;
      setResults(
        queries.map(() => ({ isPending: true, isError: false, data: undefined, error: undefined })),
      );
      queries.forEach((query, index) => {
        Promise.resolve()
          .then(() => query.queryFn())
          .then((data) => {
            if (cancelled) return;
            setResults((prev) =>
              prev.map((r, i) =>
                i === index ? { isPending: false, isError: false, data, error: undefined } : r,
              ),
            );
          })
          .catch((error) => {
            if (cancelled) return;
            setResults((prev) =>
              prev.map((r, i) =>
                i === index ? { isPending: false, isError: true, data: undefined, error } : r,
              ),
            );
          });
      });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return results;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => <a href={props.to ?? "#"}>{children}</a>,
  createFileRoute: () => (opts: any) => ({ ...opts, useLoaderData: () => ({ isAdmin: false }) }),
  lazyRouteComponent: vi.fn(),
  Outlet: () => null,
}));

vi.mock("@/components/g1/application/access-key-qr", () => ({
  AccessKeyQrImporter: () => <div data-testid="qr-importer" />,
}));

vi.mock("@/components/g1/application/access-recovery-dialog", () => ({
  AccessRecoveryDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="recovery-dialog">
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

// Import the real component
import { HomeComponent } from "@/components/g1/home/home-page";
import { useHomeUiStore } from "@/lib/g1/home-ui-store";
import { useSavedApplicationsStore } from "@/lib/g1/saved-applications-store";

/* ───────── helpers ───────── */

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  clearCookies();
  getMock.mockReset();
  useHomeUiStore.setState({
    removeKey: null,
    recoveryKey: null,
    recoveryOpen: false,
    manageKeysOpen: false,
    loadKeyOpen: false,
    loadKeyInput: "",
    loadKeyError: "",
    qrImportOpen: false,
  });
  useSavedApplicationsStore.setState({ keys: [] });
  Object.defineProperty(window, "location", {
    value: { assign: vi.fn(), href: "http://localhost:3000/" },
    writable: true,
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - renders correctly
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – renders correctly", () => {
  it("shows the dashboard heading", () => {
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    expect(screen.getByText(/application dashboard/i)).toBeInTheDocument();
  });

  it("shows the quick actions section", () => {
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    expect(screen.getByText(/new application/i)).toBeInTheDocument();
  });

  it("shows the stats section", () => {
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Drafts")).toBeInTheDocument();
  });

  it("shows the G1 2026 intake badge", () => {
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    expect(screen.getByText(/G1 2026 intake/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - new application
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – new application", () => {
  it("links to /application from the new application action", () => {
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    const action = screen.getByRole("button", { name: /new application/i });
    expect(action.closest("a")).toHaveAttribute("href", "/application");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - load with key dialog
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – load with key dialog", () => {
  it("opens the load key dialog when clicking the button", async () => {
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    expect(screen.getByText(/load application with a key/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste access key/i)).toBeInTheDocument();
  });

  it("shows error when submitting empty key", async () => {
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    await user.click(screen.getByRole("button", { name: /open application/i }));
    expect(screen.getByText(/enter an access key/i)).toBeInTheDocument();
  });

  it("navigates to application page with key when valid key is entered", async () => {
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    await user.type(screen.getByPlaceholderText(/paste access key/i), "TEST-KEY-123");
    await user.click(screen.getByRole("button", { name: /open application/i }));
    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining("/application/access?key="),
    );
    expect(window.location.assign).toHaveBeenCalledWith(expect.stringContaining("TEST-KEY-123"));
  });

  it("stores key in a cookie after loading", async () => {
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    await user.type(screen.getByPlaceholderText(/paste access key/i), "MY-KEY-XYZ");
    await user.click(screen.getByRole("button", { name: /open application/i }));
    expect(getCookie("aloysius-admissions-application-key")).toBe("MY-KEY-XYZ");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - manage saved keys
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – manage saved keys", () => {
  it("disables manage keys button when no keys are saved", () => {
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    expect(screen.getByRole("button", { name: /manage saved keys/i })).toBeDisabled();
  });

  it("shows saved keys in the manage dialog", async () => {
    setCookie("aloysius-admissions-application-keys", JSON.stringify(["key-1", "key-2"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Test App" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await waitFor(() => expect(screen.getByText("Test App")).toBeInTheDocument());
    const manageButton = screen.getByRole("button", { name: /manage saved keys/i });
    expect(manageButton).toBeEnabled();
    await user.click(manageButton);
    expect(screen.getByText(/saved application keys/i)).toBeInTheDocument();
  });

  it("shows key count in saved applications section", async () => {
    setCookie("aloysius-admissions-application-keys", JSON.stringify(["k1", "k2", "k3"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "App A" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await waitFor(() => expect(screen.getByText("App A")).toBeInTheDocument());
    expect(screen.getByText(/3 applications/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - remove application
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – remove application", () => {
  it("shows confirmation dialog when trash button is clicked", async () => {
    setCookie("aloysius-admissions-application-keys", JSON.stringify(["key-1"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Test App" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await waitFor(() => expect(screen.getByText("Test App")).toBeInTheDocument());
    const trashButtons = screen.getAllByRole("button", { name: "" });
    const trashButton = trashButtons.find((btn) => btn.querySelector("svg"));
    if (trashButton) {
      await user.click(trashButton);
      expect(screen.getByText(/forget this application key/i)).toBeInTheDocument();
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - QR import
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – QR import", () => {
  it("opens the QR import dialog", async () => {
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await user.click(screen.getByRole("button", { name: /import qr/i }));
    expect(screen.getByText(/scan qr code/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - forgot a key
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – forgot a key", () => {
  it("still enables the forgot key button when no keys are saved (recovery works via session code/birth certificate too)", () => {
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    expect(screen.getByRole("button", { name: /forgot a key/i })).toBeEnabled();
  });

  it("opens recovery dialog when forgot key is clicked with saved keys", async () => {
    setCookie("aloysius-admissions-application-keys", JSON.stringify(["key-1"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Test App" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await waitFor(() => expect(screen.getByText("Test App")).toBeInTheDocument());
    const forgotButton = screen.getByRole("button", { name: /forgot a key/i });
    expect(forgotButton).toBeEnabled();
    await user.click(forgotButton);
    expect(screen.getByTestId("recovery-dialog")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - submitted vs draft cards
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – submitted vs draft cards", () => {
  it("shows Submitted badge for submitted applications", async () => {
    setCookie("aloysius-admissions-application-keys", JSON.stringify(["sub-key"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Submitted App" } },
      sessionCode: "26ABC123",
      submittedAt: "2026-08-20T00:00:00.000Z",
    });
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await waitFor(() => expect(screen.getByText("Submitted App")).toBeInTheDocument());
    expect(screen.getAllByText("Submitted", { exact: true })).toHaveLength(2);
  });

  it("shows completion percentage for draft applications", async () => {
    setCookie("aloysius-admissions-application-keys", JSON.stringify(["draft-key"]));
    getMock.mockResolvedValue({
      data: {
        applicant: { fullName: "Draft App" },
        location: { latitude: 0, longitude: 0 },
      },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await waitFor(() => expect(screen.getByText("Draft App")).toBeInTheDocument());
    expect(screen.getByText(/^\d+% complete$/)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - error handling
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – error handling", () => {
  it("shows error state when application fetch fails", async () => {
    setCookie("aloysius-admissions-application-keys", JSON.stringify(["bad-key"]));
    getMock.mockRejectedValue(new Error("Not found"));
    render(<HomeComponent isAdmin={false} isSubAdmin={false} />);
    await waitFor(() =>
      expect(screen.getByText(/no longer exists on the server/i)).toBeInTheDocument(),
    );
  });
});
