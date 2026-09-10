import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-admissions/ui/components/dialog";
import { Button, buttonVariants } from "@aloysius-admissions/ui/components/button";
import { Camera, QrCode, Upload } from "lucide-react";
import QRCode from "qrcode";
import QrScanner from "qr-scanner";
import { useTranslation } from "@/lib/i18n";

function cleanKey(value: string) {
  return value.trim().replace(/^aloysius-admissions:\/\/access\?key=/i, "").trim();
}

export function AccessKeyQrImporter({ onKey }: { onKey: (key: string) => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraStarting, setCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readFile = async (file?: File) => {
    if (!file) return;
    try {
      setError("");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      const key = cleanKey(typeof result === "string" ? result : result.data);
      if (!key) throw new Error(t("qrImporter.error.notFound"));
      onKey(key);
    } catch {
      setError(t("qrImporter.error.unreadable"));
    }
  };
  useEffect(() => {
    if (!cameraOpen) return;
    setError("");
    setCameraError("");
    setCameraStarting(true);
    let stream: MediaStream | null = null;
    let scanTimer: number | undefined;
    let attachFrame: number | undefined;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error(t("qrImporter.camera.unsupported"));
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        const attachPreview = () => {
          if (!videoRef.current) { attachFrame = window.requestAnimationFrame(attachPreview); return; }
          videoRef.current.srcObject = stream;
          void videoRef.current.play().then(() => {
            setCameraStarting(false);
            scanTimer = window.setInterval(() => {
              if (!videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
              void QrScanner.scanImage(videoRef.current, { returnDetailedScanResult: true }).then((result) => {
                const value = typeof result === "string" ? result : result.data;
                const key = cleanKey(value);
                if (key) { onKey(key); setCameraOpen(false); }
              }).catch(() => undefined);
            }, 250);
          }).catch(() => setCameraError(t("qrImporter.camera.previewFailed")));
        };
        attachPreview();
      } catch {
        setCameraStarting(false);
        setCameraError(t("qrImporter.camera.unavailable"));
      }
    };
    void startCamera();
    return () => {
      if (scanTimer !== undefined) window.clearInterval(scanTimer);
      if (attachFrame !== undefined) window.cancelAnimationFrame(attachFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen, onKey, t]);

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" type="button" className="w-full min-w-0 whitespace-normal text-center" onClick={() => setCameraOpen(true)}>
          <Camera size={16} /> {t("qrImporter.scanWithCamera")}
        </Button>
        <label className={buttonVariants({ variant: "secondary", className: "w-full min-w-0 cursor-pointer whitespace-normal text-center" })}>
          <Upload size={16} /> {t("qrImporter.importImage")}
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
        </label>
      </div>
      {error && <p className="flex items-center gap-1 text-sm text-destructive">{error}</p>}
      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-[min(34rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("qrImporter.dialog.title")}</DialogTitle>
            <DialogDescription>{t("qrImporter.dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 justify-items-center overflow-hidden rounded-xl bg-[#111] text-white">
            <video ref={videoRef} muted playsInline />
            {cameraStarting && <span className="text-sm">{t("qrImporter.camera.starting")}</span>}
            {cameraError && <span className="text-sm text-destructive">{cameraError}</span>}
            {!cameraStarting && !cameraError && <span className="text-sm">{t("qrImporter.camera.hint")}</span>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AccessKeyQrDialog({ accessKey, open, onOpenChange }: { accessKey: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [image, setImage] = useState("");
  useEffect(() => { if (!open || !accessKey) return; void QRCode.toDataURL(accessKey, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then(setImage); }, [accessKey, open]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-[min(28rem,calc(100%-2rem))]"><DialogHeader><DialogTitle>Access key QR code</DialogTitle><DialogDescription>Scan this code to import the application key. Share it only with the verified applicant.</DialogDescription></DialogHeader><div className="grid justify-items-center gap-2 text-center">{image && <img src={image} alt="QR code containing the application access key" />}<code>{accessKey}</code><span className="text-sm text-muted-foreground">Keep this key private. It replaces the previous key.</span></div></DialogContent></Dialog>;
}
