// sqlToZod.ts
// Converts CREATE TABLE statements to Zod schemas. Zero dependencies aside
// from assuming the *user's* project has zod installed — this file only
// emits Zod's own syntax as a string, it doesn't import zod itself.

import {
  parseStatements,
  toPascalCase,
  baseSqlType,
  type ParsedTable,
} from "./parseSql";

const ZOD_TYPE_MAP: Record<string, string> = {
  int: "z.number().int()",
  integer: "z.number().int()",
  smallint: "z.number().int()",
  bigint: "z.number().int()",
  tinyint: "z.number().int()",
  mediumint: "z.number().int()",
  serial: "z.number().int()",
  bigserial: "z.number().int()",
  decimal: "z.number()",
  numeric: "z.number()",
  float: "z.number()",
  double: "z.number()",
  real: "z.number()",
  varchar: "z.string()",
  char: "z.string()",
  text: "z.string()",
  tinytext: "z.string()",
  mediumtext: "z.string()",
  longtext: "z.string()",
  uuid: "z.string().uuid()",
  boolean: "z.boolean()",
  bool: "z.boolean()",
  date: "z.string()",
  datetime: "z.string()",
  timestamp: "z.string()",
  timestamptz: "z.string()",
  time: "z.string()",
  json: "z.unknown()",
  jsonb: "z.unknown()",
};

function mapSqlTypeToZod(sqlType: string): string {
  return ZOD_TYPE_MAP[baseSqlType(sqlType)] ?? "z.unknown()";
}

export function tablesToZod(tables: ParsedTable[]): string {
  const schemas = tables.map((table) => {
    const schemaName = `${toPascalCase(table.name)}Schema`;
    const fields = table.columns
      .map((col) => {
        let zodType = mapSqlTypeToZod(col.sqlType);
        if (col.nullable) zodType += ".nullable()";
        if (col.nullable && col.hasDefault) zodType += ".optional()";
        return `  ${col.name}: ${zodType},`;
      })
      .join("\n");

    return `export const ${schemaName} = z.object({\n${fields}\n});\n\nexport type ${toPascalCase(
      table.name
    )} = z.infer<typeof ${schemaName}>;`;
  });

  return `import { z } from "zod";\n\n${schemas.join("\n\n")}`;
}

/** Public entry point — same shape as sqlToTypeScript for drop-in use. */
export function sqlToZod(sql: string): string {
  const tables = parseStatements(sql);
  return tablesToZod(tables);
}