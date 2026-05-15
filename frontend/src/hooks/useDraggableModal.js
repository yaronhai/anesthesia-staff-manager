import { useState, useRef } from 'react';

export function useDraggableModal() {
  const [pos, setPos] = useState(null);
  const dragRef = useRef(null);
  const modalRef = useRef(null);

  function onDragStart(e) {
    if (e.button !== 0) return;
    const tag = e.target.tagName.toLowerCase();
    if (['select', 'input', 'button', 'textarea', 'a', 'label'].includes(tag)) return;
    const modal = modalRef.current;
    if (!modal) return;
    const rect = modal.getBoundingClientRect();
    dragRef.current = { startX: e.clientX - rect.left, startY: e.clientY - rect.top };
    e.preventDefault();

    function onMove(ev) {
      setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function reset() { setPos(null); }

  const dragged = pos !== null;
  const modalStyle = dragged ? { top: pos.y, left: pos.x, transform: 'none', position: 'fixed' } : undefined;
  const overlayClass = dragged ? 'form-overlay form-overlay--transparent' : 'form-overlay';

  const dragHandleProps = { onMouseDown: onDragStart, style: { cursor: 'grab' } };

  return { modalRef, dragHandleProps, modalStyle, overlayClass, dragged, reset };
}
