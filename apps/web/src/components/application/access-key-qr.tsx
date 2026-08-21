import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Button } from "@aloysius-g1/ui/components/button";
import { Camera, QrCode, Upload } from "lucide-react";
import QRCode from "qrcode";
import QrScanner from "qr-scanner";

function cleanKey(value: string) {
  return value.trim().replace(/^aloysius-g1:\/\/access\?key=/i, "").trim();
}

export function AccessKeyQrImporter({ onKey }: { onKey: (key: string) => void }) {
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
      if (!key) throw new Error("No access key found in this QR code");
      onKey(key);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not read that QR code");
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
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is not supported by this browser.");
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
          }).catch(() => setCameraError("The camera preview could not start. Check browser permissions and try again."));
        };
        attachPreview();
      } catch (cameraStartError) {
        setCameraStarting(false);
        setCameraError(cameraStartError instanceof Error ? cameraStartError.message : "Camera access was unavailable. Check the browser permission, then try again or import a QR image instead.");
      }
    };
    void startCamera();
    return () => {
      if (scanTimer !== undefined) window.clearInterval(scanTimer);
      if (attachFrame !== undefined) window.cancelAnimationFrame(attachFrame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen, onKey]);

  return <><Button variant="secondary" type="button" className="h-full w-full" onClick={() => setCameraOpen(true)}><Camera size={16} /> Scan with camera</Button><label className="w-full inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent bg-secondary text-secondary-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none h-full [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 px-2.5"><Upload size={16} /> Import QR image<input type="file" accept="image/*" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} /></label>{error && <p className="col-span-full flex items-center gap-1 text-sm text-destructive">{error}</p>}<Dialog open={cameraOpen} onOpenChange={setCameraOpen}><DialogContent className="max-w-[min(34rem,calc(100%-2rem))]"><DialogHeader><DialogTitle>Scan access key</DialogTitle><DialogDescription>Allow camera access and hold the application QR code inside the frame.</DialogDescription></DialogHeader><div className="grid gap-2 justify-items-center overflow-hidden rounded-xl bg-[#111] text-white"><video ref={videoRef} muted playsInline />{cameraStarting && <span className="text-sm">Starting camera…</span>}{cameraError && <span className="text-sm text-destructive">{cameraError}</span>} {!cameraStarting && !cameraError && <span className="text-sm">Point your camera at the QR code</span>}</div></DialogContent></Dialog></>;
}

export function AccessKeyQrDialog({ accessKey, open, onOpenChange }: { accessKey: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [image, setImage] = useState("");
  useEffect(() => { if (!open || !accessKey) return; void QRCode.toDataURL(accessKey, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then(setImage); }, [accessKey, open]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-[min(28rem,calc(100%-2rem))]"><DialogHeader><DialogTitle>Access key QR code</DialogTitle><DialogDescription>Scan this code to import the application key. Share it only with the verified applicant.</DialogDescription></DialogHeader><div className="grid justify-items-center gap-2 text-center">{image && <img src={image} alt="QR code containing the application access key" />}<code>{accessKey}</code><span className="text-sm text-muted-foreground">Keep this key private. It replaces the previous key.</span></div></DialogContent></Dialog>;
}
