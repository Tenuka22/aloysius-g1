import { beforeEach, describe, expect, it } from "vitest";
import { useHomeUiStore } from "./home-ui-store";

function reset() {
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
}

describe("useHomeUiStore", () => {
  beforeEach(reset);

  it("starts with every dialog closed and no inputs", () => {
    const state = useHomeUiStore.getState();
    expect(state.removeKey).toBeNull();
    expect(state.recoveryKey).toBeNull();
    expect(state.recoveryOpen).toBe(false);
    expect(state.manageKeysOpen).toBe(false);
    expect(state.loadKeyOpen).toBe(false);
    expect(state.loadKeyInput).toBe("");
    expect(state.loadKeyError).toBe("");
    expect(state.qrImportOpen).toBe(false);
  });

  describe("setRemoveKey", () => {
    it("stores the key pending removal", () => {
      useHomeUiStore.getState().setRemoveKey("ALY-key-1");
      expect(useHomeUiStore.getState().removeKey).toBe("ALY-key-1");
    });

    it("clears the key when set back to null", () => {
      useHomeUiStore.getState().setRemoveKey("ALY-key-1");
      useHomeUiStore.getState().setRemoveKey(null);
      expect(useHomeUiStore.getState().removeKey).toBeNull();
    });
  });

  describe("recovery dialog", () => {
    it("openRecovery sets the key and opens the dialog", () => {
      useHomeUiStore.getState().openRecovery("ALY-key-2");
      const state = useHomeUiStore.getState();
      expect(state.recoveryKey).toBe("ALY-key-2");
      expect(state.recoveryOpen).toBe(true);
    });

    it("openRecovery accepts null (open without a preselected key)", () => {
      useHomeUiStore.getState().openRecovery(null);
      const state = useHomeUiStore.getState();
      expect(state.recoveryKey).toBeNull();
      expect(state.recoveryOpen).toBe(true);
    });

    it("closeRecovery clears the key and closes the dialog", () => {
      useHomeUiStore.getState().openRecovery("ALY-key-2");
      useHomeUiStore.getState().closeRecovery();
      const state = useHomeUiStore.getState();
      expect(state.recoveryKey).toBeNull();
      expect(state.recoveryOpen).toBe(false);
    });
  });

  describe("manage keys dialog", () => {
    it("toggles open and closed", () => {
      const store = useHomeUiStore.getState();
      store.setManageKeysOpen(true);
      expect(useHomeUiStore.getState().manageKeysOpen).toBe(true);
      useHomeUiStore.getState().setManageKeysOpen(false);
      expect(useHomeUiStore.getState().manageKeysOpen).toBe(false);
    });
  });

  describe("load key dialog", () => {
    it("openLoadKey opens the dialog without touching inputs", () => {
      useHomeUiStore.getState().setLoadKeyInput("stale-value");
      useHomeUiStore.getState().openLoadKey();
      const state = useHomeUiStore.getState();
      expect(state.loadKeyOpen).toBe(true);
      expect(state.loadKeyInput).toBe("stale-value");
    });

    it("setLoadKeyInput updates the input and clears any error", () => {
      useHomeUiStore.getState().setLoadKeyError("Invalid key");
      useHomeUiStore.getState().setLoadKeyInput("ALY-new");
      const state = useHomeUiStore.getState();
      expect(state.loadKeyInput).toBe("ALY-new");
      expect(state.loadKeyError).toBe("");
    });

    it("setLoadKeyError sets the message without touching the input", () => {
      useHomeUiStore.getState().setLoadKeyInput("ALY-123");
      useHomeUiStore.getState().setLoadKeyError("No application found");
      const state = useHomeUiStore.getState();
      expect(state.loadKeyError).toBe("No application found");
      expect(state.loadKeyInput).toBe("ALY-123");
    });

    it("closeLoadKey closes the dialog and resets input and error", () => {
      useHomeUiStore.getState().openLoadKey();
      useHomeUiStore.getState().setLoadKeyInput("ALY-123");
      useHomeUiStore.getState().setLoadKeyError("boom");
      useHomeUiStore.getState().closeLoadKey();
      const state = useHomeUiStore.getState();
      expect(state.loadKeyOpen).toBe(false);
      expect(state.loadKeyInput).toBe("");
      expect(state.loadKeyError).toBe("");
    });
  });

  describe("qr import dialog", () => {
    it("toggles open and closed", () => {
      useHomeUiStore.getState().setQrImportOpen(true);
      expect(useHomeUiStore.getState().qrImportOpen).toBe(true);
      useHomeUiStore.getState().setQrImportOpen(false);
      expect(useHomeUiStore.getState().qrImportOpen).toBe(false);
    });
  });

  it("dialogs operate independently", () => {
    useHomeUiStore.getState().openRecovery("ALY-key-3");
    useHomeUiStore.getState().openLoadKey();
    useHomeUiStore.getState().setQrImportOpen(true);
    const state = useHomeUiStore.getState();
    expect(state.recoveryOpen).toBe(true);
    expect(state.loadKeyOpen).toBe(true);
    expect(state.qrImportOpen).toBe(true);
    useHomeUiStore.getState().closeRecovery();
    expect(useHomeUiStore.getState().loadKeyOpen).toBe(true);
  });
});
