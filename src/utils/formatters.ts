import { format, isToday, isYesterday, isThisYear } from "date-fns";

/**
 * Format email date for the mail list:
 * - Today: "2:30 PM"
 * - Yesterday: "Yesterday"
 * - This year: "Mar 15"
 * - Older: "Mar 15, 2024"
 */
export function formatMailDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);

  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  if (isThisYear(date)) {
    return format(date, "MMM d");
  }
  return format(date, "MMM d, yyyy");
}

/**
 * Format full date for reading pane
 */
export function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
}

/**
 * Get sender display name
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSenderName(from: any): string {
  if (!from?.emailAddress) return "Unknown";
  return from.emailAddress.name || from.emailAddress.address || "Unknown";
}

/**
 * Get sender email
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSenderEmail(from: any): string {
  return from?.emailAddress?.address || "";
}

/**
 * Get initials from a name (for avatars)
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Get well-known folder display name
 */
export function getFolderDisplayName(folderName: string): string {
  const names: Record<string, string> = {
    inbox: "Inbox",
    drafts: "Drafts",
    sentitems: "Sent Items",
    deleteditems: "Deleted Items",
    junkemail: "Junk Email",
    archive: "Archive",
    outbox: "Outbox",
    scheduled: "Scheduled",
  };
  return names[folderName.toLowerCase()] || folderName;
}
