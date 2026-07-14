import {
  parseCreateTableStatements,
  toPascalCase,
  baseSqlType,
  type ParsedColumn,
  type ParsedTable,
} from "./parseSql";

const DJANGO_FIELD_MAP: Record<string, string> = {
  int: "IntegerField",
  integer: "IntegerField",
  smallint: "SmallIntegerField",
  bigint: "BigIntegerField",
  tinyint: "SmallIntegerField",
  mediumint: "IntegerField",
  serial: "AutoField",
  bigserial: "BigAutoField",
  decimal: "DecimalField",
  numeric: "DecimalField",
  float: "FloatField",
  double: "FloatField",
  real: "FloatField",
  varchar: "CharField",
  char: "CharField",
  text: "TextField",
  tinytext: "TextField",
  mediumtext: "TextField",
  longtext: "TextField",
  uuid: "UUIDField",
  boolean: "BooleanField",
  bool: "BooleanField",
  date: "DateField",
  datetime: "DateTimeField",
  timestamp: "DateTimeField",
  timestamptz: "DateTimeField",
  time: "TimeField",
  json: "JSONField",
  jsonb: "JSONField",
};

function mapSqlTypeToDjango(sqlType: string): string {
  return DJANGO_FIELD_MAP[baseSqlType(sqlType)] ?? "TextField";
}

function getFieldArgs(col: ParsedColumn): string[] {
  const baseType = baseSqlType(col.sqlType);
  const args: string[] = [];

  if (col.isPrimaryKey) {
    args.push("primary_key=True");
  }

  if (col.nullable) {
    args.push("null=True");
    if (["varchar", "char", "text", "tinytext", "mediumtext", "longtext"].includes(baseType)) {
      args.push("blank=True");
    }
  }

  const lengthMatch = col.sqlType.match(/\((\d+)\)/);
  if (["varchar", "char"].includes(baseType) && lengthMatch) {
    args.push(`max_length=${lengthMatch[1]}`);
  }

  const precisionMatch = col.sqlType.match(/\((\d+)\s*,\s*(\d+)\)/);
  if (["decimal", "numeric"].includes(baseType) && precisionMatch) {
    args.push(`max_digits=${precisionMatch[1]}`);
    args.push(`decimal_places=${precisionMatch[2]}`);
  }

  if (col.name === "created_at" && col.hasDefault && ["timestamp", "timestamptz", "datetime"].includes(baseType)) {
    args.push("auto_now_add=True");
  }

  return args;
}

function renderField(col: ParsedColumn): string {
  const fieldType = mapSqlTypeToDjango(col.sqlType);
  const args = getFieldArgs(col);
  const argList = args.length > 0 ? `(${args.join(", ")})` : "()";
  return `    ${col.name} = models.${fieldType}${argList}`;
}

export function tablesToDjango(tables: ParsedTable[]): string {
  const modelBlocks = tables.map((table) => {
    const modelName = toPascalCase(table.name);
    const fields = table.columns.map(renderField).join("\n");

    return [
      `class ${modelName}(models.Model):`,
      fields || "    pass",
      "",
      "    class Meta:",
      `        db_table = \"${table.name}\"`,
    ].join("\n");
  });

  return `from django.db import models\n\n\n${modelBlocks.join("\n\n\n")}`;
}

export function sqlToDjango(sql: string): string {
  const tables = parseCreateTableStatements(sql);
  return tablesToDjango(tables);
}