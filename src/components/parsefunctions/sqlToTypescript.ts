// sqlToTypeScript.ts
// Zero-dependency CREATE TABLE -> TypeScript interface converter.
// Handles Postgres/MySQL-style syntax. Not a full SQL parser — it's
// deliberately narrow: CREATE TABLE statements only, no views/enums/CTEs.

interface ParsedColumn {
  name: string;
  sqlType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
}

// --- SQL type -> TS type mapping -------------------------------------

const TYPE_MAP: Record<string, string> = {
  // integers
  int: "number",
  integer: "number",
  smallint: "number",
  bigint: "number",
  tinyint: "number",
  mediumint: "number",
  serial: "number",
  bigserial: "number",
  // decimals
  decimal: "number",
  numeric: "number",
  float: "number",
  double: "number",
  real: "number",
  // strings
  varchar: "string",
  char: "string",
  text: "string",
  tinytext: "string",
  mediumtext: "string",
  longtext: "string",
  uuid: "string",
  // boolean
  boolean: "boolean",
  bool: "boolean",
  // dates — mapped to string since raw SQL drivers return ISO strings,
  // not Date objects, unless you're transforming them yourself
  date: "string",
  datetime: "string",
  timestamp: "string",
  timestamptz: "string",
  time: "string",
  // json
  json: "unknown",
  jsonb: "unknown",
};

function mapSqlTypeToTs(sqlType: string): string {
  // Strip size/precision info: varchar(255) -> varchar, decimal(10,2) -> decimal
  const base = sqlType.trim().toLowerCase().replace(/\(.*\)/, "").trim();
  return TYPE_MAP[base] ?? "unknown";
}

// --- Parsing -----------------------------------------------------------

/**
 * Parses one or more CREATE TABLE statements into ParsedTable[].
 * Throws with a descriptive message if no CREATE TABLE statements are found.
 */
export function parseCreateTableStatements(sql: string): ParsedTable[] {
  const tables: ParsedTable[] = [];

  // Match: CREATE TABLE [IF NOT EXISTS] `name`/"name"/name ( ...body... )
  // The body is captured greedily up to the matching closing paren + semicolon,
  // found via a balanced-paren scan below rather than regex alone (regex can't
  // reliably match nested parens, e.g. DECIMAL(10,2) inside the column list).
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

/**
 * Given the source string and the index of an opening paren, returns the
 * substring between it and its matching closing paren (exclusive of both).
 * Returns null if parens never balance.
 */
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

/**
 * Splits a column-definition body on top-level commas (ignoring commas
 * inside nested parens, e.g. DECIMAL(10,2)) and parses each line.
 * Skips constraint-only lines (PRIMARY KEY (...), FOREIGN KEY (...), etc.)
 * that aren't inline column definitions.
 */
function parseColumnDefinitions(body: string): ParsedColumn[] {
  const lines = splitTopLevelCommas(body);
  const columns: ParsedColumn[] = [];
  const inlinePrimaryKeys = new Set<string>();

  // First pass: catch table-level PRIMARY KEY (col1, col2) constraints
  for (const line of lines) {
    const tablePkMatch = line
      .trim()
      .match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i);
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

    // Skip lines that are pure table-level constraints, not columns
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

/**
 * Parses a single column definition line, e.g.:
 *   "email VARCHAR(255) NOT NULL"
 *   `"id" SERIAL PRIMARY KEY`
 *   "created_at TIMESTAMP DEFAULT now()"
 */
function parseSingleColumn(line: string): ParsedColumn | null {
  // name: quoted identifier, bracketed identifier, or bare word
  const nameMatch = line.match(/^[`"[]?(\w+)[`"\]]?\s+(.+)$/s);
  if (!nameMatch) return null;

  const [, name, rest] = nameMatch;

  // type: first word, optionally followed by (n) or (n,m)
  const typeMatch = rest.match(/^(\w+(?:\s*\([^)]*\))?)/);
  if (!typeMatch) return null;
  const sqlType = typeMatch[1];

  const upperRest = rest.toUpperCase();
  const isPrimaryKey = /PRIMARY\s+KEY/.test(upperRest);
  const isExplicitlyNotNull = /NOT\s+NULL/.test(upperRest);

  // A column is nullable unless explicitly NOT NULL or it's a primary key
  // (primary keys are implicitly NOT NULL in every SQL dialect that matters here)
  const nullable = !isExplicitlyNotNull && !isPrimaryKey;

  return {
    name,
    sqlType,
    nullable,
    isPrimaryKey,
  };
}

/**
 * Splits a string on commas that are NOT inside nested parentheses.
 * Needed because column lists contain commas both as separators
 * (col1, col2) and inside type args (DECIMAL(10,2)).
 */
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

// --- Rendering -----------------------------------------------------------

function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

/**
 * Renders parsed tables as TypeScript interfaces.
 */
export function tablesToTypeScript(tables: ParsedTable[]): string {
  return tables
    .map((table) => {
      const interfaceName = toPascalCase(table.name);
      const fields = table.columns
        .map((col) => {
          const tsType = mapSqlTypeToTs(col.sqlType);
          const optional = col.nullable ? "?" : "";
          const typeWithNull = col.nullable ? `${tsType} | null` : tsType;
          return `  ${col.name}${optional}: ${typeWithNull};`;
        })
        .join("\n");

      return `export interface ${interfaceName} {\n${fields}\n}`;
    })
    .join("\n\n");
}

// --- Public entry point ---------------------------------------------------

/**
 * Converts raw SQL (one or more CREATE TABLE statements) directly to
 * TypeScript interface source. This is the function App.tsx calls.
 */
export function sqlToTypeScript(sql: string): string {
  const tables = parseCreateTableStatements(sql);
  return tablesToTypeScript(tables);
}