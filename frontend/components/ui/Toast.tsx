/** Minimal ephemeral toast bar — pair with `useToast()`. */
export const Toast = ({ message }: { message: string }) => {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-popover animate-modal-in">
      {message}
    </div>
  );
};
