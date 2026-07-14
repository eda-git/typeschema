// sqlToPrisma.ts
// Converts CREATE TABLE statements to Prisma model definitions.

import {
  parseCreateTableStatements,
  toPascalCase,
  baseSqlType,
  type ParsedTable,
  type ParsedColumn,
} from "./parseSql";

const PRISMA_TYPE_MAP: Record<string, string> = {
  int: "Int",
  integer: "Int",
  smallint: "Int",
  bigint: "BigInt",
  tinyint: "Int",
  mediumint: "Int",
  serial: "Int",
  bigserial: "BigInt",
  decimal: "Decimal",
  numeric: "Decimal",
  float: "Float",
  double: "Float",
  real: "Float",
  varchar: "String",
  char: "String",
  text: "String",
  tinytext: "String",
  mediumtext: "String",
  longtext: "String",
  uuid: "String",
  boolean: "Boolean",
  bool: "Boolean",
  date: "DateTime",
  datetime: "DateTime",
  timestamp: "DateTime",
  timestamptz: "DateTime",
  time: "DateTime",
  json: "Json",
  jsonb: "Json",
};

function mapSqlTypeToPrisma(sqlType: string): string {
  return PRISMA_TYPE_MAP[baseSqlType(sqlType)] ?? "String";
}

function columnAttributes(col: ParsedColumn, isSerial: boolean): string {
  const attrs: string[] = [];
  if (col.isPrimaryKey) attrs.push("@id");
  if (isSerial) attrs.push("@default(autoincrement())");
  if (col.name === "created_at" && col.hasDefault) attrs.push("@default(now())");
  return attrs.length ? " " + attrs.join(" ") : "";
}

export function tablesToPrisma(tables: ParsedTable[]): string {
  const models = tables.map((table) => {
    const modelName = toPascalCase(table.name);
    const fields = table.columns
      .map((col) => {
        const prismaType = mapSqlTypeToPrisma(col.sqlType);
        const isSerial = baseSqlType(col.sqlType).includes("serial");
        const optional = col.nullable ? "?" : "";
        const attrs = columnAttributes(col, isSerial);
        // Pad the type column for readability, matching `prisma format` style loosely
        return `  ${col.name.padEnd(20)}${prismaType}${optional}${attrs}`;
      })
      .join("\n");

    return `model ${modelName} {\n${fields}\n\n  @@map("${table.name}")\n}`;
  });

  return models.join("\n\n");
}

/** Public entry point — same shape as sqlToTypeScript for drop-in use. */
export function sqlToPrisma(sql: string): string {
  const tables = parseCreateTableStatements(sql);
  return tablesToPrisma(tables);
}