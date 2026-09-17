interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  decorative?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
};

const initialsFor = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
};

export function Avatar({ name, src, size = 'md', decorative = true, className = '' }: AvatarProps) {
  const label = name ? `${name} profile picture` : 'Profile picture';

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900 ${sizeClasses[size]} ${className}`}
      aria-label={!decorative && src ? label : undefined}
    >
      {src ? (
        <img
          src={src}
          alt={decorative ? '' : label}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden="true">{initialsFor(name)}</span>
      )}
    </div>
  );
}
