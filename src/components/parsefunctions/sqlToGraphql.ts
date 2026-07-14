import {
	parseCreateTableStatements,
	toPascalCase,
	baseSqlType,
	type ParsedColumn,
	type ParsedTable,
} from "./parseSql";

const GRAPHQL_TYPE_MAP: Record<string, string> = {
	int: "Int",
	integer: "Int",
	smallint: "Int",
	tinyint: "Int",
	mediumint: "Int",
	serial: "Int",
	float: "Float",
	double: "Float",
	real: "Float",
	decimal: "Float",
	numeric: "Float",
	bigint: "String",
	bigserial: "String",
	varchar: "String",
	char: "String",
	text: "String",
	tinytext: "String",
	mediumtext: "String",
	longtext: "String",
	uuid: "ID",
	boolean: "Boolean",
	bool: "Boolean",
	date: "String",
	datetime: "String",
	timestamp: "String",
	timestamptz: "String",
	time: "String",
	json: "String",
	jsonb: "String",
};

function mapSqlTypeToGraphql(col: ParsedColumn): string {
	const baseType = baseSqlType(col.sqlType);

	if (col.isPrimaryKey && ["int", "integer", "serial", "uuid"].includes(baseType)) {
		return "ID";
	}

	return GRAPHQL_TYPE_MAP[baseType] ?? "String";
}

function renderField(col: ParsedColumn): string {
	const graphqlType = mapSqlTypeToGraphql(col);
	const nullableSuffix = col.nullable ? "" : "!";
	return `  ${col.name}: ${graphqlType}${nullableSuffix}`;
}

export function tablesToGraphql(tables: ParsedTable[]): string {
	return tables
		.map((table) => {
			const typeName = toPascalCase(table.name);
			const fields = table.columns.map(renderField).join("\n");

			return `type ${typeName} {\n${fields}\n}`;
		})
		.join("\n\n");
}

export function sqlToGraphql(sql: string): string {
	const tables = parseCreateTableStatements(sql);
	return tablesToGraphql(tables);
}
