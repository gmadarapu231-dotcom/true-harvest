'use client';
import { useRef, useState } from 'react';

// Compresses the photo on the phone before upload so it works on slow 2G/3G links (R-4.4).
export default function PhotoInput({ label, name = 'photo' }: { label: string; name?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      let q = 0.75;
      let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      while (blob && blob.size > 300_000 && q > 0.4) {
        q -= 0.1;
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
      }
      if (blob && ref.current) {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        ref.current.files = dt.files;
        setNote(`${Math.round(blob.size / 1024)} KB`);
      }
      setPreview(canvas.toDataURL('image/jpeg', 0.5));
    } catch {
      setPreview(URL.createObjectURL(file));
    }
  }
  return (
    <label>{label}
      <input ref={ref} type="file" name={name} accept="image/*" capture="environment" onChange={onChange} />
      {preview && <img src={preview} alt="" style={{ maxHeight: 160, borderRadius: 10, objectFit: 'cover' }} />}
      {note && <span className="small muted">{note}</span>}
    </label>
  );
}
