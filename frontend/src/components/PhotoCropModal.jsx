import { useState, useRef, useEffect, useCallback } from 'react';
import styles from '../styles/PhotoCropModal.module.scss';

const DISPLAY = 240;
const OUTPUT  = 320;

export default function PhotoCropModal({ imageUrl, onConfirm, onCancel }) {
  const imgRef  = useRef(null);
  const dragRef = useRef(null);

  const [ready, setReady]   = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [fillScale, setFillScale] = useState(1);
  const [zoom, setZoom]     = useState(1);          // multiplier on top of fillScale
  const [pos, setPos]       = useState({ x: DISPLAY / 2, y: DISPLAY / 2 });

  const scale = fillScale * zoom;

  function onImgLoad(e) {
    const nw = e.target.naturalWidth;
    const nh = e.target.naturalHeight;
    const fs = Math.max(DISPLAY / nw, DISPLAY / nh);
    setNatural({ w: nw, h: nh });
    setFillScale(fs);
    setZoom(1);
    setPos({ x: DISPLAY / 2, y: DISPLAY / 2 });
    setReady(true);
  }

  function startDrag(clientX, clientY) {
    dragRef.current = { startX: clientX, startY: clientY, px: pos.x, py: pos.y };
  }

  function moveDrag(clientX, clientY) {
    if (!dragRef.current) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
  }

  function endDrag() { dragRef.current = null; }

  const onMouseDown = e => { e.preventDefault(); startDrag(e.clientX, e.clientY); };
  const onMouseMove = useCallback(e => moveDrag(e.clientX, e.clientY), [pos]);
  const onTouchStart = e => { const t = e.touches[0]; startDrag(t.clientX, t.clientY); };
  const onTouchMove  = e => { e.preventDefault(); const t = e.touches[0]; moveDrag(t.clientX, t.clientY); };

  useEffect(() => {
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [onMouseMove]);

  function handleConfirm() {
    const canvas = document.createElement('canvas');
    canvas.width  = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);

    const ratio  = OUTPUT / DISPLAY;
    const drawW  = natural.w * scale * ratio;
    const drawH  = natural.h * scale * ratio;
    const drawX  = pos.x * ratio - drawW / 2;
    const drawY  = pos.y * ratio - drawH / 2;

    ctx.drawImage(imgRef.current, drawX, drawY, drawW, drawH);
    onConfirm(canvas.toDataURL('image/jpeg', 0.88));
  }

  // CSS: image centered at (pos.x, pos.y) in container, scaled from its own center
  const imgLeft = pos.x - natural.w / 2;
  const imgTop  = pos.y - natural.h / 2;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.title}>מיקום תמונה</div>
        <div className={styles.hint}>גרור למיקום · הגדל/הקטן עם הסרגל</div>

        <div
          className={styles.cropWrap}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={endDrag}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            onLoad={onImgLoad}
            draggable={false}
            className={styles.cropImg}
            style={{
              left: imgLeft,
              top:  imgTop,
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              opacity: ready ? 1 : 0,
            }}
          />
          <div className={styles.cropRing} />
        </div>

        <div className={styles.zoomRow}>
          <span className={styles.zoomIcon}>−</span>
          <input
            type="range"
            min="0.3"
            max="3"
            step="0.01"
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.zoomIcon}>+</span>
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onCancel}>ביטול</button>
          <button type="button" className="btn-primary"   onClick={handleConfirm} disabled={!ready}>אישור</button>
        </div>
      </div>
    </div>
  );
}
