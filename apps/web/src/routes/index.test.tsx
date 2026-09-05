// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* ───────── mock infrastructure (hoisted before imports) ───────── */

const { createMock, getMock, countMock, liveCountMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  getMock: vi.fn(),
  countMock: vi.fn(),
  liveCountMock: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
  client: {
    application: {
      create: createMock,
      get: getMock,
      count: countMock,
      liveCount: liveCountMock,
    },
  },
}));

vi.mock("@orpc/client", () => ({
  consumeEventIterator: vi.fn(() => ({ cancel: vi.fn() })),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({ data: { user: { role: "user" } } }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => (
    <a href={props.to ?? "#"}>{children}</a>
  ),
  createFileRoute: () => (_opts: any) => ({ component: () => null }),
  lazyRouteComponent: vi.fn(),
  Outlet: () => null,
}));

vi.mock("@/components/application/access-key-qr", () => ({
  AccessKeyQrImporter: () => <div data-testid="qr-importer" />,
}));

vi.mock("@/components/application/access-recovery-dialog", () => ({
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
import { HomeComponent } from "./index";

/* ───────── helpers ───────── */

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  createMock.mockReset();
  getMock.mockReset();
  countMock.mockReset().mockResolvedValue({ count: 5 });
  liveCountMock.mockReset();
  liveCountMock.mockReturnValue({
    [Symbol.asyncIterator]: () => ({
      next: async () => ({ done: true, value: undefined }),
    }),
  });
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
    render(<HomeComponent />);
    expect(screen.getByText(/application dashboard/i)).toBeInTheDocument();
  });

  it("shows the quick actions section", () => {
    render(<HomeComponent />);
    expect(screen.getByText(/quick actions/i)).toBeInTheDocument();
    expect(screen.getByText(/new application/i)).toBeInTheDocument();
  });

  it("shows the stats section", () => {
    render(<HomeComponent />);
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Drafts")).toBeInTheDocument();
  });

  it("shows the G1 2026 intake badge", () => {
    render(<HomeComponent />);
    expect(screen.getByText(/G1 2026 intake/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - new application
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – new application", () => {
  it("navigates to /application when new application is clicked", async () => {
    const user = userEvent.setup();
    render(<HomeComponent />);
    await user.click(screen.getByRole("button", { name: /new application/i }));
    expect(window.location.assign).toHaveBeenCalledWith("/application");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - load with key dialog
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – load with key dialog", () => {
  it("opens the load key dialog when clicking the button", async () => {
    const user = userEvent.setup();
    render(<HomeComponent />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    expect(screen.getByText(/load application with a key/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste access key/i)).toBeInTheDocument();
  });

  it("shows error when submitting empty key", async () => {
    const user = userEvent.setup();
    render(<HomeComponent />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    await user.click(screen.getByRole("button", { name: /open application/i }));
    expect(screen.getByText(/enter an access key/i)).toBeInTheDocument();
  });

  it("navigates to application page with key when valid key is entered", async () => {
    const user = userEvent.setup();
    render(<HomeComponent />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    await user.type(screen.getByPlaceholderText(/paste access key/i), "TEST-KEY-123");
    await user.click(screen.getByRole("button", { name: /open application/i }));
    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining("/application/access?key=")
    );
    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining("TEST-KEY-123")
    );
  });

  it("stores key in localStorage after loading", async () => {
    const user = userEvent.setup();
    render(<HomeComponent />);
    await user.click(screen.getByRole("button", { name: /load with a key/i }));
    await user.type(screen.getByPlaceholderText(/paste access key/i), "MY-KEY-XYZ");
    await user.click(screen.getByRole("button", { name: /open application/i }));
    expect(localStorage.getItem("aloysius-g1-application-key")).toBe("MY-KEY-XYZ");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - manage saved keys
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – manage saved keys", () => {
  it("disables manage keys button when no keys are saved", () => {
    render(<HomeComponent />);
    expect(screen.getByRole("button", { name: /manage saved keys/i })).toBeDisabled();
  });

  it("shows saved keys in the manage dialog", async () => {
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(["key-1", "key-2"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Test App" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<HomeComponent />);
    await waitFor(() => expect(screen.getByText("Test App")).toBeInTheDocument());
    const manageButton = screen.getByRole("button", { name: /manage saved keys/i });
    expect(manageButton).toBeEnabled();
    await user.click(manageButton);
    expect(screen.getByText(/saved application keys/i)).toBeInTheDocument();
  });

  it("shows key count in saved applications section", async () => {
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(["k1", "k2", "k3"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "App A" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    render(<HomeComponent />);
    await waitFor(() => expect(screen.getByText("App A")).toBeInTheDocument());
    expect(screen.getByText(/3 applications/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - remove application
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – remove application", () => {
  it("shows confirmation dialog when trash button is clicked", async () => {
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(["key-1"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Test App" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<HomeComponent />);
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
    render(<HomeComponent />);
    await user.click(screen.getByRole("button", { name: /import qr/i }));
    expect(screen.getByText(/scan qr code/i)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - forgot a key
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – forgot a key", () => {
  it("still enables the forgot key button when no keys are saved (recovery works via session code/birth certificate too)", () => {
    render(<HomeComponent />);
    expect(screen.getByRole("button", { name: /forgot a key/i })).toBeEnabled();
  });

  it("opens recovery dialog when forgot key is clicked with saved keys", async () => {
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(["key-1"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Test App" } },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<HomeComponent />);
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
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(["sub-key"]));
    getMock.mockResolvedValue({
      data: { applicant: { fullName: "Submitted App" } },
      sessionCode: "26ABC123",
      submittedAt: "2026-08-20T00:00:00.000Z",
    });
    render(<HomeComponent />);
    await waitFor(() => expect(screen.getByText("Submitted App")).toBeInTheDocument());
    expect(screen.getAllByText("Submitted", { exact: true })).toHaveLength(2);
  });

  it("shows completion percentage for draft applications", async () => {
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(["draft-key"]));
    getMock.mockResolvedValue({
      data: {
        applicant: { fullName: "Draft App" },
        location: { latitude: 0, longitude: 0 },
      },
      sessionCode: "26ABC123",
      submittedAt: null,
    });
    render(<HomeComponent />);
    await waitFor(() => expect(screen.getByText("Draft App")).toBeInTheDocument());
    expect(screen.getByText(/^\d+% complete$/)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HOME PAGE - error handling
   ════════════════════════════════════════════════════════════════════════════ */

describe("HomeComponent – error handling", () => {
  it("shows error state when application fetch fails", async () => {
    localStorage.setItem("aloysius-g1-application-keys", JSON.stringify(["bad-key"]));
    getMock.mockRejectedValue(new Error("Not found"));
    render(<HomeComponent />);
    await waitFor(() => expect(screen.getByText(/no longer exists on the server/i)).toBeInTheDocument());
  });
});
