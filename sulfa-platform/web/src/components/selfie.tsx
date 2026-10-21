'use client';
/* Live selfie capture for identity verification: front camera, oval face guide with a scanning light, a still is taken
   in the browser (JPEG, mirrored back to the real orientation) and handed to the caller. Nothing is sent before the user
   confirms. Without camera access (refused, desktop without webcam, old browser) the phone camera opens via a file input. */
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button } from './ui';
import { Icon } from './icons';

export function SelfieCapture({ busy, onSend }: { busy?: boolean; onSend: (f: File) => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null); const file = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);
  const [noCam, setNoCam] = useState(false);

  const stop = () => { stream?.getTracks().forEach(tr => tr.stop()); setStream(null); };
  useEffect(() => () => { stream?.getTracks().forEach(tr => tr.stop()); }, [stream]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const start = async () => {
    setShot(null);
    if (!navigator.mediaDevices?.getUserMedia) { setNoCam(true); return file.current?.click(); }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      setStream(s);
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } });
    } catch { setNoCam(true); file.current?.click(); }
  };
  const take = () => {
    const v = video.current; if (!v || !v.videoWidth) return;
    const side = Math.min(v.videoWidth, v.videoHeight), c = document.createElement('canvas');
    c.width = c.height = Math.min(side, 1080);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, c.width, c.height);   // stored as seen by the camera (not mirrored)
    c.toBlob(b => { if (b) { setShot({ url: URL.createObjectURL(b), blob: b }); stop(); } }, 'image/jpeg', 0.9);
  };
  const send = () => { if (shot) onSend(new File([shot.blob], 'selfie.jpg', { type: 'image/jpeg' })); };

  return (
    <div className="mt-4">
      <div className="selfie-frame relative mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-[2rem] bg-emerald-950">
        {stream && <video ref={video} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" aria-label={t('selfie.guide')} />}
        {shot && <img src={shot.url} alt={t('doc.selfie')} className="h-full w-full object-cover" />}
        {!stream && !shot && <div className="grid h-full place-items-center text-emerald-100/70"><Icon name="id" size={56} /></div>}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={`selfie-oval h-[74%] w-[58%] rounded-[50%] ${stream ? 'is-live' : ''}`} />
        </div>
        {stream && <div aria-hidden className="selfie-scan pointer-events-none absolute inset-x-[21%] top-[13%] h-[74%]" />}
      </div>
      <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-relaxed text-ink-muted">{noCam ? t('selfie.no_camera') : t('selfie.guide')}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {!stream && !shot && <Button onClick={start}><Icon name="id" size={18} /> {t('selfie.start')}</Button>}
        {stream && <Button onClick={take} className="selfie-shutter">{t('selfie.take')}</Button>}
        {shot && <><Button busy={busy} onClick={send}>{t('selfie.use')}</Button><Button variant="secondary" onClick={start}>{t('selfie.retake')}</Button></>}
        {noCam && !shot && <Button variant="secondary" onClick={() => file.current?.click()}>{t('selfie.file')}</Button>}
      </div>
      <input ref={file} type="file" accept="image/*" capture="user" className="sr-only" aria-label={t('selfie.file')}
        onChange={e => { const f = e.target.files?.[0]; if (f) setShot({ url: URL.createObjectURL(f), blob: f }); e.target.value = ''; }} />
    </div>
  );
}
