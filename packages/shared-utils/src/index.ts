import { formatDistanceToNow, format } from 'date-fns';

export function formatDateRelative(date: Date | string | number): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDateFull(date: Date | string | number): string {
  return format(new Date(date), 'MMM d, yyyy h:mm a');
}

export function truncateText(text: string, length: number = 100): string {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
}

export function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
}

export function calculateChangeScore(addedLength: number, removedLength: number, totalLength: number): number {
  if (totalLength === 0) return 0;
  return Math.min(100, Math.round(((addedLength + removedLength) / totalLength) * 100));
}
