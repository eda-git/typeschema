// sqlToDrizzle.ts
// Converts CREATE TABLE statements to Drizzle ORM table definitions
// (Postgres dialect via drizzle-orm/pg-core, the most common target).

import {
  parseStatements,
  toCamelCase,
  baseSqlType,
  type ParsedTable,
  type ParsedColumn,
} from "./parseSql";

// Maps SQL base type -> Drizzle pg-core column builder function name
const DRIZZLE_TYPE_MAP: Record<string, string> = {
  int: "integer",
  integer: "integer",
  smallint: "smallint",
  bigint: "bigint",
  tinyint: "smallint",
  mediumint: "integer",
  serial: "serial",
  bigserial: "bigserial",
  decimal: "numeric",
  numeric: "numeric",
  float: "real",
  double: "doublePrecision",
  real: "real",
  varchar: "varchar",
  char: "char",
  text: "text",
  tinytext: "text",
  mediumtext: "text",
  longtext: "text",
  uuid: "uuid",
  boolean: "boolean",
  bool: "boolean",
  date: "date",
  datetime: "timestamp",
  timestamp: "timestamp",
  timestamptz: "timestamp",
  time: "time",
  json: "json",
  jsonb: "jsonb",
};

function mapSqlTypeToDrizzle(sqlType: string): string {
  return DRIZZLE_TYPE_MAP[baseSqlType(sqlType)] ?? "text";
}

function buildColumnDefinition(col: ParsedColumn): string {
  const fnName = mapSqlTypeToDrizzle(col.sqlType);
  const base = baseSqlType(col.sqlType);

  // varchar/char need a length arg to match typical usage
  const lengthMatch = col.sqlType.match(/\((\d+)\)/);
  const needsLength = base === "varchar" || base === "char";
  const args =
    needsLength && lengthMatch
      ? `"${col.name}", { length: ${lengthMatch[1]} }`
      : `"${col.name}"`;

  let chain = `${fnName}(${args})`;
  if (col.isPrimaryKey) chain += ".primaryKey()";
  if (!col.nullable && !col.isPrimaryKey) chain += ".notNull()";
  if (col.name === "created_at" && col.hasDefault) chain += ".defaultNow()";

  return chain;
}

export function tablesToDrizzle(tables: ParsedTable[]): string {
  // Collect which pg-core builder functions are actually used, so the
  // import statement only lists what's needed
  const usedFns = new Set<string>(["pgTable"]);

  const tableBlocks = tables.map((table) => {
    const varName = toCamelCase(table.name);
    const fields = table.columns
      .map((col) => {
        const fnName = mapSqlTypeToDrizzle(col.sqlType);
        usedFns.add(fnName);
        return `  ${toCamelCase(col.name)}: ${buildColumnDefinition(col)},`;
      })
      .join("\n");

    return `export const ${varName} = pgTable("${table.name}", {\n${fields}\n});`;
  });

  const importLine = `import { ${Array.from(usedFns).sort().join(", ")} } from "drizzle-orm/pg-core";`;

  return `${importLine}\n\n${tableBlocks.join("\n\n")}`;
}

/** Public entry point — same shape as sqlToTypeScript for drop-in use. */
export function sqlToDrizzle(sql: string): string {
  const tables = parseStatements(sql);
  return tablesToDrizzle(tables);
}