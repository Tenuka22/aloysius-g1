// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationForm } from "./application-form";
import { emptyDraft, useApplicationStore } from "@/lib/g1/application-store";
import { G1_DOB_LATEST } from "@/lib/g1/eligibility";
import { getActiveKey, setActiveKey, setActiveSessionCode } from "@/lib/g1/saved-keys";
import { removeAppCookie } from "@/lib/cookies";

const { MOCK_ACCESS_KEY, MOCK_SESSION_CODE } = vi.hoisted(() => ({
  MOCK_ACCESS_KEY: "ALY-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO",
  MOCK_SESSION_CODE: "26ABC123",
}));

const { createMock, getMock, statusMock, checkBirthCertificateMock, submitMock, updateMock, getMarksMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  getMock: vi.fn(),
  statusMock: vi.fn(),
  checkBirthCertificateMock: vi.fn(),
  submitMock: vi.fn(),
  updateMock: vi.fn(),
  getMarksMock: vi.fn(),
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
      getMarks: getMarksMock,
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
vi.mock("./school-map-picker", () => ({ SchoolMapPicker: () => <div data-testid="school-map-picker" /> }));
vi.mock("@/lib/g1/school-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/g1/school-utils")>();
  return {
    ...actual,
    // The applicant form now auto-computes nearby schools from real geo data
    // (see category-step.tsx's CategoryCard effect); stub it so this file's
    // indicative-score assertions don't depend on real school coordinates.
    compatibleSchoolsWithinRadius: () => ({ radiusKm: 5, schoolIds: ["school-1"] }),
  };
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function setStore(patch: Partial<typeof emptyDraft>) {
  act(() => useApplicationStore.setState({ ...patch }));
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function renderForm() {
  renderWithClient(<ApplicationForm />);
  return screen.findByRole("button", { name: /continue/i });
}

function renderReview() {
  renderWithClient(<ApplicationForm />);
  return screen.findByRole("button", { name: /(submit|update) application/i });
}

function currentDraftData(): typeof emptyDraft {
  const { updateDraft: _u, setStep: _s, reset: _r, ...draftState } = useApplicationStore.getState();
  return draftState;
}

beforeEach(() => {
  useApplicationStore.getState().reset();
  window.localStorage.clear();
  removeAppCookie("aloysius-admissions-application-key");
  removeAppCookie("aloysius-admissions-application-keys");
  removeAppCookie("aloysius-admissions-application-session-code");
  locationChangePayload.current = null;
  window.history.replaceState({}, "", "/");
  createMock.mockReset().mockImplementation(async () => ({
    accessKey: MOCK_ACCESS_KEY,
    sessionCode: MOCK_SESSION_CODE,
    data: currentDraftData(),
  }));
  getMock.mockReset().mockImplementation(async () => ({
    data: currentDraftData(),
    sessionCode: MOCK_SESSION_CODE,
    accessKeyHint: MOCK_ACCESS_KEY.slice(-6),
    submittedAt: null,
  }));
  statusMock.mockReset().mockResolvedValue({ submissionLocked: false, submissionOpensAt: "2026-09-09T00:00:00+05:30", submissionClosesAt: "2026-09-12T00:00:00+05:30", environment: "test" });
  checkBirthCertificateMock.mockReset().mockResolvedValue({ exists: false });
  submitMock.mockReset().mockResolvedValue({ accepted: true });
  updateMock.mockReset().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" });
  getMarksMock.mockReset().mockResolvedValue([]);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});

const validApplicant = {
  fullName: "Ashan Perera",
  sinhalaName: "",
  gender: "Male",
  religion: "Buddhist",
  educationMedium: "Sinhala",
  dateOfBirth: G1_DOB_LATEST(),
  birthCertificateNumber: "ABC123",
};

const validGuardian = {
  relationship: "Father",
  fullName: "Kamal Perera",
  sinhalaName: "",
  nic: "199012345678",
  phone: "+94712345678",
  whatsappPhone: "",
  email: "kamal@example.com",
};

const validResidence = {
  permanentAddressEn: "123 Temple St, Colombo",
  permanentAddressSi: "",
  currentAddressEn: "456 Park Rd, Colombo",
  currentAddressSi: "",
  sameAsPermanent: false,
  district: "Colombo",
  dsDivision: "Colombo",
  gnDivision: "Mirihana",
  electoralDistrict: "Colombo",
  districtSearch: "",
  dsSearch: "",
  gnSearch: "",
  electoralSearch: "",
};

const validDeclaration = { confirmed: true, consent: true };

const validCategories: typeof emptyDraft.categories = [
  {
    id: "cat-1",
    categoryType: "6.1",
    scoringInputs: { mainDocumentType: "title-deed-applicant", schoolsWithinRadius: ["school-1"] },
    locked: false,
  },
];

const fullValidDraft = {
  ...emptyDraft,
  location: { ...emptyDraft.location, latitude: 7.29, longitude: 80.63, address: "Colombo, Sri Lanka" },
  applicant: validApplicant,
  guardian: validGuardian,
  residence: validResidence,
  declaration: validDeclaration,
  categories: validCategories,
};

describe("ApplicationForm – step 0 (location)", () => {
  it("blocks Continue until a location is ready", async () => {
    await renderForm();
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    // The location step shows its own skip affordance; the footer reason is
    // deliberately withheld on step 0 (it only renders for steps 1..n-2).
    expect(screen.getByText("Don't know the location yet? You can skip it for now and add it before you submit.")).toBeInTheDocument();
    setStore({ location: { ...emptyDraft.location, latitude: 7.29, longitude: 80.63 } });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(screen.queryByText("Don't know the location yet? You can skip it for now and add it before you submit.")).not.toBeInTheDocument();
  });
});

describe("ApplicationForm – step 1 (applicant) gating", () => {
  it("blocks a female applicant with the fields reason", async () => {
    setStore({ currentStep: 1, applicant: { ...validApplicant, gender: "Female" } });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByText("Complete all required applicant fields to continue.")).toBeInTheDocument();
  });

  it("blocks a Christian applicant", async () => {
    setStore({ currentStep: 1, applicant: { ...validApplicant, religion: "Christian" } });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByText(/not available to Christian/i)).toBeInTheDocument();
  });

  it("allows a Catholic applicant", async () => {
    setStore({ currentStep: 1, applicant: { ...validApplicant, religion: "Catholic" } });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("blocks an applicant born after the cutoff", async () => {
    const nextYear = new Date().getFullYear() + 1;
    setStore({ currentStep: 1, applicant: { ...validApplicant, dateOfBirth: `${nextYear}-02-01` } });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("allows an eligible applicant to continue", async () => {
    setStore({ currentStep: 1, applicant: validApplicant });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(screen.queryByText("Complete all required applicant fields to continue.")).not.toBeInTheDocument();
  });

  it("blocks Continue and offers recovery when the birth certificate is already used", async () => {
    checkBirthCertificateMock.mockResolvedValue({ exists: true });
    setStore({ currentStep: 1, applicant: { ...validApplicant, birthCertificateNumber: "DUP123" } });
    await renderForm();
    await waitFor(() =>
      expect(screen.getByText("This birth certificate number is already used by another applicant.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /view existing application options/i })).toBeInTheDocument();
  });

  it("does not block a unique birth certificate", async () => {
    setStore({ currentStep: 1, applicant: validApplicant });
    await renderForm();
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(screen.queryByText("This birth certificate number is already used by another applicant.")).not.toBeInTheDocument();
  });
});

describe("ApplicationForm – step 2 (guardian) gating", () => {
  const fullGuardian = { ...emptyDraft.guardian, relationship: "Mother", fullName: "Jane Doe", nic: "199012345678", phone: "+94712345678" };

  it("blocks an invalid guardian NIC", async () => {
    setStore({ currentStep: 2, guardian: { ...fullGuardian, nic: "12345" } });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByText("Enter a valid NIC number for the guardian.")).toBeInTheDocument();
  });

  it("accepts a 12-digit NIC with all fields", async () => {
    setStore({ currentStep: 2, guardian: fullGuardian });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("blocks when required guardian fields are missing", async () => {
    setStore({ currentStep: 2, guardian: { ...emptyDraft.guardian } });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    expect(screen.getByText("Complete all required guardian fields to continue.")).toBeInTheDocument();
  });
});

describe("ApplicationForm – step 4 (categories) gating", () => {
  it("blocks until at least one category is selected", async () => {
    setStore({ currentStep: 4 });
    await renderForm();
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText("Select at least one category to continue.")).toBeInTheDocument();
    setStore({ categories: validCategories });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(screen.queryByText("Select at least one category to continue.")).not.toBeInTheDocument();
  });

  it("shows indicative baseline notice on the category step", async () => {
    setStore({ ...fullValidDraft, currentStep: 4 });
    await renderForm();
    expect(screen.getByText(/baseline estimate/)).toBeInTheDocument();
    expect(screen.getByText(/interview panel/)).toBeInTheDocument();
    expect(screen.getByText("Indicative total")).toBeInTheDocument();
  });

  it("renders nearby-school maps for foreign employment and uses the sibling proximity scale", async () => {
    const foreignCategory = {
      ...validCategories[0],
      id: "foreign-category",
      categoryType: "6.6" as const,
      scoringInputs: { schoolsWithinRadius: [] },
    };
    setStore({
      ...fullValidDraft,
      currentStep: 4,
      selectedLocation: { ...emptyDraft.selectedLocation, latitude: 6.038, longitude: 80.219 },
      categories: [foreignCategory],
    });
    await renderForm();
    expect(screen.getByTestId("school-map-picker")).toBeInTheDocument();
    expect(screen.getByText(/35-mark proximity section/)).toBeInTheDocument();

    const siblingCategory = {
      ...foreignCategory,
      id: "sibling-category",
      categoryType: "6.3" as const,
      scoringInputs: { schoolsWithinRadius: ["school-1"] },
    };
    setStore({ categories: [siblingCategory] });
    await userEvent.click(screen.getByRole("tab", { name: /siblings/i }));
    expect(screen.getByRole("button", { name: "27 / 30" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "45 / 30" })).not.toBeInTheDocument();
  });
});

describe("ApplicationForm – step 5 (declaration) gating", () => {
  it("blocks until the declaration is confirmed and consented", async () => {
    setStore({ currentStep: 5, declaration: { confirmed: false, consent: false } });
    await renderForm();
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText("You must confirm the declaration and provide consent to proceed.")).toBeInTheDocument();
    setStore({ declaration: { confirmed: true, consent: true } });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });
});

describe("ApplicationForm – location history capture", () => {
  const mapPoint = { label: "Selected location", address: "1 Temple Road", latitude: 6.0343, longitude: 80.217, source: "map" };
  const deviceFix = { label: "Your location", address: "", latitude: 6.0562, longitude: 80.2205, source: "device" };
  const addressTyping = { label: "", address: "typed text", latitude: null, longitude: null, source: "manual" };

  it("records a map selection into the user history with the newest first", async () => {
    const user = userEvent.setup();
    await renderForm();
    locationChangePayload.current = { value: mapPoint };
    await user.click(screen.getByTestId("fire-location-change"));
    locationChangePayload.current = { value: { ...mapPoint, latitude: 6.0578, longitude: 80.2138 } };
    await user.click(screen.getByTestId("fire-location-change"));
    const data = currentDraftData();
    expect(data.userLocationHistory).toHaveLength(2);
    expect(data.userLocationHistory[0]).toMatchObject({ latitude: 6.0578 });
    expect(data.userLocationHistory[1]).toMatchObject({ latitude: 6.0343 });
    expect(data.deviceLocationHistory).toEqual([]);
    expect(data.selectedLocation).toMatchObject({ latitude: 6.0578 });
  });

  it("records an automatic device fix in device history without duplicating it in device array twice", async () => {
    const user = userEvent.setup();
    await renderForm();
    locationChangePayload.current = { value: deviceFix, defaultValue: deviceFix };
    await user.click(screen.getByTestId("fire-location-change"));
    const data = currentDraftData();
    expect(data.deviceLocationHistory).toHaveLength(1);
    expect(data.deviceLocationHistory[0]).toMatchObject({ latitude: 6.0562, source: "device" });
    expect(data.defaultLocations[0]).toMatchObject({ latitude: 6.0562 });
    expect(data.userLocationHistory).toHaveLength(1);
  });

  it("ignores coordinate-less address typing for both histories", async () => {
    const user = userEvent.setup();
    await renderForm();
    locationChangePayload.current = { value: addressTyping };
    await user.click(screen.getByTestId("fire-location-change"));
    const data = currentDraftData();
    expect(data.userLocationHistory).toEqual([]);
    expect(data.deviceLocationHistory).toEqual([]);
    expect(data.location.address).toBe("typed text");
  });

  it("does not duplicate consecutive identical selections", async () => {
    const user = userEvent.setup();
    await renderForm();
    locationChangePayload.current = { value: mapPoint };
    await user.click(screen.getByTestId("fire-location-change"));
    await user.click(screen.getByTestId("fire-location-change"));
    expect(currentDraftData().userLocationHistory).toHaveLength(1);
  });
});

describe("ApplicationForm – keys", () => {
  it("copies the access key and shows feedback", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setActiveKey(MOCK_ACCESS_KEY);
    await renderForm();
    const copyButton = await screen.findByRole("button", { name: "Copy access key" });
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith(MOCK_ACCESS_KEY);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("copies the session code and shows feedback", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setActiveKey(MOCK_ACCESS_KEY);
    await renderForm();
    const copyButton = await screen.findByRole("button", { name: "Copy session code" });
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith(MOCK_SESSION_CODE);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});

describe("ApplicationForm – step 3 (residence)", () => {
  it("enables Continue even with empty residence fields", async () => {
    setStore({ currentStep: 3 });
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("advances to categories when Continue is clicked", async () => {
    setStore({ currentStep: 3, residence: validResidence });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Marking scheme categories")).toBeInTheDocument();
  });

  it("copies permanent address to current when unmarked as different", async () => {
    setStore({ currentStep: 3, residence: { ...validResidence, sameAsPermanent: false, currentAddressEn: "" } });
    await renderForm();
    const checkbox = screen.getByRole("checkbox", { name: /different from the permanent address/i });
    await userEvent.click(checkbox);
    expect(useApplicationStore.getState().residence.currentAddressEn).toBe(validResidence.permanentAddressEn);
  });

  it("returns to residence when Back is clicked from the categories step", async () => {
    setStore({ ...fullValidDraft, currentStep: 4 });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    await screen.findByText("Where does the family live?");
  });
});

describe("ApplicationForm – step 6 (review)", () => {
  it("renders a summary for every section", async () => {
    setStore({ ...fullValidDraft, currentStep: 6 });
    await renderReview();
    expect(screen.getByText("Review your draft")).toBeInTheDocument();
    // The applicant/guardian names appear both in the header identity panel
    // and in the review rows.
    expect(screen.getAllByText("Ashan Perera").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Kamal Perera").length).toBeGreaterThan(0);
    expect(screen.getByText("123 Temple St, Colombo")).toBeInTheDocument();
    expect(screen.getAllByText("Colombo").length).toBeGreaterThan(0);
  });

  it("renders a Categories summary with indicative marks", async () => {
    setStore({ ...fullValidDraft, currentStep: 6 });
    await renderReview();
    expect(screen.getByText("6.1 – Residence Verification & Proximity")).toBeInTheDocument();
    expect(screen.getByText(/Main document: title-deed-applicant/)).toBeInTheDocument();
    expect(screen.getByText(/1 school within radius/)).toBeInTheDocument();
    expect(screen.getByText(/Marks \(indicative\):/)).toBeInTheDocument();
  });

  it("shows Not completed for empty fields", async () => {
    setStore({ ...emptyDraft, currentStep: 6, location: { ...emptyDraft.location, latitude: 7.29, longitude: 80.63, address: "Colombo" } });
    await renderReview();
    expect(screen.getAllByText("Not completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not selected").length).toBeGreaterThan(0);
    expect(screen.getByText("None selected")).toBeInTheDocument();
  });

  it("navigates to the correct step when Edit is clicked", async () => {
    setStore({ ...fullValidDraft, currentStep: 6 });
    await renderReview();
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[0]);
    expect(screen.getByTestId("location-step")).toBeInTheDocument();
  });

  it("jumps to the categories step when the Categories row Edit is clicked", async () => {
    setStore({ ...fullValidDraft, currentStep: 6 });
    await renderReview();
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[editButtons.length - 1]);
    expect(screen.getByText("Marking scheme categories")).toBeInTheDocument();
  });

  it("shows the submit button when declaration is confirmed and there are changes", async () => {
    setStore({ ...fullValidDraft, currentStep: 6 });
    await renderReview();
    expect(screen.getByRole("button", { name: /(submit|update) application/i })).toBeEnabled();
  });

  it("disables the submit button when declaration is not confirmed", async () => {
    setStore({ ...fullValidDraft, currentStep: 6, declaration: { confirmed: false, consent: false } });
    await renderReview();
    expect(screen.getByRole("button", { name: /(submit|update) application/i })).toBeDisabled();
  });
});

describe("ApplicationForm – submit flow", () => {
  it("submits successfully and shows the success view", async () => {
    setStore({ ...fullValidDraft, currentStep: 6 });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /(submit|update) application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
    expect(screen.getAllByText(MOCK_ACCESS_KEY).length).toBeGreaterThan(0);
  });

  it("submits even with no unsaved changes", async () => {
    setStore({ ...fullValidDraft, currentStep: 6, lastSavedAt: new Date().toISOString() });
    setActiveKey(MOCK_ACCESS_KEY);
    await renderReview();
    await screen.findByText(MOCK_ACCESS_KEY);
    await userEvent.click(screen.getByRole("button", { name: /(submit|update) application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
  });
});

describe("ApplicationForm – submit a restored application", () => {
  it("submits a fully valid restored draft", async () => {
    setActiveKey(MOCK_ACCESS_KEY);
    setActiveSessionCode(MOCK_SESSION_CODE);
    getMock.mockResolvedValue({
      data: { ...fullValidDraft, currentStep: 6 },
      sessionCode: MOCK_SESSION_CODE,
      accessKeyHint: MOCK_ACCESS_KEY.slice(-6),
      submittedAt: null,
    });
    const user = userEvent.setup();
    renderWithClient(<ApplicationForm />);
    await screen.findByText(MOCK_ACCESS_KEY);
    await user.click(screen.getByRole("button", { name: /(submit|update) application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
    expect(screen.getAllByText(MOCK_ACCESS_KEY).length).toBeGreaterThan(0);
  });
});

describe("ApplicationForm – state transitions", () => {
  it("returns to the previous step with the Back button", async () => {
    setStore({ currentStep: 1 });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByTestId("location-step")).toBeInTheDocument();
  });

  it("navigates backward through the step indicator", async () => {
    setStore({ ...fullValidDraft, currentStep: 4, maxVisitedStep: 4 });
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("button", { name: /parent \/ guardian/i }));
    await waitFor(() => expect(screen.getByText("NIC number")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /applicant/i }));
    // "Full name in English" renders as both a field label and a legend span.
    expect(screen.getAllByText("Full name in English").length).toBeGreaterThan(0);
  });

  it("resets the draft and navigates home when starting another application", async () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign: assignMock }, writable: true });
    setStore({ ...fullValidDraft, currentStep: 6, declaration: validDeclaration });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /(submit|update) application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /apply for another child/i }));
    expect(useApplicationStore.getState().currentStep).toBe(0);
    expect(useApplicationStore.getState().applicant.fullName).toBe("");
    expect(assignMock).toHaveBeenCalledWith("/application");
  });

  it("shows Saving then Saved after a successful save", async () => {
    setStore({ currentStep: 1, applicant: validApplicant });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/^Saved$/)).toBeInTheDocument();
    });
  });
});

describe("ApplicationForm – server errors", () => {
  it("resets the draft when create fails", async () => {
    createMock.mockReset().mockRejectedValue(new Error("Database unavailable"));
    await renderForm();
    expect(useApplicationStore.getState().currentStep).toBe(0);
    expect(useApplicationStore.getState().applicant.fullName).toBe("");
    expect(getActiveKey()).toBe("");
  });

  it("resets the draft when restore get fails", async () => {
    setActiveKey(MOCK_ACCESS_KEY);
    getMock.mockReset().mockRejectedValue(new Error("Key not found"));
    await renderForm();
    expect(useApplicationStore.getState().currentStep).toBe(0);
    expect(useApplicationStore.getState().applicant.fullName).toBe("");
    expect(getActiveKey()).toBe("");
  });

  it("shows an error when the submit fails", async () => {
    submitMock.mockReset().mockRejectedValue(new Error("Submission window closed"));
    setStore({ ...fullValidDraft, currentStep: 6 });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /(submit|update) application/i }));
    expect(await screen.findByText("Submission window closed")).toBeInTheDocument();
    expect(submitMock).toHaveBeenCalledWith({ accessKey: MOCK_ACCESS_KEY });
    submitMock.mockReset().mockResolvedValue({ accepted: true });
  });

  it("shows an error when update fails during save on Continue", async () => {
    updateMock.mockReset().mockRejectedValue(new Error("Save failed"));
    setStore({ currentStep: 1, applicant: validApplicant });
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText("Save failed - retrying…")).toBeInTheDocument();
    // Continue advances the step optimistically and saves in the background;
    // a failed save surfaces the status message above but does not block
    // navigation or revert the step.
    expect(useApplicationStore.getState().currentStep).toBe(2);
    updateMock.mockReset().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" });
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   FORM FIELD INTERACTIONS - actual typing into inputs
   ════════════════════════════════════════════════════════════════════════════ */

describe("ApplicationForm – form field typing", () => {
  it("types into the applicant full name field and updates the store", async () => {
    setStore({ currentStep: 1, applicant: { ...validApplicant, fullName: "" } });
    const user = userEvent.setup();
    await renderForm();
    const input = screen.getByLabelText(/full name in english/i);
    await user.type(input, "Tenuka");
    expect(useApplicationStore.getState().applicant.fullName).toBe("Tenuka");
  });

  it("types into the Sinhala name field", async () => {
    setStore({ currentStep: 1, applicant: validApplicant });
    const user = userEvent.setup();
    await renderForm();
    const input = screen.getByLabelText(/sinhala/i);
    await user.type(input, "අවිනාශ");
    expect(useApplicationStore.getState().applicant.sinhalaName).toContain("අ");
  });

  it("types into the guardian full name field", async () => {
    setStore({ currentStep: 2, guardian: { ...validGuardian, fullName: "" } });
    const user = userEvent.setup();
    await renderForm();
    const guardianInput = document.body.querySelector('[id="guardian.fullName"]') as HTMLInputElement;
    expect(guardianInput).not.toBeNull();
    await user.type(guardianInput, "Mother");
    expect(useApplicationStore.getState().guardian.fullName).toBe("Mother");
  });

  it("types into the guardian NIC field and normalizes to uppercase", async () => {
    setStore({ currentStep: 2, guardian: { ...validGuardian, nic: "" } });
    const user = userEvent.setup();
    await renderForm();
    const input = document.body.querySelector('[id="guardian.nic"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.type(input, "901234567v");
    expect(useApplicationStore.getState().guardian.nic).toBe("901234567V");
  });

  it("types into the permanent address field", async () => {
    setStore({ currentStep: 3, residence: { ...validResidence, permanentAddressEn: "" } });
    const user = userEvent.setup();
    await renderForm();
    const input = document.body.querySelector('[id="residence.permanentAddressEn"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.type(input, "123 Main St");
    expect(useApplicationStore.getState().residence.permanentAddressEn).toBe("123 Main St");
  });

  it("types into the current address field", async () => {
    setStore({ currentStep: 3, residence: { ...validResidence, sameAsPermanent: false, currentAddressEn: "" } });
    const user = userEvent.setup();
    await renderForm();
    const input = document.body.querySelector('[id="residence.currentAddressEn"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.type(input, "456 Park Rd");
    expect(useApplicationStore.getState().residence.currentAddressEn).toBe("456 Park Rd");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   DECLARATION CHECKBOX CLICKS
   ════════════════════════════════════════════════════════════════════════════ */

describe("ApplicationForm – declaration checkbox clicks", () => {
  it("clicking confirm checkbox toggles declaration.confirmed", async () => {
    setStore({ currentStep: 5, declaration: { confirmed: false, consent: false } });
    const user = userEvent.setup();
    await renderForm();
    const checkbox = screen.getByRole("checkbox", { name: /confirm/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(useApplicationStore.getState().declaration.confirmed).toBe(true);
  });

  it("clicking consent checkbox toggles declaration.consent", async () => {
    setStore({ currentStep: 5, declaration: { confirmed: false, consent: false } });
    const user = userEvent.setup();
    await renderForm();
    const checkbox = screen.getByRole("checkbox", { name: /consent/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(useApplicationStore.getState().declaration.consent).toBe(true);
  });

  it("clicking both checkboxes enables Continue", async () => {
    setStore({ currentStep: 5, declaration: { confirmed: false, consent: false } });
    const user = userEvent.setup();
    await renderForm();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /confirm/i }));
    await user.click(screen.getByRole("checkbox", { name: /consent/i }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   SUBMISSION LOCKED STATE
   ════════════════════════════════════════════════════════════════════════════ */

describe("ApplicationForm – submission locked state", () => {
  it("shows the locked banner when submission is outside the window", async () => {
    statusMock.mockResolvedValue({
      submissionLocked: true,
      submissionOpensAt: "2026-09-09T00:00:00+05:30",
      submissionClosesAt: "2026-09-12T00:00:00+05:30",
      environment: "test",
    });
    // Need submittedAt set so collectionOnly = true
    getMock.mockResolvedValue({
      data: { ...fullValidDraft, currentStep: 6 },
      sessionCode: MOCK_SESSION_CODE,
      accessKeyHint: MOCK_ACCESS_KEY.slice(-6),
      submittedAt: "2026-08-01T00:00:00Z",
    });
    setActiveKey(MOCK_ACCESS_KEY);
    setActiveSessionCode(MOCK_SESSION_CODE);
    await renderReview();
    expect(screen.getByText(/submission is outside/i)).toBeInTheDocument();
    expect(screen.getByText(/Submission opens 9 Sep 2026/i)).toBeInTheDocument();
  });

  it("shows 'Submission opens' button text when collectionOnly", async () => {
    statusMock.mockResolvedValue({
      submissionLocked: true,
      submissionOpensAt: "2026-09-09T00:00:00+05:30",
      submissionClosesAt: "2026-09-12T00:00:00+05:30",
      environment: "test",
    });
    // Create a submitted application (submittedAt set) so collectionOnly is true
    getMock.mockResolvedValue({
      data: { ...fullValidDraft, currentStep: 6 },
      sessionCode: MOCK_SESSION_CODE,
      accessKeyHint: MOCK_ACCESS_KEY.slice(-6),
      submittedAt: "2026-08-01T00:00:00Z",
    });
    setActiveKey(MOCK_ACCESS_KEY);
    setActiveSessionCode(MOCK_SESSION_CODE);
    await renderReview();
    expect(screen.getByText(/Submission opens 9 Sep 2026/)).toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   SUBMISSION REQUEST DIALOG
   ════════════════════════════════════════════════════════════════════════════ */

describe("ApplicationForm – submission request dialog", () => {
  const { requestAccessMock } = vi.hoisted(() => ({ requestAccessMock: vi.fn() }));

  it("shows the approval request form when submit fails with window closed error", async () => {
    submitMock.mockRejectedValue(new Error("Submissions are outside the configured form window"));
    requestAccessMock.mockResolvedValue({ submitted: true });
    setStore({ ...fullValidDraft, currentStep: 6 });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    expect(await screen.findByText(/request approval to submit/i)).toBeInTheDocument();
    expect(screen.getByText(/submission window is closed/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/phone/i)).toBeInTheDocument();
  });

  it("sends the approval request with name and phone", async () => {
    submitMock.mockRejectedValue(new Error("Submissions are outside the configured form window"));
    requestAccessMock.mockResolvedValue({ submitted: true });
    setStore({ ...fullValidDraft, currentStep: 6 });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    await screen.findByText(/request approval to submit/i);
    await user.type(screen.getByPlaceholderText(/full name/i), "Test User");
    await user.type(screen.getByPlaceholderText(/phone/i), "0712345678");
    await user.click(screen.getByRole("button", { name: /send approval request/i }));
    await waitFor(() => {
      expect(screen.queryByText(/request approval to submit/i)).not.toBeInTheDocument();
    });
  });

  it("hides the approval request form when Cancel is clicked", async () => {
    submitMock.mockRejectedValue(new Error("Submissions are outside the configured form window"));
    setStore({ ...fullValidDraft, currentStep: 6 });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /submit application/i }));
    await screen.findByText(/request approval to submit/i);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/request approval to submit/i)).not.toBeInTheDocument();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   BIRTH CERTIFICATE DUPLICATE DRAWER
   ════════════════════════════════════════════════════════════════════════════ */

describe("ApplicationForm – birth certificate duplicate drawer", () => {
  it("opens the drawer and shows removal form when duplicate detected", async () => {
    checkBirthCertificateMock.mockResolvedValue({ exists: true });
    setStore({ currentStep: 1, applicant: { ...validApplicant, birthCertificateNumber: "DUP123" } });
    const user = userEvent.setup();
    await renderForm();
    await waitFor(() =>
      expect(screen.getByText("This birth certificate number is already used by another applicant.")).toBeInTheDocument(),
    );
    // Click the trigger to open the drawer
    const trigger = screen.getByRole("button", { name: /view existing application options/i });
    await user.click(trigger);
    // Verify drawer content appears
    expect(await screen.findByText("Existing application found")).toBeInTheDocument();
    expect(screen.getByText(/ask the school to remove/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/applicant name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/guardian name/i)).toBeInTheDocument();
  });

  it("fills the removal request form and submits", async () => {
    checkBirthCertificateMock.mockResolvedValue({ exists: true });
    setStore({ currentStep: 1, applicant: { ...validApplicant, birthCertificateNumber: "DUP123" } });
    const user = userEvent.setup();
    await renderForm();
    await waitFor(() =>
      expect(screen.getByText("This birth certificate number is already used by another applicant.")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /view existing application options/i }));
    await screen.findByText("Existing application found");
    // Fill the removal form
    await user.type(screen.getByPlaceholderText(/applicant name/i), "Test Applicant");
    await user.type(screen.getByPlaceholderText(/guardian name/i), "Test Guardian");
    await user.type(screen.getByPlaceholderText(/contact phone/i), "+94712345678");
    // The removal button should be enabled now (all 3 fields filled)
    const removeButton = screen.getByRole("button", { name: /request record removal/i });
    expect(removeButton).toBeEnabled();
    await user.click(removeButton);
    // Should show sending state then success
    expect(await screen.findByRole("status")).toHaveTextContent(/removal request sent/i);
  });

  it("disables the removal button when fields are missing", async () => {
    checkBirthCertificateMock.mockResolvedValue({ exists: true });
    setStore({ currentStep: 1, applicant: { ...validApplicant, birthCertificateNumber: "DUP123" } });
    const user = userEvent.setup();
    await renderForm();
    await waitFor(() =>
      expect(screen.getByText("This birth certificate number is already used by another applicant.")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /view existing application options/i }));
    await screen.findByText("Existing application found");
    // Button should be disabled without filling the form
    expect(screen.getByRole("button", { name: /request record removal/i })).toBeDisabled();
    // Fill only applicant name
    await user.type(screen.getByPlaceholderText(/applicant name/i), "Test");
    // Still disabled (guardian name and phone missing)
    expect(screen.getByRole("button", { name: /request record removal/i })).toBeDisabled();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   SELECT DROPDOWN INTERACTIONS
   ════════════════════════════════════════════════════════════════════════════ */

describe("ApplicationForm – select dropdown interactions", () => {
  it("selecting Female gender shows the blocked message", async () => {
    setStore({ currentStep: 1, applicant: { ...validApplicant, gender: "" } });
    const user = userEvent.setup();
    await renderForm();
    // Open the gender select
    const genderTrigger = document.body.querySelector('[id="applicant.gender"]') as HTMLElement;
    expect(genderTrigger).not.toBeNull();
    await user.click(genderTrigger);
    // Click Female option in the popover
    await waitFor(() => {
      const femaleOption = document.body.querySelector('[role="option"]');
      expect(femaleOption).not.toBeNull();
    });
    const options = document.body.querySelectorAll('[role="option"]');
    let femaleOption: HTMLElement | null = null;
    options.forEach((opt) => {
      if (/female/i.test(opt.textContent ?? "")) femaleOption = opt as HTMLElement;
    });
    expect(femaleOption).not.toBeNull();
    await user.click(femaleOption!);
    expect(useApplicationStore.getState().applicant.gender).toBe("Female");
    expect(screen.getByText(/boys.*school/i)).toBeInTheDocument();
  });

  it("selecting Christian religion shows the blocked message", async () => {
    setStore({ currentStep: 1, applicant: { ...validApplicant, religion: "" } });
    const user = userEvent.setup();
    await renderForm();
    const religionTrigger = document.body.querySelector('[id="applicant.religion"]') as HTMLElement;
    expect(religionTrigger).not.toBeNull();
    await user.click(religionTrigger);
    await waitFor(() => {
      const options = document.body.querySelectorAll('[role="option"]');
      expect(options.length).toBeGreaterThan(0);
    });
    const options = document.body.querySelectorAll('[role="option"]');
    let christianOption: HTMLElement | null = null;
    options.forEach((opt) => {
      if (/christian/i.test(opt.textContent ?? "")) christianOption = opt as HTMLElement;
    });
    expect(christianOption).not.toBeNull();
    await user.click(christianOption!);
    expect(useApplicationStore.getState().applicant.religion).toBe("Christian");
    expect(screen.getByText(/not available to christian/i)).toBeInTheDocument();
  });

  it("selecting relationship updates the store", async () => {
    setStore({ currentStep: 2, guardian: { ...validGuardian, relationship: "" } });
    const user = userEvent.setup();
    await renderForm();
    const relationshipTrigger = document.body.querySelector('[id="guardian.relationship"]') as HTMLElement;
    expect(relationshipTrigger).not.toBeNull();
    await user.click(relationshipTrigger);
    await waitFor(() => {
      const options = document.body.querySelectorAll('[role="option"]');
      expect(options.length).toBeGreaterThan(0);
    });
    const options = document.body.querySelectorAll('[role="option"]');
    let motherOption: HTMLElement | null = null;
    options.forEach((opt) => {
      if (/mother/i.test(opt.textContent ?? "")) motherOption = opt as HTMLElement;
    });
    expect(motherOption).not.toBeNull();
    await user.click(motherOption!);
    expect(useApplicationStore.getState().guardian.relationship).toBe("Mother");
  });
  
});

describe("ApplicationForm – skip stickiness and outstanding detection", () => {
    it("birth cert typing after skip stays sticky", async () => {
      const user = userEvent.setup();
      setStore({ currentStep: 1, applicant: { ...validApplicant, birthCertificateNumber: "" }, birthCertificateStatus: "skipped" });
      await renderForm();
      expect(screen.getByText("Already skipped — enter the number below or continue without it.")).toBeInTheDocument();
      const birthCertInput = screen.getByPlaceholderText(/enter birth certificate number/i);
      await user.type(birthCertInput, "ABC999");
      expect(useApplicationStore.getState().birthCertificateStatus).toBe("skipped");
      expect(screen.getByText("Previously skipped — you can update or remove this field.")).toBeInTheDocument();
  });

    it("location map-click after skip stays sticky", async () => {
      const user = userEvent.setup();
      setStore({ currentStep: 0, locationStatus: "skipped" });
      locationChangePayload.current = { value: { label: "Test Location", address: "Test Address", latitude: 6.03, longitude: 80.21, source: "map" } };
      await renderForm();
      await user.click(screen.getByTestId("fire-location-change"));
      expect(useApplicationStore.getState().locationStatus).toBe("skipped");
});

    it("declaration step keeps showing a skipped-then-filled field", async () => {
      setStore({
        currentStep: 5,
        locationStatus: "skipped",
        location: { ...emptyDraft.location, latitude: 6.03, longitude: 80.21 },
        birthCertificateStatus: "skipped",
        applicant: { ...validApplicant, birthCertificateNumber: "ABC999" },
        maxVisitedStep: 5,
      });
      await renderForm();
      expect(screen.getByTestId("location-step")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter birth certificate number/i)).toBeInTheDocument();
    });

    it("declaration step catches a silently-cleared, never-explicitly-skipped field", async () => {
      setStore({
        currentStep: 5,
        locationStatus: "pending",
        location: emptyDraft.location,
        maxVisitedStep: 5,
        birthCertificateStatus: "provided",
        applicant: { ...validApplicant, birthCertificateNumber: "" },
      });
      await renderForm();
      expect(screen.getByTestId("location-step")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter birth certificate number/i)).toBeInTheDocument();
    });

    it("declaration step negative/regression control: fully valid state doesn't show recap", async () => {
      setStore({ ...fullValidDraft, currentStep: 5, maxVisitedStep: 5 });
      await renderForm();
      expect(screen.queryByTestId("location-step")).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/enter birth certificate number/i)).not.toBeInTheDocument();
      expect(screen.queryByText("You skipped some details earlier — complete them before submitting.")).not.toBeInTheDocument();
    });

    it("stepper flags a silently-cleared field even without an explicit skip", async () => {
      setStore({ currentStep: 1, maxVisitedStep: 5, birthCertificateStatus: "provided", applicant: { ...validApplicant, birthCertificateNumber: "" } });
      await renderForm();
      const nav = screen.getByRole("navigation", { name: /form steps/i });
      const applicantButton = within(nav).getByRole("button", { name: /applicant/i });
      expect(applicantButton.className).toMatch(/text-amber-700/);
    });

    it("stepper regression guard: a fine, not-yet-visited step must NOT be flagged", async () => {
      setStore({ currentStep: 0, maxVisitedStep: 0 });
      await renderForm();
      const nav = screen.getByRole("navigation", { name: /form steps/i });
      const applicantButton = within(nav).getByRole("button", { name: /applicant/i });
      expect(applicantButton.className).not.toMatch(/text-amber-700/);
    });
});
