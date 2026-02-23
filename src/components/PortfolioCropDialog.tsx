import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PortfolioCropDialogProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (blob: Blob) => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 3 / 4, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

const PortfolioCropDialog = ({ open, imageSrc, onClose, onCropComplete }: PortfolioCropDialogProps) => {
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setCrop(centerAspectCrop(naturalWidth, naturalHeight));
  }, []);

  const handleConfirm = useCallback(async () => {
    const image = imgRef.current;
    if (!image || !crop) return;

    const canvas = document.createElement("canvas");
    const outW = 600;
    const outH = 800; // 3:4 vertical
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;

    // Convert percentage crop to natural pixel values
    let sx: number, sy: number, sw: number, sh: number;
    if (crop.unit === "%") {
      sx = (crop.x / 100) * image.naturalWidth;
      sy = (crop.y / 100) * image.naturalHeight;
      sw = (crop.width / 100) * image.naturalWidth;
      sh = (crop.height / 100) * image.naturalHeight;
    } else {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      sx = crop.x * scaleX;
      sy = crop.y * scaleY;
      sw = crop.width * scaleX;
      sh = crop.height * scaleY;
    }

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);

    canvas.toBlob(
      (blob) => {
        if (blob) onCropComplete(blob);
      },
      "image/jpeg",
      0.9
    );
  }, [crop, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recortar foto do portfólio</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            aspect={3 / 4}
            className="max-h-[400px]"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop"
              onLoad={onImageLoad}
              className="max-h-[400px] w-auto"
            />
          </ReactCrop>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="gradient" className="flex-1" onClick={handleConfirm}>
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioCropDialog;
