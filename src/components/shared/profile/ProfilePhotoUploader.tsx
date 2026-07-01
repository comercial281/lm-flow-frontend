import { useState, useRef, useEffect } from 'react';
import {
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { Camera, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import { normalizeAvatarUrl } from '@/utils/avatarUrl';
import { getCroppedImage } from '@/utils/cropImage';
import Cropper, { Area } from 'react-easy-crop';

interface ProfilePhotoUploaderProps {
  initialPhoto?: string;
  userName: string;
  onPhotoChange: (file: File, url: string) => void;
}

export default function ProfilePhotoUploader({
  initialPhoto,
  userName,
  onPhotoChange,
}: ProfilePhotoUploaderProps) {
  const { t } = useLanguage('profile');
  const [photoUrl, setPhotoUrl] = useState(normalizeAvatarUrl(initialPhoto));
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const currentPreviewUrlRef = useRef<string | null>(null);

  // Update photoUrl when initialPhoto changes (after API response)
  useEffect(() => {
    setPhotoUrl(normalizeAvatarUrl(initialPhoto));
  }, [initialPhoto]);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isHeicFile = (file: File) => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    return type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (!file) return;

    let workingFile = file;

    // Browsers can't decode/preview HEIC (iPhone default format) — convert to JPEG first.
    if (isHeicFile(file)) {
      try {
        setIsConverting(true);
        const heic2any = (await import('heic2any')).default;
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        workingFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      } catch (error) {
        console.error('Error converting HEIC photo:', error);
        toast.error(t('photoUploader.heicConversionError'));
        return;
      } finally {
        setIsConverting(false);
      }
    }

    // Validate file type
    if (!workingFile.type.startsWith('image/')) {
      toast.error(t('photoUploader.fileTypeError'));
      return;
    }

    // Validate file size (max 5MB)
    if (workingFile.size > 5 * 1024 * 1024) {
      toast.error(t('photoUploader.fileSizeError'));
      return;
    }

    const localPreviewUrl = URL.createObjectURL(workingFile);
    setCropImageUrl(localPreviewUrl);
    setPendingFile(workingFile);
    setIsCropOpen(true);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCropComplete = (_: Area, croppedArea: Area) => {
    setCroppedAreaPixels(croppedArea);
  };

  const handleCropCancel = () => {
    if (cropImageUrl) {
      URL.revokeObjectURL(cropImageUrl);
    }
    setCropImageUrl('');
    setPendingFile(null);
    setIsCropOpen(false);
  };

  const handleCropConfirm = async () => {
    if (!pendingFile || !croppedAreaPixels || !cropImageUrl) {
      handleCropCancel();
      return;
    }

    try {
      setIsUploading(true);
      const { blob, url } = await getCroppedImage(cropImageUrl, croppedAreaPixels);
      const croppedFile = new File([blob], pendingFile.name, { type: blob.type });

      if (currentPreviewUrlRef.current) {
        URL.revokeObjectURL(currentPreviewUrlRef.current);
      }
      currentPreviewUrlRef.current = url;

      setPhotoUrl(url);
      onPhotoChange(croppedFile, url);
      toast.success(t('photoUploader.photoUpdated'));

    } catch (error) {
      console.error('Error cropping photo:', error);
      toast.error(t('photoUploader.uploadError'));
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(cropImageUrl);
      setCropImageUrl('');
      setPendingFile(null);
      setIsCropOpen(false);
    }
  };


  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-6">
      {/* Avatar Display */}
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage src={photoUrl} alt={userName} />
          <AvatarFallback className="text-lg font-semibold">
            {getUserInitials(userName)}
          </AvatarFallback>
        </Avatar>

        {/* Camera overlay on hover */}
        <div
          className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={handleUploadClick}
        >
          <Camera className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadClick}
          disabled={isUploading || isConverting}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {isConverting
            ? t('photoUploader.converting')
            : isUploading
              ? t('photoUploader.uploading')
              : t('photoUploader.changePhoto')}
        </Button>

        <p className="text-xs text-muted-foreground">
          {t('photoUploader.fileInfo')}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Dialog
        open={isCropOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsCropOpen(true);
          } else {
            handleCropCancel();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('photoUploader.changePhoto')}</DialogTitle>
          </DialogHeader>

          <div className="relative h-80 w-full bg-muted">
            {cropImageUrl && (
              <Cropper
                image={cropImageUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={handleCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>

          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={event => setZoom(Number(event.target.value))}
            className="w-full"
            aria-label={t('photoUploader.changePhoto')}
          />

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCropCancel}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCropConfirm}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
