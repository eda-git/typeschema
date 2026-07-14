// types.ts
interface ParsedColumn {
  name: string;
  sqlType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey?: { table: string; column: string };
}

interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}

type OutputFormat = "typescript" | "prisma" | "zod" | "drizzle" | "graphql" | "django";

export type { ParsedColumn, ParsedTable, OutputFormat };