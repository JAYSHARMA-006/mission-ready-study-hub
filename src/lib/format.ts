export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  doc: "DOC",
  docx: "DOCX",
  ppt: "PPT",
  pptx: "PPTX",
  xls: "XLS",
  xlsx: "XLSX",
  jpg: "Image",
  jpeg: "Image",
  png: "Image",
  txt: "Text",
  zip: "Archive",
};

export function fileTypeLabel(fileType: string | null | undefined, fileName?: string): string {
  const ext = (fileType || fileName?.split(".").pop() || "").toLowerCase().replace(".", "");
  return FILE_TYPE_LABELS[ext] ?? (ext ? ext.toUpperCase() : "File");
}

export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "png", "jpg", "jpeg", "zip",
] as const;

export const MAX_UPLOAD_MB = 100;

export function fileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "").toLowerCase() : "";
}

export function isAllowedUpload(name: string): boolean {
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(n ?? 0);
}
