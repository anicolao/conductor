const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");

const MAX_OPERATORS = 2;
const TARGET_DIRS = ["src", "functions", "observability-ui/src"];

let hasViolations = false;

function isLogicalOperator(kind) {
	return (
		kind === ts.SyntaxKind.AmpersandAmpersandToken ||
		kind === ts.SyntaxKind.BarBarToken
	);
}

function countOperators(node) {
	let count = 0;
	if (
		ts.isBinaryExpression(node) &&
		isLogicalOperator(node.operatorToken.kind)
	) {
		count = 1 + countOperators(node.left) + countOperators(node.right);
	} else if (ts.isParenthesizedExpression(node)) {
		count = countOperators(node.expression);
	} else if (
		ts.isPrefixUnaryExpression(node) &&
		node.operator === ts.SyntaxKind.ExclamationToken
	) {
		count = countOperators(node.operand);
	}
	return count;
}

/**
 * For a given logical binary expression, we want to find the "root" of the contiguous
 * logical expression so we don't report the same violation multiple times for sub-expressions.
 */
function isRootLogicalExpression(node) {
	if (
		!ts.isBinaryExpression(node) ||
		!isLogicalOperator(node.operatorToken.kind)
	) {
		return false;
	}

	const parent = node.parent;
	if (!parent) return true;

	if (
		ts.isBinaryExpression(parent) &&
		isLogicalOperator(parent.operatorToken.kind)
	) {
		return false;
	}

	if (ts.isParenthesizedExpression(parent)) {
		// If it's wrapped in parens, we need to check the parent of the parens
		let current = parent;
		while (current.parent && ts.isParenthesizedExpression(current.parent)) {
			current = current.parent;
		}
		if (
			current.parent &&
			ts.isBinaryExpression(current.parent) &&
			isLogicalOperator(current.parent.operatorToken.kind)
		) {
			return false;
		}
	}

	return true;
}

function checkTsJsFile(filePath) {
	const sourceText = fs.readFileSync(filePath, "utf8");
	const sourceFile = ts.createSourceFile(
		filePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
	);

	function visit(node) {
		if (isRootLogicalExpression(node)) {
			const count = countOperators(node);
			if (count > MAX_OPERATORS) {
				const { line, character } = sourceFile.getLineAndCharacterOfPosition(
					node.getStart(),
				);
				console.log(
					`${filePath}:${line + 1}:${character + 1}: Complex boolean expression found (${count} operators)`,
				);
				hasViolations = true;
			}
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
}

function checkSvelteFile(filePath) {
	const sourceText = fs.readFileSync(filePath, "utf8");
	const lines = sourceText.split("\n");

	lines.forEach((line, index) => {
		// Split line by Svelte expression boundaries to avoid counting operators
		// from separate expressions on the same line as a single complex expression.
		const expressions = line.split(/\{|\}/);
		expressions.forEach((expr) => {
			const matches = expr.match(/&&|\|\|/g);
			if (matches && matches.length > MAX_OPERATORS) {
				console.log(
					`${filePath}:${index + 1}: Potential complex boolean expression found (${matches.length} operators)`,
				);
				hasViolations = true;
			}
		});
	});
}

function walkDir(dir) {
	if (!fs.existsSync(dir)) return;
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			walkDir(filePath);
		} else {
			const ext = path.extname(filePath);
			if (ext === ".ts" || ext === ".js") {
				checkTsJsFile(filePath);
			} else if (ext === ".svelte") {
				checkSvelteFile(filePath);
			}
		}
	}
}

TARGET_DIRS.forEach(walkDir);

if (hasViolations) {
	process.exit(1);
} else {
	console.log("No complex boolean expressions found.");
	process.exit(0);
}
