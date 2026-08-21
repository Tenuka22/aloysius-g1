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
vi.mock("./location-step", () => ({ LocationStep: () => <div data-testid="location-step" /> }));

function setStore(patch: Partial<typeof emptyDraft>) {
  act(() => useApplicationStore.setState({ ...patch }));
}

function renderForm() {
  render(<ApplicationForm />);
  return screen.findByRole("button", { name: /continue/i });
}

function renderReview() {
  render(<ApplicationForm />);
  return screen.findByRole("button", { name: /update application/i });
}

function currentDraftData(): typeof emptyDraft {
  const { updateDraft: _u, setStep: _s, reset: _r, ...draftState } = useApplicationStore.getState();
  return draftState;
}

beforeEach(() => {
  useApplicationStore.getState().reset();
  localStorage.clear();
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

const fullValidDraft = {
  ...emptyDraft,
  location: { ...emptyDraft.location, latitude: 7.29, longitude: 80.63, address: "Colombo, Sri Lanka" },
  applicant: validApplicant,
  guardian: validGuardian,
  residence: validResidence,
  declaration: validDeclaration,
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

describe("ApplicationForm — step 4 (declaration) gating", () => {
  it("blocks until the declaration is confirmed and consented", async () => {
    setStore({ currentStep: 4, declaration: { confirmed: false, consent: false } });
    await renderForm();
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText("You must confirm the declaration and provide consent to proceed.")).toBeInTheDocument();
    setStore({ declaration: { confirmed: true, consent: true } });
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
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

  it("advances to declaration when Continue is clicked", async () => {
    setStore({ currentStep: 3, residence: validResidence });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByText("Confirm before review")).toBeInTheDocument();
  });

  it("copies permanent address to current when sameAsPermanent is toggled", async () => {
    setStore({ currentStep: 3, residence: { ...validResidence, sameAsPermanent: false, currentAddress: "" } });
    await renderForm();
    const checkbox = screen.getByRole("checkbox", { name: /same as permanent/i });
    await userEvent.click(checkbox);
    expect(useApplicationStore.getState().residence.currentAddress).toBe(validResidence.permanentAddress);
  });

  it("returns to step 3 when Back is clicked from step 4", async () => {
    setStore({ ...fullValidDraft, currentStep: 4 });
    await renderForm();
    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    await screen.findByText("Where does the family live?");
  });
});

describe("ApplicationForm — step 5 (review)", () => {
  it("renders a summary for every section", async () => {
    setStore({ ...fullValidDraft, currentStep: 5 });
    await renderReview();
    expect(screen.getByText("Review your draft")).toBeInTheDocument();
    expect(screen.getByText("Ashan Perera")).toBeInTheDocument();
    expect(screen.getByText("Kamal Perera")).toBeInTheDocument();
    expect(screen.getByText("123 Temple St, Colombo")).toBeInTheDocument();
    expect(screen.getAllByText("Colombo").length).toBeGreaterThan(0);
  });

  it("shows Not completed for empty fields", async () => {
    setStore({ ...emptyDraft, currentStep: 5, location: { ...emptyDraft.location, latitude: 7.29, longitude: 80.63, address: "Colombo" } });
    await renderReview();
    expect(screen.getAllByText("Not completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not selected").length).toBeGreaterThan(0);
  });

  it("navigates to the correct step when Edit is clicked", async () => {
    setStore({ ...fullValidDraft, currentStep: 5 });
    await renderReview();
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await userEvent.click(editButtons[0]);
    expect(screen.getByTestId("location-step")).toBeInTheDocument();
  });

  it("shows the submit button when declaration is confirmed and there are changes", async () => {
    setStore({ ...fullValidDraft, currentStep: 5 });
    await renderReview();
    expect(screen.getByRole("button", { name: /update application/i })).toBeEnabled();
  });

  it("disables the submit button when declaration is not confirmed", async () => {
    setStore({ ...fullValidDraft, currentStep: 5, declaration: { confirmed: false, consent: false } });
    await renderReview();
    expect(screen.getByRole("button", { name: /update application/i })).toBeDisabled();
  });
});

describe("ApplicationForm — submit flow", () => {
  it("submits successfully and shows the success view", async () => {
    setStore({ ...fullValidDraft, currentStep: 5 });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /update application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
    expect(screen.getAllByText(MOCK_ACCESS_KEY).length).toBeGreaterThan(0);
  });

  it("submits even with no unsaved changes", async () => {
    setStore({ ...fullValidDraft, currentStep: 5, lastSavedAt: new Date().toISOString() });
    await renderReview();
    await screen.findByText(MOCK_ACCESS_KEY);
    await userEvent.click(screen.getByRole("button", { name: /update application/i }));
    expect(await screen.findByText("Application submitted successfully.")).toBeInTheDocument();
  });
});

describe("ApplicationForm — submit a restored application", () => {
  it("submits a fully valid restored draft", async () => {
    localStorage.setItem("aloysius-g1-application-key", MOCK_ACCESS_KEY);
    localStorage.setItem("aloysius-g1-application-session-code", MOCK_SESSION_CODE);
    getMock.mockResolvedValue({
      data: { ...fullValidDraft, currentStep: 5 },
      sessionCode: MOCK_SESSION_CODE,
      accessKeyHint: MOCK_ACCESS_KEY.slice(-6),
      submittedAt: null,
    });
    const user = userEvent.setup();
    render(<ApplicationForm />);
    await screen.findByText(MOCK_ACCESS_KEY);
    await user.click(screen.getByRole("button", { name: /update application/i }));
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
    setStore({ ...fullValidDraft, currentStep: 5, declaration: validDeclaration });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /update application/i }));
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
    setStore({ ...fullValidDraft, currentStep: 5 });
    const user = userEvent.setup();
    await renderReview();
    await user.click(screen.getByRole("button", { name: /update application/i }));
    expect(await screen.findByText("Submission window closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update application/i })).toBeDisabled();
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
