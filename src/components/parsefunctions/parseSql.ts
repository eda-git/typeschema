// parseSql.ts
// Shared, zero-dependency CREATE TABLE parser. Every format converter
// (TypeScript, Zod, Prisma, Drizzle) imports ParsedTable[] from here rather
// than re-parsing SQL itself — one parser, many renderers.

export interface ParsedColumn {
  name: string;
  sqlType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  hasDefault: boolean;
}

export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}

/**
 * Parses one or more CREATE TABLE statements into ParsedTable[].
 * Throws with a descriptive message if no CREATE TABLE statements are found.
 */
export function parseCreateTableStatements(sql: string): ParsedTable[] {
  const tables: ParsedTable[] = [];

  const createTableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?(\w+)[`"\]]?\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = createTableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const bodyStart = match.index + match[0].length;
    const body = extractBalancedParens(sql, bodyStart - 1);

    if (body === null) {
      throw new Error(`Unbalanced parentheses in CREATE TABLE ${tableName}`);
    }

    tables.push({
      name: tableName,
      columns: parseColumnDefinitions(body),
    });
  }

  if (tables.length === 0) {
    throw new Error("No CREATE TABLE statements found.");
  }

  return tables;
}

function extractBalancedParens(source: string, openIndex: number): string | null {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") {
      depth--;
      if (depth === 0) {
        return source.slice(openIndex + 1, i);
      }
    }
  }
  return null;
}

function parseColumnDefinitions(body: string): ParsedColumn[] {
  const lines = splitTopLevelCommas(body);
  const columns: ParsedColumn[] = [];
  const inlinePrimaryKeys = new Set<string>();

  for (const line of lines) {
    const tablePkMatch = line.trim().match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (tablePkMatch) {
      tablePkMatch[1]
        .split(",")
        .map((c) => c.trim().replace(/[`"[\]]/g, ""))
        .forEach((c) => inlinePrimaryKeys.add(c));
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) continue;

    if (
      /^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|UNIQUE\s*\(|CHECK\s*\(|INDEX|KEY\s)/i.test(
        line
      )
    ) {
      continue;
    }

    const column = parseSingleColumn(line);
    if (column) {
      if (inlinePrimaryKeys.has(column.name)) column.isPrimaryKey = true;
      columns.push(column);
    }
  }

  return columns;
}

function parseSingleColumn(line: string): ParsedColumn | null {
  const nameMatch = line.match(/^[`"[]?(\w+)[`"\]]?\s+(.+)$/s);
  if (!nameMatch) return null;

  const [, name, rest] = nameMatch;

  const typeMatch = rest.match(/^(\w+(?:\s*\([^)]*\))?)/);
  if (!typeMatch) return null;
  const sqlType = typeMatch[1];

  const upperRest = rest.toUpperCase();
  const isPrimaryKey = /PRIMARY\s+KEY/.test(upperRest);
  const isExplicitlyNotNull = /NOT\s+NULL/.test(upperRest);
  const hasDefault = /DEFAULT\s+/.test(upperRest);

  const nullable = !isExplicitlyNotNull && !isPrimaryKey;

  return {
    name,
    sqlType,
    nullable,
    isPrimaryKey,
    hasDefault,
  };
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of input) {
    if (char === "(") depth++;
    if (char === ")") depth--;

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) parts.push(current);

  return parts;
}

export function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

export function toCamelCase(name: string): string {
  const pascal = toPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** Strips size/precision from a raw SQL type, e.g. "VARCHAR(255)" -> "varchar" */
export function baseSqlType(sqlType: string): string {
  return sqlType.trim().toLowerCase().replace(/\(.*\)/, "").trim();
}