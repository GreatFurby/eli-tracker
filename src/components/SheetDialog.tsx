import { useEffect, useRef, type ReactNode } from 'react';

export function SheetDialog({ title, children, onClose }: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose?.(); }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-900/60 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
    >
      {children}
    </dialog>
  );
}
