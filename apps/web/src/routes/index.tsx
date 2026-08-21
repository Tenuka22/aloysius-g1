import { useEffect, useState } from "react";
import { consumeEventIterator } from "@orpc/client";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  FileWarning,
  KeyRound,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@aloysius-g1/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aloysius-g1/ui/components/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aloysius-g1/ui/components/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@aloysius-g1/ui/components/dialog";
import { Input } from "@aloysius-g1/ui/components/input";
import { client } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
import { completionPercent } from "@/lib/completion";
import {
  useSessionStore,
  useKeysStore,
  type SavedApplication,
} from "@/stores/application-store";
import { AccessKeyQrImporter } from "@/components/application/access-key-qr";
import { AccessRecoveryDialog } from "@/components/application/access-recovery-dialog";

export const Route = createFileRoute("/")({ component: HomeComponent });

function HomeComponent() {
  const savedApplications = useKeysStore(
    (state) => state.savedApplications,
  );
  const removeSavedApplication = useKeysStore(
    (state) => state.removeSavedApplication,
  );
  const updateSavedApplication = useKeysStore(
    (state) => state.updateSavedApplication,
  );
  const upsertBySessionCode = useKeysStore(
    (state) => state.upsertBySessionCode,
  );
  const addSavedApplication = useKeysStore(
    (state) => state.addSavedApplication,
  );
  const [records, setRecords] = useState<
    Record<
      string,
      {
        name: string;
        birthCertificateNumber: string;
        sessionCode?: string;
        updatedAt?: string;
        completion: number;
        submitted: boolean;
        error?: string;
      }
    >
  >({});
  const [removeApp, setRemoveApp] = useState<SavedApplication | null>(
    null,
  );
  const [applicationCount, setApplicationCount] = useState<
    number | null
  >(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [recoveryApp, setRecoveryApp] =
    useState<SavedApplication | null>(null);
  const [manageKeysOpen, setManageKeysOpen] = useState(false);
  const [loadKeyOpen, setLoadKeyOpen] = useState(false);
  const [loadKeyInput, setLoadKeyInput] = useState("");
  const [loadKeyError, setLoadKeyError] = useState("");

  const accessKey = useSessionStore((state) => state.accessKey);
  const sessionCode = useSessionStore((state) => state.sessionCode);
  const setAccessKey = useSessionStore((state) => state.setAccessKey);
  const setSessionCode = useSessionStore(
    (state) => state.setSessionCode,
  );
  const clearActive = useSessionStore((state) => state.clearActive);

  const createNewApplication = () => {
    clearActive();
    window.location.href =
      window.location.origin + "/application";
  };
  const removeApplication = (app: SavedApplication) => {
    removeSavedApplication(app.accessKey);
    setRemoveApp(null);
  };
  const loadWithKey = () => {
    const key = loadKeyInput.trim();
    if (!key) {
      setLoadKeyError("Enter an access key");
      return;
    }
    setAccessKey(key);
    addSavedApplication({ accessKey: key, sessionCode: "" });
    setLoadKeyOpen(false);
    setLoadKeyInput("");
    setLoadKeyError("");
    window.location.href = `${window.location.origin}/application/access?key=${encodeURIComponent(key)}`;
  };

  useEffect(() => {
    let cancelled = false;
    const appsToRefresh = savedApplications.filter(
      (app) => app.accessKey,
    );
    void Promise.all(
      appsToRefresh.map(async (app) => {
        try {
          const result = await client.application.get({
            accessKey: app.accessKey,
          });
          const data = result.data as {
            applicant?: {
              fullName?: string;
              birthCertificateNumber?: string;
            };
          };
          updateSavedApplication(app.accessKey, {
            name: data.applicant?.fullName,
            sessionCode: result.sessionCode,
          });
          return [
            app.accessKey,
            {
              name:
                data.applicant?.fullName || "Unnamed applicant",
              birthCertificateNumber:
                data.applicant?.birthCertificateNumber ||
                "Not provided",
              sessionCode: result.sessionCode,
              updatedAt: String(result.updatedAt),
              completion: completionPercent(data),
              submitted: Boolean(result.submittedAt),
            },
          ] as const;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.toLowerCase().includes("not found")
          ) {
            removeSavedApplication(app.accessKey);
            return [
              app.accessKey,
              {
                name: "Removed locally",
                birthCertificateNumber: "",
                sessionCode: "",
                updatedAt: "",
                completion: 0,
                submitted: false,
                error: "No longer exists on the server",
              },
            ] as const;
          }
          return [
            app.accessKey,
            {
              name: "Unavailable",
              birthCertificateNumber: "",
              sessionCode: "",
              updatedAt: "",
              completion: 0,
              submitted: false,
              error: "Could not refresh from the database",
            },
          ] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled)
        setRecords(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [savedApplications, removeSavedApplication, updateSavedApplication]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      savedApplications.map(async (app) => {
        if (app.accessKey) return null;
        try {
          const result = await client.application.lookup({
            sessionCode: app.sessionCode,
          });
          if (!cancelled) {
            upsertBySessionCode(app.sessionCode, {
              name: result.applicantName,
              accessKey: "",
            });
          }
          return [
            app.sessionCode,
            {
              name: result.applicantName,
              birthCertificateNumber: "",
              sessionCode: app.sessionCode,
              updatedAt: "",
              completion: 0,
              submitted: false,
              error: "Access key not saved — enter it to open",
            },
          ] as const;
        } catch {
          return [
            app.sessionCode,
            {
              name: "Not found",
              birthCertificateNumber: "",
              sessionCode: app.sessionCode,
              updatedAt: "",
              completion: 0,
              submitted: false,
              error: "Session code not found on the server",
            },
          ] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) {
        const filtered = entries.filter(
          (
            entry,
          ): entry is [
            string,
            {
              name: string;
              birthCertificateNumber: string;
              sessionCode: string;
              updatedAt: string;
              completion: number;
              submitted: boolean;
              error?: string;
            },
          ] => entry !== null,
        );
        setRecords((prev) => ({
          ...prev,
          ...Object.fromEntries(filtered),
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [savedApplications, upsertBySessionCode]);

  useEffect(() => {
    void authClient
      .getSession()
      .then((result) =>
        setIsAdmin(result.data?.user.role === "admin"),
      );
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void client.application
      .count()
      .then((result) => setApplicationCount(result.count))
      .catch(() => undefined);
    const cancel = consumeEventIterator(
      client.application.liveCount(undefined, {
        signal: controller.signal,
      }),
      {
        onEvent: (event) => setApplicationCount(event.count),
        onError: () => undefined,
      },
    );
    return () => {
      controller.abort();
      void cancel();
    };
  }, []);

  const submittedCount = savedApplications.filter(
    (app) => records[app.accessKey || app.sessionCode]?.submitted,
  ).length;
  const draftCount = savedApplications.filter(
    (app) =>
      !records[app.accessKey || app.sessionCode]?.submitted,
  ).length;
  const errorCount = savedApplications.filter(
    (app) => records[app.accessKey || app.sessionCode]?.error,
  ).length;
  const incompleteCount = savedApplications.filter(
    (app) =>
      !records[app.accessKey || app.sessionCode]?.submitted &&
      (records[app.accessKey || app.sessionCode]?.completion ??
        0) < 100,
  ).length;

  return (
    <main
      className="min-h-svh"
      data-surface="g1-2026-application"
    >
      <div className="mx-auto max-w-[1200px] px-8 py-10 grid gap-8">
        {/* Hero */}
        <section className="grid gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LayoutDashboard size={14} />
            </div>
            <p className="text-primary font-bold tracking-widest uppercase text-[0.65rem]">
              G1 2026 intake
            </p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Application dashboard
          </h1>
          <p className="text-muted-foreground max-w-[38rem] text-sm leading-relaxed">
            Start a new application, continue an existing one, or manage saved records.
          </p>
        </section>
        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card className="py-4">
            <CardContent className="py-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <LayoutDashboard size={15} />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {applicationCount ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total applications
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="py-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-chart-1/15 text-chart-1">
                  <KeyRound size={15} />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {savedApplications.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Saved on this device
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="py-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 size={15} />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {submittedCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Submitted
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="py-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                  <Clock size={15} />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {draftCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Drafts
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="py-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-rose-500/10 text-rose-600">
                  <FileWarning size={15} />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {errorCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    With errors
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="py-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/10 text-violet-600">
                  <FileText size={15} />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight">
                    {incompleteCount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Incomplete
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">
            Quick actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Button
              type="button"
              className="h-auto py-3 flex-col items-center gap-1.5 text-sm"
              onClick={createNewApplication}
            >
              <Plus size={18} strokeWidth={2.5} />
              New application
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-auto py-3 flex-col items-center gap-1.5 text-sm"
              onClick={() => setLoadKeyOpen(true)}
            >
              <KeyRound size={18} />
              Load with a key
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant="secondary"
                className="h-auto py-3 flex-col items-center gap-1.5 text-sm"
                onClick={() => window.location.assign("/admin")}
              >
                <ShieldCheck size={18} />
                Admin panel
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              className="h-auto py-3 flex-col items-center gap-1.5 text-sm"
              onClick={() => setManageKeysOpen(true)}
              disabled={savedApplications.length === 0}
            >
              <KeyRound size={18} />
              Manage saved keys
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-auto py-3 flex-col items-center gap-1.5 text-sm"
              onClick={() =>
                document.getElementById("qr-upload")?.click()
              }
            >
              <Upload size={18} />
              Import QR image
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto py-3 flex-col items-center gap-1.5 text-sm"
              onClick={() => {
                if (savedApplications[0])
                  setRecoveryApp(savedApplications[0]);
              }}
              disabled={!savedApplications[0]}
            >
              <Trash2 size={18} />
              Forgot a key?
            </Button>
          </div>
          <input
            id="qr-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.[0]) {
                const file = event.target.files[0];
                const reader = new FileReader();
                reader.onload = () => {
                  const qr = reader.result as string;
                  import("qr-scanner").then(
                    ({ scanImage }) =>
                      scanImage(file, {
                        returnDetailedScanResult: true,
                      }).then((result: unknown) => {
                        const data = result as
                          | { data?: string }
                          | string;
                        const key =
                          typeof data === "string"
                            ? data
                            : data.data || "";
                        if (key)
                          window.location.assign(
                            `/application/access?key=${encodeURIComponent(key)}`,
                          );
                      }),
                  );
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </section>

        {/* Saved applications */}
        {savedApplications.length > 0 && (
          <section className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Your saved applications
                </h2>
                <p className="text-sm text-muted-foreground">
                  Every application available with a saved access
                  key is refreshed from the database.
                </p>
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">
                {savedApplications.length}{" "}
                {savedApplications.length === 1
                  ? "application"
                  : "applications"}
              </span>
            </div>
            <div className="grid gap-2.5">
              {savedApplications.map((app) => {
                const record =
                  records[app.accessKey || app.sessionCode];
                return (
                  <Card
                    key={app.accessKey || app.sessionCode}
                    className="group transition-shadow hover:shadow-md hover:ring-primary/20"
                  >
                    {app.accessKey ? (
                      <Link
                        className="contents"
                        to="/application/access"
                        search={{
                          key: app.accessKey,
                          code: record?.sessionCode,
                        }}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary/70">
                                <FileText size={16} />
                              </div>
                              <span className="truncate text-base">
                                {record?.name ||
                                  app.name ||
                                  "Loading application…"}
                              </span>
                            </div>
                            <ArrowRight
                              size={18}
                              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                            />
                          </CardTitle>
                          <CardDescription className="flex items-center justify-between pl-12">
                            {record?.submitted ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                                <CheckCircle2 size={14} />
                                Submitted
                              </span>
                            ) : (
                              <span className="font-medium">
                                {record?.completion ?? 0}% complete
                              </span>
                            )}
                          </CardDescription>
                          <CardAction>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setRemoveApp(app);
                              }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="grid gap-2 pl-12">
                          {record?.completion !== undefined &&
                            !record.submitted && (
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <span
                                  className="block h-full rounded-full bg-primary transition-all duration-500"
                                  style={{
                                    width: `${record.completion}%`,
                                  }}
                                />
                              </div>
                            )}
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs text-muted-foreground truncate">
                              {record?.error ||
                                (record?.updatedAt
                                  ? `Updated ${new Date(record.updatedAt).toLocaleString()}`
                                  : "Refreshing from database…")}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                              {record?.sessionCode ||
                                app.sessionCode ||
                                ""}
                            </p>
                          </div>
                        </CardContent>
                      </Link>
                    ) : (
                      <Link
                        className="contents"
                        to="/application/access"
                        search={{ code: app.sessionCode }}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/8 text-amber-600/70">
                                <FileText size={16} />
                              </div>
                              <span className="truncate text-base">
                                {record?.name ||
                                  app.name ||
                                  "Loading application…"}
                              </span>
                            </div>
                            <ArrowRight
                              size={18}
                              className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                            />
                          </CardTitle>
                          <CardDescription className="flex items-center justify-between pl-12">
                            {record?.submitted ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                                <CheckCircle2 size={14} />
                                Submitted
                              </span>
                            ) : (
                              <span className="font-medium">
                                {record?.completion ?? 0}% complete
                              </span>
                            )}
                          </CardDescription>
                          <CardAction>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setRemoveApp(app);
                              }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </CardAction>
                        </CardHeader>
                        <CardContent className="grid gap-2 pl-12">
                          <p className="text-xs text-muted-foreground">
                            {record?.error ||
                              (record?.updatedAt
                                ? `Updated ${new Date(record.updatedAt).toLocaleString()}`
                                : "Refreshing from database…")}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {record?.sessionCode ||
                              app.sessionCode ||
                              ""}
                          </p>
                        </CardContent>
                      </Link>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <AccessRecoveryDialog
          applicantName={
            recoveryApp
              ? records[recoveryApp.accessKey || recoveryApp.sessionCode]
                  ?.name || recoveryApp.name
              : undefined
          }
          open={Boolean(recoveryApp)}
          onOpenChange={(open) => {
            if (!open) setRecoveryApp(null);
          }}
          onForgot={() => {
            if (!recoveryApp) return;
            const forgotten = recoveryApp;
            removeSavedApplication(forgotten.accessKey);
            if (
              forgotten.accessKey &&
              accessKey === forgotten.accessKey
            )
              clearActive();
            setRecoveryApp(null);
          }}
        />
        <AlertDialog
          open={removeApp !== null}
          onOpenChange={(open) => {
            if (!open) setRemoveApp(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Forget this application key?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This removes the key from this device only. The
                application remains safely stored in the database
                and can be loaded again with its session code and
                access key.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (removeApp) removeApplication(removeApp);
                }}
              >
                Forget key
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={manageKeysOpen} onOpenChange={setManageKeysOpen}>
          <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
            <DialogHeader>
              <DialogTitle>Saved application keys</DialogTitle>
              <DialogDescription>
                These keys are stored on this device only. Remove
                any you no longer need.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 max-h-[50vh] overflow-y-auto">
              {savedApplications.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No saved keys on this device.
                </p>
              )}
              {savedApplications.map((app) => (
                <div
                  key={app.accessKey || app.sessionCode}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {records[app.accessKey || app.sessionCode]
                        ?.name ||
                        app.name ||
                        "Loading…"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {app.accessKey || app.sessionCode}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => {
                      setRemoveApp(app);
                      setManageKeysOpen(false);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={loadKeyOpen} onOpenChange={setLoadKeyOpen}>
          <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
            <DialogHeader>
              <DialogTitle>
                Load application with a key
              </DialogTitle>
              <DialogDescription>
                Enter the access key you received from the school
                to open this application.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Input
                value={loadKeyInput}
                onChange={(e) => {
                  setLoadKeyInput(e.target.value);
                  setLoadKeyError("");
                }}
                placeholder="Paste access key here…"
              />
              {loadKeyError && (
                <p className="text-sm text-destructive">
                  {loadKeyError}
                </p>
              )}
              <Button
                type="button"
                onClick={loadWithKey}
                disabled={!loadKeyInput.trim()}
              >
                Open application
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
