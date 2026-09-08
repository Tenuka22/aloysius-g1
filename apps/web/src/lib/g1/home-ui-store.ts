import { create } from "zustand";

type HomeUiStore = {
  removeKey: string | null;
  recoveryKey: string | null;
  recoveryOpen: boolean;
  manageKeysOpen: boolean;
  loadKeyOpen: boolean;
  loadKeyInput: string;
  loadKeyError: string;
  qrImportOpen: boolean;
  setRemoveKey: (key: string | null) => void;
  openRecovery: (key: string | null) => void;
  closeRecovery: () => void;
  setManageKeysOpen: (open: boolean) => void;
  openLoadKey: () => void;
  closeLoadKey: () => void;
  setLoadKeyInput: (value: string) => void;
  setLoadKeyError: (value: string) => void;
  setQrImportOpen: (open: boolean) => void;
};

export const useHomeUiStore = create<HomeUiStore>()((set) => ({
  removeKey: null,
  recoveryKey: null,
  recoveryOpen: false,
  manageKeysOpen: false,
  loadKeyOpen: false,
  loadKeyInput: "",
  loadKeyError: "",
  qrImportOpen: false,
  setRemoveKey: (key) => set({ removeKey: key }),
  openRecovery: (key) => set({ recoveryKey: key, recoveryOpen: true }),
  closeRecovery: () => set({ recoveryKey: null, recoveryOpen: false }),
  setManageKeysOpen: (open) => set({ manageKeysOpen: open }),
  openLoadKey: () => set({ loadKeyOpen: true }),
  closeLoadKey: () => set({ loadKeyOpen: false, loadKeyInput: "", loadKeyError: "" }),
  setLoadKeyInput: (value) => set({ loadKeyInput: value, loadKeyError: "" }),
  setLoadKeyError: (value) => set({ loadKeyError: value }),
  setQrImportOpen: (open) => set({ qrImportOpen: open }),
}));
