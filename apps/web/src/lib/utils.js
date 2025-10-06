import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatPhoneNumber = (value) => {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');

  if (!digits) {
    return value;
  }

  if (digits.length === 13 && digits.startsWith('55')) {
    const country = digits.slice(0, 2);
    const area = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9);
    return `+${country} (${area}) ${part1}-${part2}`;
  }

  if (digits.length === 11) {
    const area = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7);
    return `(${area}) ${part1}-${part2}`;
  }

  if (digits.length === 10) {
    const area = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6);
    return `(${area}) ${part1}-${part2}`;
  }

  if (digits.length > 4) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return value;
};

export const buildInitials = (name, fallback = '??') => {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
