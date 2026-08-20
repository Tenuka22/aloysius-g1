import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aloysius-g1/ui/components/dialog";
import { Camera, QrCode, Upload } from "lucide-react";
import QRCode from "qrcode";
import QrScanner from "qr-scanner";

function cleanKey(value: string) {
  return value.trim().replace(/^aloysius-g1:\/\/access\?key=/i, "").trim();
}

export function AccessKeyQrImporter({ onKey }: { onKey: (key: string) => void }) {
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
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
    if (!cameraOpen || !videoRef.current) return;
    setError("");
    const scanner = new QrScanner(videoRef.current, (result) => {
      const value = typeof result === "string" ? result : result.data;
      const key = cleanKey(value);
      if (!key) return;
      onKey(key);
      setCameraOpen(false);
    }, { returnDetailedScanResult: true, highlightScanRegion: true, highlightCodeOutline: true });
    scannerRef.current = scanner;
    void scanner.start().catch(() => setError("Camera access was unavailable. You can import a QR image instead."));
    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [cameraOpen, onKey]);

  return <div className="qr-import-control"><div className="qr-import-actions"><button className="secondary-button" type="button" onClick={() => setCameraOpen(true)}><Camera size={16} /> Scan with camera</button><label className="secondary-button qr-import-button"><Upload size={16} /> Import QR image<input type="file" accept="image/*" onChange={(event) => void readFile(event.target.files?.[0])} /></label></div>{error && <p className="error-line">{error}</p>}<Dialog open={cameraOpen} onOpenChange={setCameraOpen}><DialogContent className="qr-camera-dialog"><DialogHeader><DialogTitle>Scan access key</DialogTitle><DialogDescription>Allow camera access and hold the application QR code inside the frame.</DialogDescription></DialogHeader><div className="qr-camera-preview"><video ref={videoRef} muted playsInline /><span>Point your camera at the QR code</span></div></DialogContent></Dialog></div>;
}

export function AccessKeyQrDialog({ accessKey, open, onOpenChange }: { accessKey: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [image, setImage] = useState("");
  useEffect(() => { if (!open || !accessKey) return; void QRCode.toDataURL(accessKey, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then(setImage); }, [accessKey, open]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="access-key-qr-dialog"><DialogHeader><DialogTitle>Access key QR code</DialogTitle><DialogDescription>Scan this code to import the application key. Share it only with the verified applicant.</DialogDescription></DialogHeader><div className="access-key-qr-content">{image && <img src={image} alt="QR code containing the application access key" />}<code>{accessKey}</code><span>Keep this key private. It replaces the previous key.</span></div></DialogContent></Dialog>;
}
