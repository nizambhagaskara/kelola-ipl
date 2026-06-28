import type {ReactNode} from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode; 
}

export function Modal({open, onClose, children}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}