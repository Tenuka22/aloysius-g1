// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationForm } from "./application-form";
import { emptyDraft, useApplicationStore } from "@/lib/application-store";

const { MOCK_ACCESS_KEY, MOCK_SESSION_CODE } = vi.hoisted(() => ({
  MOCK_ACCESS_KEY: "ALY-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO",
  MOCK_SESSION_CODE: "26ABC123",
}));

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

function setStore(patch: Partial<typeof emptyDraft>) {
  act(() => useApplicationStore.setState({ ...patch }));
}

function renderForm() {
  render(<ApplicationForm />);
  return screen.findByRole("button", { name: /continue/i });
}

function renderReview() {
  render(<ApplicationForm />);
  return screen.findByRole("button", { name: /(submit|update) application/i });
}

function currentDraftData(): typeof emptyDraft {
  const { updateDraft: _u, setStep: _s, reset: _r, ...draftState } = useApplicationStore.getState();
  return draftState;
}

beforeEach(() => {
  useApplicationStore.getState().reset();
  localStorage.clear();
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
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});

const validApplicant = {
  fullName: "Ashan Perera",
  sinhalaName: "",
  gender: "Male",
  religion: "Buddhist",
  educationMedium: "Sinhala",
  dateOfBirth: "2021-01-01",
  birthCertificateNumber: "ABC123",
};

const validGuardian = {
  relationship: "Father",
  fullName: "Kamal Perera",
  nic: "199012345678",
  phone: "+94712345678",
  whatsappPhone: "",
  email: "kamal@example.com",
};

const validResidence = {
  permanentAddress: "123 Temple St, Colombo",
  currentAddress: "456 Park Rd, Colombo",
  sameAsPermanent: false,
  district: "Colombo",
  dsDivision: "Colombo",
  gnDivision: "Mirihana",
  electoralDistrict: "Colombo",
};

const validDeclaration = { confirmed: true, consent: true };

const validCategories: typeof emptyDraft.categories = [
  {
    id: "cat-1",
    categoryType: "6.1",
    scoringInputs: { mainDocumentType: "title-deed-applicant", schoolsWithinRadius: ["school-1"] },
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

describe("ApplicationForm — step 0 (location)", () => {
  it("blocks Continue until a location is ready", async () => {
    await renderForm();
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText("Select a location on the map to continue.")).toBeInTheDocument();
    setStore({ location: { ...emptyDraft.location, latitude: 7.29, longitude: 80.63 } });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
    expect(screen.queryByText("Select a location on the map to continue.")).not.toBeInTheDocument();
  });
});

describe("ApplicationForm — step 1 (applicant) gating", () => {
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

describe("ApplicationForm — step 2 (guardian) gating", () => {
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

describe("ApplicationForm — step 4 (categories) gating", () => {
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
});

describe("ApplicationForm — step 5 (declaration) gating", () => {
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

describe("ApplicationForm — location history capture", () => {
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
    expect(data.defaultLocation).toMatchObject({ latitude: 6.0562 });
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

describe("ApplicationForm — keys", () => {
  it("copies the access key and shows feedback", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
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
    await renderForm();
    const copyButton = await screen.findByRole("button", { name: "Copy session code" });
    await user.click(copyButton);
    expect(writeText).toHaveBeenCalledWith(MOCK_SESSION_CODE);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});

describe("ApplicationForm — step 3 (residence)", () => {
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

  it("copies permanent address to current when sameAsPermanent is toggled", async () => {
    setStore({ currentStep: 3, residence: { ...validResidence, sameAsPermanent: false, currentAddress: "" } });
    await renderForm();
    const checkbox = screen.getByRole("checkbox", { name: /same as permanent/i });
    await userEvent.click(checkbox);
    expect(useApplicationStore.getState().residence.currentAddress).toBe(validResidence.permanentAddress);
  });

  it("returns to residence when Back is clicked from the categories step", async () => {
    setStore({ ...fullValidDraft, currentStep: 4 });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    await screen.findByText("Where does the family live?");
  });
});

describe("ApplicationForm — step 6 (review)", () => {
  it("renders a summary for every section", async () => {
    setStore({ ...fullValidDraft, currentStep: 6 });
    await renderReview();
    expect(screen.getByText("Review your draft")).toBeInTheDocument();
    expect(screen.getByText("Ashan Perera")).toBeInTheDocument();
    expect(screen.getByText("Kamal Perera")).toBeInTheDocument();
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

describe("ApplicationForm — submit flow", () => {
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
    await renderReview();
    await screen.findByText(MOCK_ACCESS_KEY);
    await userEvent.click(screen.getByRole("button", { name: /(submit|update) application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
  });
});

describe("ApplicationForm — submit a restored application", () => {
  it("submits a fully valid restored draft", async () => {
    localStorage.setItem("aloysius-g1-application-key", MOCK_ACCESS_KEY);
    localStorage.setItem("aloysius-g1-application-session-code", MOCK_SESSION_CODE);
    getMock.mockResolvedValue({
      data: { ...fullValidDraft, currentStep: 6 },
      sessionCode: MOCK_SESSION_CODE,
      accessKeyHint: MOCK_ACCESS_KEY.slice(-6),
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<ApplicationForm />);
    await screen.findByText(MOCK_ACCESS_KEY);
    await user.click(screen.getByRole("button", { name: /(submit|update) application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
    expect(screen.getAllByText(MOCK_ACCESS_KEY).length).toBeGreaterThan(0);
  });
});

describe("ApplicationForm — state transitions", () => {
  it("returns to the previous step with the Back button", async () => {
    setStore({ currentStep: 1 });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByTestId("location-step")).toBeInTheDocument();
  });

  it("navigates backward through the step indicator", async () => {
    setStore({ ...fullValidDraft, currentStep: 4 });
    const user = userEvent.setup();
    await renderForm();
    await user.click(screen.getByRole("button", { name: /parent \/ guardian/i }));
    await waitFor(() => expect(screen.getByText("NIC number")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /applicant/i }));
    expect(screen.getByText("Full name")).toBeInTheDocument();
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

  it("shows Saved locally after a successful save", async () => {
    setStore({ currentStep: 1, applicant: validApplicant });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByText("Saved locally")).toBeInTheDocument());
  });
});

describe("ApplicationForm — server errors", () => {
  it("resets the draft when create fails", async () => {
    createMock.mockReset().mockRejectedValue(new Error("Database unavailable"));
    await renderForm();
    expect(useApplicationStore.getState().currentStep).toBe(0);
    expect(useApplicationStore.getState().applicant.fullName).toBe("");
    expect(localStorage.getItem("aloysius-g1-application-key")).toBeNull();
  });

  it("resets the draft when restore get fails", async () => {
    localStorage.setItem("aloysius-g1-application-key", MOCK_ACCESS_KEY);
    getMock.mockReset().mockRejectedValue(new Error("Key not found"));
    await renderForm();
    expect(useApplicationStore.getState().currentStep).toBe(0);
    expect(useApplicationStore.getState().applicant.fullName).toBe("");
    expect(localStorage.getItem("aloysius-g1-application-key")).toBeNull();
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
    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(useApplicationStore.getState().currentStep).toBe(1);
    updateMock.mockReset().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" });
  });
});
