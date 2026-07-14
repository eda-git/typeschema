import type { OutputFormat } from "../../types";

interface FormatTabsProps {
  active: OutputFormat;
  onSelect: (format: OutputFormat) => void;
}

const FORMATS: { id: OutputFormat; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "zod", label: "Zod" },
  { id: "prisma", label: "Prisma" },
  { id: "graphql", label: "GraphQL" },
  { id: "django", label: "Django" },
  { id: "drizzle", label: "Drizzle" },
];

export default function FormatTabs({ active, onSelect }: FormatTabsProps) {
  return (
    <div className="format-tabs" role="tablist" aria-label="Output format">
      {FORMATS.map((fmt) => (
        <button
          key={fmt.id}
          type="button"
          role="tab"
          aria-selected={active === fmt.id}
          className={active === fmt.id ? "format-tab active" : "format-tab"}
          onClick={() => onSelect(fmt.id)}
        >
          {fmt.label}
        </button>
      ))}
    </div>
  );
}