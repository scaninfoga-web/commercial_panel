import { TICKET_CATALOG } from "@/constants/Ticket_catalog";

function subjectKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** Convert catalog keys and legacy PascalCase subjects into readable labels. */
export function categoryLabel(subject: string): string {
  const key = subject.trim();
  const normalized = subjectKey(key);
  const catalogSubject = TICKET_CATALOG.subjects.find(
    (category) =>
      subjectKey(category.key) === normalized ||
      subjectKey(category.name) === normalized,
  );
  if (catalogSubject) return catalogSubject.name;

  const readable = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return readable;
}

/** Preserve the legacy helper for consumers that still need a subject value. */
export function toSubjectValue(subject: string): string {
  return subject.trim();
}

/** Convert an API status value into the catalog's display label. */
export function statusLabel(status: string): string {
  const normalized = status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return (
    TICKET_CATALOG.ticket_statuses.find(
      (value) =>
        value
          .trim()
          .toUpperCase()
          .replace(/[\s-]+/g, "_") === normalized,
    ) ?? status.replace(/_/g, " ")
  );
}

/** Parse hyphen-separated subjects and legacy two-line subjects. */
export function parseSubject(subject: string): {
  title: string;
  subTitle: string;
} {
  const normalizedSubject = subject.trim();
  const matchedCategory = TICKET_CATALOG.subjects.find((category) => {
    const apiCategoryName = category.name.replace(/\s*&\s*/g, " ").trim();
    return normalizedSubject.startsWith(`${apiCategoryName} - `);
  });

  if (matchedCategory) {
    return {
      title: matchedCategory.name,
      subTitle: normalizedSubject
        .slice(
          matchedCategory.name.replace(/\s*&\s*/g, " ").trim().length + 3,
        )
        .trim(),
    };
  }

  const [first = "", ...rest] = subject.includes(" - ")
    ? subject.split(" - ")
    : subject.split(/\r?\n/);
  return {
    title: categoryLabel(first),
    subTitle: rest.join(" ").trim(),
  };
}
