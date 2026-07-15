// sqlToTypeScript.ts
// CREATE TABLE / SELECT -> TypeScript interface converter.

import {
  parseStatements,
  toPascalCase,
  type ParsedTable,
} from "./parseSql";

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

// --- Rendering -----------------------------------------------------------

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
 * Converts raw SQL (CREATE TABLE and/or SELECT statements) to TypeScript
 * interface source. This is the function App.tsx calls.
 */
export function sqlToTypeScript(sql: string): string {
  const tables = parseStatements(sql);
  return tablesToTypeScript(tables);
}