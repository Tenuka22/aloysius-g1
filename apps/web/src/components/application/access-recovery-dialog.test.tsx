// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessRecoveryDialog } from "./access-recovery-dialog";

const { requestAccessMock } = vi.hoisted(() => ({ requestAccessMock: vi.fn() }));

vi.mock("@/utils/orpc", () => ({
  client: { application: { requestAccess: requestAccessMock } },
}));

function renderDialog(props: { applicantName?: string } = {}) {
  const onForgot = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(<AccessRecoveryDialog applicantName={props.applicantName ?? ""} open onOpenChange={onOpenChange} onForgot={onForgot} />);
  return { onForgot, onOpenChange, ...utils };
}

describe("AccessRecoveryDialog — submit gating", () => {
  beforeEach(() => {
    requestAccessMock.mockReset();
    requestAccessMock.mockResolvedValue({ submitted: true });
  });

  it("stays disabled until a session code and phone are provided", async () => {
    const user = userEvent.setup();
    renderDialog();
    const submit = screen.getByRole("button", { name: /forget key and request help/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Session code"), "26ABC123");
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    expect(submit).toBeEnabled();
  });

  it("does not enable for a phone alone", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    expect(screen.getByRole("button", { name: /forget key and request help/i })).toBeDisabled();
  });
});

describe("AccessRecoveryDialog — session mode", () => {
  beforeEach(() => {
    requestAccessMock.mockReset();
    requestAccessMock.mockResolvedValue({ submitted: true });
  });

  it("submits the session code and phone on success", async () => {
    const user = userEvent.setup();
    const { onForgot } = renderDialog();
    await user.type(screen.getByPlaceholderText("Session code"), "26ABC123");
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    await user.click(screen.getByRole("button", { name: /forget key and request help/i }));
    await waitFor(() => expect(onForgot).toHaveBeenCalledTimes(1));
    expect(requestAccessMock).toHaveBeenCalledWith({
      sessionCode: "26ABC123",
      birthCertificateNumber: undefined,
      guardianNic: undefined,
      applicantName: "",
      contactPhone: "+94712345678",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Request sent. An administrator will contact you");
  });

  it("shows the server error message when the request fails", async () => {
    requestAccessMock.mockRejectedValue(new Error("No application was found for this birth certificate number"));
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByPlaceholderText("Session code"), "26ABC999");
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    await user.click(screen.getByRole("button", { name: /forget key and request help/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("No application was found for this birth certificate number");
    expect(screen.getByRole("button", { name: /forget key and request help/i })).toBeEnabled();
  });
});

describe("AccessRecoveryDialog — birth certificate mode", () => {
  it("submits the birth certificate number", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.selectOptions(screen.getByLabelText("Recovery method"), "birth");
    const submit = screen.getByRole("button", { name: /forget key and request help/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Birth certificate number"), "ABC1234567");
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    await user.click(submit);
    await waitFor(() =>
      expect(requestAccessMock).toHaveBeenCalledWith(
        expect.objectContaining({ birthCertificateNumber: "ABC1234567", sessionCode: undefined, guardianNic: undefined }),
      ),
    );
    expect(requestAccessMock.mock.calls[0][0].requestType).toBeUndefined();
  });
});

describe("AccessRecoveryDialog — guardian NIC mode", () => {
  it("requires both the NIC and the applicant name", async () => {
    const user = userEvent.setup();
    renderDialog({ applicantName: "Ashan Perera" });
    await user.selectOptions(screen.getByLabelText("Recovery method"), "guardian");
    const submit = screen.getByRole("button", { name: /forget key and request help/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    await user.type(screen.getByPlaceholderText("Guardian NIC"), "901234567V");
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() =>
      expect(requestAccessMock).toHaveBeenCalledWith(
        expect.objectContaining({ guardianNic: "901234567V", applicantName: "Ashan Perera", sessionCode: undefined, birthCertificateNumber: undefined }),
      ),
    );
  });
});

describe("AccessRecoveryDialog — mode switching", () => {
  it("switches between session, birth certificate, and guardian modes", async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByPlaceholderText("Session code")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Recovery method"), "birth");
    expect(screen.getByPlaceholderText("Birth certificate number")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Recovery method"), "guardian");
    expect(screen.getByPlaceholderText("Guardian NIC")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Applicant name")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Recovery method"), "session");
    expect(screen.getByPlaceholderText("Session code")).toBeInTheDocument();
  });

  it("shows an error when the request fails in guardian mode", async () => {
    requestAccessMock.mockRejectedValue(new Error("Guardian NIC not found"));
    const user = userEvent.setup();
    renderDialog({ applicantName: "Ashan Perera" });
    await user.selectOptions(screen.getByLabelText("Recovery method"), "guardian");
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    await user.type(screen.getByPlaceholderText("Guardian NIC"), "901234567V");
    await user.click(screen.getByRole("button", { name: /forget key and request help/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Guardian NIC not found");
  });

  it("keeps the previous message visible when switching modes", async () => {
    requestAccessMock.mockRejectedValue(new Error("Not found"));
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByPlaceholderText("Session code"), "26ABC999");
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    await user.click(screen.getByRole("button", { name: /forget key and request help/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("Not found");
    await user.selectOptions(screen.getByLabelText("Recovery method"), "birth");
    expect(screen.getByRole("status")).toHaveTextContent("Not found");
  });
});