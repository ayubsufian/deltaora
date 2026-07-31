import { Loader2 } from 'lucide-react';

export function Spinner({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 size={size} className="animate-spin text-blue-600" />
    </div>
  );
}
