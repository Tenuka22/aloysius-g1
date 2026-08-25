// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationForm } from "./application-form";
import { emptyDraft, useApplicationStore, type ApplicationDraft, type CategoryApplication } from "@/lib/application-store";
import { scoreCategory } from "@/lib/scoring";

/* ───────── mock infrastructure ───────── */

const { createMock, getMock, statusMock, checkBirthCertificateMock, submitMock, updateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  getMock: vi.fn(),
  statusMock: vi.fn(),
  checkBirthCertificateMock: vi.fn(),
  submitMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
  client: {
    application: {
      create: createMock,
      get: getMock,
      status: statusMock,
      update: updateMock,
      submit: submitMock,
      checkBirthCertificate: checkBirthCertificateMock,
      requestAccess: vi.fn().mockResolvedValue({ submitted: true }),
    },
    admin: {
      application: {
        get: vi.fn().mockResolvedValue({ data: {}, submittedAt: null }),
        update: vi.fn().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" }),
      },
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("./school-map-picker", () => ({ SchoolMapPicker: () => <div data-testid="school-map-picker" /> }));

const { locationChangePayload } = vi.hoisted(() => ({
  locationChangePayload: {
    current: null as null | { value: Record<string, unknown>; defaultValue?: Record<string, unknown> },
  },
}));

vi.mock("./location-step", () => ({
  LocationStep: (props: {
    onChange: (value: Record<string, unknown>, defaultValue?: Record<string, unknown>) => void;
  }) => (
    <div data-testid="location-step">
      <button
        type="button"
        data-testid="fire-location-change"
        onClick={() => {
          if (!locationChangePayload.current) throw new Error("locationChangePayload not configured");
          props.onChange(locationChangePayload.current.value, locationChangePayload.current.defaultValue);
        }}
      >
        fire
      </button>
    </div>
  ),
}));

/* ───────── helpers ───────── */

function setStore(patch: Partial<ApplicationDraft>) {
  act(() => useApplicationStore.setState({ ...patch }));
}

function currentDraftData(): ApplicationDraft {
  const { updateDraft: _u, setStep: _s, reset: _r, ...rest } = useApplicationStore.getState();
  return rest as ApplicationDraft;
}

/* ───────── fixtures ───────── */

const loc = { latitude: 7.29, longitude: 80.63, address: "Galle, Sri Lanka" };

const applicant = {
  fullName: "Ashan Perera",
  sinhalaName: "",
  gender: "Male",
  religion: "Buddhist",
  educationMedium: "Sinhala",
  dateOfBirth: "2021-01-01",
  birthCertificateNumber: "ABC123",
};

const guardian = {
  relationship: "Father",
  fullName: "Kamal Perera",
  nic: "199012345678",
  phone: "+94712345678",
  whatsappPhone: "",
  email: "kamal@example.com",
};

const residence = {
  permanentAddress: "123 Temple St, Galle",
  currentAddress: "456 Park Rd, Galle",
  sameAsPermanent: false,
  district: "Galle",
  dsDivision: "Galle",
  gnDivision: "Galle",
  electoralDistrict: "Galle",
};

const declaration = { confirmed: true, consent: true };

/* ───────── beforeEach ───────── */

beforeEach(() => {
  useApplicationStore.getState().reset();
  localStorage.clear();
  locationChangePayload.current = null;
  window.history.replaceState({}, "", "/");
  createMock.mockReset().mockImplementation(async () => ({
    accessKey: "ALY-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO",
    sessionCode: "26ABC123",
    data: currentDraftData(),
  }));
  getMock.mockReset().mockImplementation(async () => ({
    data: currentDraftData(),
    sessionCode: "26ABC123",
    accessKeyHint: "JKLMNO",
    submittedAt: null,
  }));
  statusMock.mockReset().mockResolvedValue({
    submissionLocked: false,
    submissionOpensAt: "2026-09-09T00:00:00+05:30",
    submissionClosesAt: "2026-09-12T00:00:00+05:30",
    environment: "test",
  });
  checkBirthCertificateMock.mockReset().mockResolvedValue({ exists: false });
  submitMock.mockReset().mockResolvedValue({ accepted: true });
  updateMock.mockReset().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   1. FULL HAPPY-PATH USER JOURNEY
   ════════════════════════════════════════════════════════════════════════════ */

describe("Full user journey — fresh application", () => {
  it("navigates all 7 steps and reaches review", async () => {
    // Step 0: Location
    setStore({ location: { ...emptyDraft.location, ...loc } });
    render(<ApplicationForm />);
    expect(await screen.findByTestId("location-step")).toBeInTheDocument();

    // Step 1: Applicant
    setStore({ currentStep: 1 });
    await act(async () => {});
    expect(screen.getByText("Tell us about the applicant")).toBeInTheDocument();

    // Step 2: Guardian
    setStore({ currentStep: 2 });
    await act(async () => {});
    expect(screen.getByText("Parent or guardian details")).toBeInTheDocument();

    // Step 3: Residence
    setStore({ currentStep: 3 });
    await act(async () => {});
    expect(screen.getByText("Where does the family live?")).toBeInTheDocument();

    // Step 4: Categories
    setStore({ currentStep: 4 });
    await act(async () => {});
    expect(screen.getByText("Marking scheme categories")).toBeInTheDocument();

    // Step 5: Declaration
    setStore({ currentStep: 5 });
    await act(async () => {});
    expect(screen.getByText("Confirm before review")).toBeInTheDocument();

    // Step 6: Review
    setStore({ currentStep: 6 });
    await act(async () => {});
    expect(screen.getByText("Review your draft")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   2. USER STUCK MIDWAY — goes back, changes data, comes forward
   ════════════════════════════════════════════════════════════════════════════ */

describe("User stuck midway — back and forth", () => {
  it("goes back from step 1 to step 0, then forward again", async () => {
    const user = userEvent.setup();
    setStore({
      currentStep: 1,
      applicant: { ...applicant, gender: "Male" },
    });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    const back = screen.getByRole("button", { name: /back/i });
    await user.click(back);
    expect(screen.getByTestId("location-step")).toBeInTheDocument();

    // go forward again
    setStore({ currentStep: 1 });
    await act(async () => {});
    expect(screen.getByText("Tell us about the applicant")).toBeInTheDocument();
  });

  it("step 4 blocked when no categories, then adding one unblocks", async () => {
    setStore({ currentStep: 4 });
    render(<ApplicationForm />);
    const continueButton = await screen.findByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    act(() => useApplicationStore.getState().addCategory("6.1"));
    expect(continueButton).toBeEnabled();
  });

  it("changing applicant gender mid-flow is reflected in store", async () => {
    setStore({ currentStep: 1, applicant: { ...applicant, gender: "Male" } });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    expect(useApplicationStore.getState().applicant.gender).toBe("Male");
    setStore({ applicant: { ...applicant, gender: "Female" } });
    expect(useApplicationStore.getState().applicant.gender).toBe("Female");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   3. RANDOM NAVIGATION — clicking back/forward non-linearly
   ════════════════════════════════════════════════════════════════════════════ */

describe("Random navigation", () => {
  it("clicks back from step 5 returns to step 4", async () => {
    const user = userEvent.setup();
    setStore({
      currentStep: 5,
      declaration: { confirmed: false, consent: false },
    });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    const back = screen.getByRole("button", { name: /back/i });
    await user.click(back);
    expect(screen.getByText("Marking scheme categories")).toBeInTheDocument();
  });

  it("can jump from step 6 to step 0 via store without crash", async () => {
    setStore({ currentStep: 6, declaration: { confirmed: true, consent: true } });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /(submit|update) application/i });

    act(() => useApplicationStore.getState().setStep(0));
    await act(async () => {});
    expect(screen.getByTestId("location-step")).toBeInTheDocument();
  });

  it("rapid step changes do not crash the form", async () => {
    setStore({ location: { ...emptyDraft.location, ...loc } });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    for (let step = 0; step <= 6; step++) {
      act(() => useApplicationStore.getState().setStep(step));
      await act(async () => {});
    }
    expect(screen.getByRole("button", { name: /(submit|update) application/i })).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   4. ABANDON AND RESUME — store persists draft across render cycles
   ════════════════════════════════════════════════════════════════════════════ */

describe("Abandon and resume", () => {
  it("retains applicant data after unmount and remount", async () => {
    setStore({ currentStep: 1, applicant });
    const { unmount } = render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });
    unmount();

    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });
    const store = useApplicationStore.getState();
    expect(store.applicant.fullName).toBe("Ashan Perera");
    expect(store.applicant.gender).toBe("Male");
  });

  it("retains guardian data across step changes", async () => {
    setStore({ currentStep: 2, guardian });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    act(() => useApplicationStore.getState().setStep(3));
    await act(async () => {});
    expect(useApplicationStore.getState().guardian.fullName).toBe("Kamal Perera");
    expect(useApplicationStore.getState().guardian.nic).toBe("199012345678");
  });

  it("retains categories after navigating away and back", async () => {
    setStore({ currentStep: 4 });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    act(() => useApplicationStore.getState().addCategory("6.1"));
    expect(useApplicationStore.getState().categories).toHaveLength(1);

    act(() => useApplicationStore.getState().setStep(5));
    expect(useApplicationStore.getState().categories).toHaveLength(1);

    act(() => useApplicationStore.getState().setStep(4));
    expect(useApplicationStore.getState().categories).toHaveLength(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   5. CATEGORY DUPLICATES — adding same type multiple times
   ════════════════════════════════════════════════════════════════════════════ */

describe("Category duplicates", () => {
  it("allows multiple 6.1 entries", async () => {
    setStore({ currentStep: 4 });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    act(() => useApplicationStore.getState().addCategory("6.1"));
    act(() => useApplicationStore.getState().addCategory("6.1"));

    const store = useApplicationStore.getState();
    expect(store.categories).toHaveLength(2);
    expect(store.categories[0]?.categoryType).toBe("6.1");
    expect(store.categories[1]?.categoryType).toBe("6.1");
  });

  it("allows one of each type", async () => {
    setStore({ currentStep: 4 });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    act(() => {
      const store = useApplicationStore.getState();
      store.addCategory("6.1");
      store.addCategory("6.2");
      store.addCategory("6.3");
      store.addCategory("6.4");
      store.addCategory("6.5");
      store.addCategory("6.6");
    });

    expect(useApplicationStore.getState().categories).toHaveLength(6);
  });

  it("removing one duplicate leaves the other intact", async () => {
    setStore({ currentStep: 4 });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    act(() => {
      const store = useApplicationStore.getState();
      store.addCategory("6.1");
      store.addCategory("6.1");
    });

    const cat1Id = useApplicationStore.getState().categories[0]?.id!;
    act(() => useApplicationStore.getState().removeCategory(cat1Id));
    expect(useApplicationStore.getState().categories).toHaveLength(1);
    expect(useApplicationStore.getState().categories[0]?.categoryType).toBe("6.1");
  });

  it("mix of duplicates and unique types all render", async () => {
    setStore({ currentStep: 4 });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    act(() => {
      const store = useApplicationStore.getState();
      store.addCategory("6.1");
      store.addCategory("6.3");
      store.addCategory("6.3");
      store.addCategory("6.5");
    });

    expect(useApplicationStore.getState().categories).toHaveLength(4);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   6. INDICATIVE MARKS — verify baseline notice is user-visible
   ════════════════════════════════════════════════════════════════════════════ */

describe("Indicative marks notice", () => {
  it("shows baseline estimate text and indicative total on step 4", async () => {
    setStore({
      currentStep: 4,
      location: { ...emptyDraft.location, latitude: 7.29, longitude: 80.63 },
      categories: [
        {
          id: "cat-int-1",
          categoryType: "6.1",
          scoringInputs: { mainDocumentType: "title-deed-applicant", schoolsWithinRadius: ["school-1"] },
        },
      ],
    });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    expect(screen.getByText("Example marks — 6.1 – Residence Verification & Proximity")).toBeInTheDocument();
    expect(screen.getByText("Indicative total")).toBeInTheDocument();
    expect(screen.getByText(/baseline estimate/)).toBeInTheDocument();
    expect(screen.getByText(/interview panel/)).toBeInTheDocument();
  });

  it("shows 'Marks (indicative):' in the review summary", async () => {
    const cat: CategoryApplication = {
      id: "cat-int-2",
      categoryType: "6.1",
      scoringInputs: { mainDocumentType: "title-deed-applicant", schoolsWithinRadius: ["school-1"] },
    };
    setStore({
      currentStep: 6,
      location: { ...emptyDraft.location, ...loc },
      applicant,
      guardian,
      residence,
      declaration,
      categories: [cat],
    });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /(submit|update) application/i });

    const score = scoreCategory(cat);
    expect(screen.getByText(new RegExp(`Marks \\(indicative\\): ${score.total}`))).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   7. DECLARATION CONSENT GATING
   ════════════════════════════════════════════════════════════════════════════ */

describe("Declaration consent gating", () => {
  it("submit button disabled when confirmed and consent are false", async () => {
    setStore({
      currentStep: 6,
      declaration: { confirmed: false, consent: false },
      location: { ...emptyDraft.location, ...loc },
      applicant,
      guardian,
      residence,
    });
    render(<ApplicationForm />);
    const submitButton = await screen.findByRole("button", { name: /submit application/i });
    expect(submitButton).toBeDisabled();
  });

  it("submit button enabled when both confirmed and consent are true", async () => {
    setStore({
      currentStep: 6,
      declaration: { confirmed: true, consent: true },
      location: { ...emptyDraft.location, ...loc },
      applicant,
      guardian,
      residence,
    });
    render(<ApplicationForm />);
    const submitButton = await screen.findByRole("button", { name: /submit application/i });
    expect(submitButton).toBeEnabled();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   8. REVIEW EDIT BUTTONS — clicking jumps to correct step
   ════════════════════════════════════════════════════════════════════════════ */

describe("Review edit jumps", () => {
  const fullDraft = {
    ...emptyDraft,
    location: { ...emptyDraft.location, ...loc },
    applicant,
    guardian,
    residence,
    declaration,
    categories: [
      {
        id: "cat-review-1",
        categoryType: "6.1" as const,
        scoringInputs: { mainDocumentType: "title-deed-applicant" as const, schoolsWithinRadius: ["school-1"] },
      },
    ],
  };

  it("clicking Categories edit sets step to 4 via store", async () => {
    setStore({ ...fullDraft, currentStep: 6 });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /(submit|update) application/i });

    act(() => useApplicationStore.getState().setStep(4));
    await act(async () => {});
    expect(screen.getByText("Marking scheme categories")).toBeInTheDocument();
  });

  it("clicking Location edit sets step to 0 via store", async () => {
    setStore({ ...fullDraft, currentStep: 6 });
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /(submit|update) application/i });

    act(() => useApplicationStore.getState().setStep(0));
    await act(async () => {});
    expect(screen.getByTestId("location-step")).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   9. SUBMIT FLOW — mock create → submit → success message
   ════════════════════════════════════════════════════════════════════════════ */

describe("Submit flow", () => {
  it("submits and shows access key on success", async () => {
    setStore({
      currentStep: 6,
      location: { ...emptyDraft.location, ...loc },
      applicant,
      guardian,
      residence,
      declaration,
      categories: [],
    });
    render(<ApplicationForm />);
    const submitButton = await screen.findByRole("button", { name: /submit application/i });

    await userEvent.click(submitButton);

    expect(submitMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/Application submitted successfully/i)).toBeInTheDocument();
    });
    const codeElements = screen.getAllByText(/ALY-abcdefghi/);
    expect(codeElements.length).toBeGreaterThanOrEqual(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   10. LOCATION HISTORY — device fix and manual selection
   ════════════════════════════════════════════════════════════════════════════ */

describe("Location history in form", () => {
  it("fire button records device location into deviceLocationHistory", async () => {
    setStore({ currentStep: 0 });
    locationChangePayload.current = {
      value: { ...emptyDraft.location, latitude: 7.1, longitude: 80.2, source: "device", address: "Spot A" },
      defaultValue: { ...emptyDraft.location, latitude: 7.1, longitude: 80.2, source: "device", address: "Spot A" },
    };
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    await userEvent.click(screen.getByTestId("fire-location-change"));

    const store = useApplicationStore.getState();
    expect(store.deviceLocationHistory).toHaveLength(1);
    expect(store.deviceLocationHistory[0]?.latitude).toBe(7.1);
  });

  it("fire button records manual device button press into userLocationHistory", async () => {
    setStore({ currentStep: 0 });
    locationChangePayload.current = {
      value: { ...emptyDraft.location, latitude: 7.3, longitude: 80.5, source: "device", address: "Spot B" },
    };
    render(<ApplicationForm />);
    await screen.findByRole("button", { name: /continue/i });

    await userEvent.click(screen.getByTestId("fire-location-change"));

    const store = useApplicationStore.getState();
    expect(store.userLocationHistory).toHaveLength(1);
    expect(store.userLocationHistory[0]?.latitude).toBe(7.3);
    expect(store.deviceLocationHistory).toHaveLength(0);
  });
});
