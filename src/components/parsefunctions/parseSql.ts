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

// ---------------------------------------------------------------------------
// SELECT statement parsing
// ---------------------------------------------------------------------------

function parseSingleSelect(
  sql: string,
  tableMap: Map<string, ParsedTable>
): ParsedTable | null {
  const upper = sql.toUpperCase();

  const selectIdx = upper.indexOf("SELECT");
  const fromIdx = upper.search(/\bFROM\b/);
  if (fromIdx === -1) return null;

  const columnListStr = sql.slice(selectIdx + 6, fromIdx).trim();
  const afterFrom = sql.slice(fromIdx + 4).trim();

  // Trim at clause keywords so we only process FROM + JOIN section
  const clauseEnd = afterFrom.search(
    /\b(WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT)\b/i
  );
  const tableSection = (
    clauseEnd === -1 ? afterFrom : afterFrom.slice(0, clauseEnd)
  ).trim();

  // Build alias -> real table name map (all lowercase)
  const aliasMap = new Map<string, string>();

  const fromTableMatch = tableSection.match(
    /^(\w+)(?:\s+(?:AS\s+)?(\w+))?/i
  );
  if (!fromTableMatch) return null;

  const mainTable = fromTableMatch[1];
  const mainAlias = fromTableMatch[2] || mainTable;
  aliasMap.set(mainAlias.toLowerCase(), mainTable.toLowerCase());

  const joinRegex = /\bJOIN\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
  let joinMatch: RegExpExecArray | null;
  while ((joinMatch = joinRegex.exec(tableSection)) !== null) {
    const jTable = joinMatch[1];
    const jAlias = joinMatch[2] || jTable;
    aliasMap.set(jAlias.toLowerCase(), jTable.toLowerCase());
  }

  // Parse selected columns
  const columns: ParsedColumn[] = [];
  const colParts = splitTopLevelCommas(columnListStr);

  for (const part of colParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Wildcard: * or table.*
    if (trimmed === "*" || /^\w+\.\*$/.test(trimmed)) {
      const prefix = trimmed.includes(".")
        ? trimmed.split(".")[0].toLowerCase()
        : null;
      const targets = prefix
        ? ([aliasMap.get(prefix)].filter((x): x is string => x !== undefined))
        : [...new Set(aliasMap.values())];

      for (const tn of targets) {
        const tbl = tableMap.get(tn);
        if (tbl) columns.push(...tbl.columns.map((c) => ({ ...c })));
      }
      continue;
    }

    // [table.]column [AS alias]  — covers the common case
    const colMatch = trimmed.match(
      /^(?:(\w+)\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?\s*$/i
    );
    if (colMatch) {
      const [, tablePrefix, colName, colAlias] = colMatch;
      const finalName = colAlias || colName;
      let resolved: ParsedColumn | null = null;

      if (tablePrefix) {
        const tn = aliasMap.get(tablePrefix.toLowerCase());
        const tbl = tn ? tableMap.get(tn) : undefined;
        resolved =
          tbl?.columns.find(
            (c) => c.name.toLowerCase() === colName.toLowerCase()
          ) ?? null;
      } else {
        for (const tn of aliasMap.values()) {
          const found = tableMap
            .get(tn)
            ?.columns.find(
              (c) => c.name.toLowerCase() === colName.toLowerCase()
            );
          if (found) {
            resolved = found;
            break;
          }
        }
      }

      columns.push(
        resolved
          ? { ...resolved, name: finalName }
          : {
              name: finalName,
              sqlType: "unknown",
              nullable: true,
              isPrimaryKey: false,
              hasDefault: false,
            }
      );
    } else {
      // Complex expression (COALESCE, COUNT, etc.) — use alias if present
      const aliasMatch = trimmed.match(/\bAS\s+(\w+)\s*$/i);
      const name = aliasMatch
        ? aliasMatch[1]
        : `col${columns.length + 1}`;
      columns.push({
        name,
        sqlType: "unknown",
        nullable: true,
        isPrimaryKey: false,
        hasDefault: false,
      });
    }
  }

  if (columns.length === 0) return null;

  // Result name: combine table names; add _query suffix to avoid collisions
  const tableNames = [...new Set(aliasMap.values())];
  const resultName = tableNames.join("_") + "_query";

  return { name: resultName, columns };
}

function parseSelectStatements(
  sql: string,
  knownTables: ParsedTable[]
): ParsedTable[] {
  const tableMap = new Map<string, ParsedTable>(
    knownTables.map((t) => [t.name.toLowerCase(), t])
  );

  // Split on semicolons; each SELECT is its own statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  return statements
    .filter((s) => /^\s*SELECT\b/i.test(s))
    .map((s) => parseSingleSelect(s, tableMap))
    .filter((t): t is ParsedTable => t !== null);
}

/**
 * Parses SQL containing CREATE TABLE and/or SELECT statements.
 * CREATE TABLE definitions are parsed first; SELECT column types are resolved
 * against them where possible.
 * Throws if neither kind of statement is found.
 */
export function parseStatements(sql: string): ParsedTable[] {
  let createTables: ParsedTable[] = [];
  try {
    createTables = parseCreateTableStatements(sql);
  } catch {
    // no CREATE TABLE statements — that's fine
  }

  const selectResults = parseSelectStatements(sql, createTables);

  const all = [...createTables, ...selectResults];
  if (all.length === 0) {
    throw new Error(
      "No CREATE TABLE or SELECT statements found."
    );
  }
  return all;
}