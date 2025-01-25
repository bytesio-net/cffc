import ts from 'typescript';

export const removeExportTransformer = (context: ts.TransformationContext) => {
  return (sourceFile: ts.SourceFile): ts.SourceFile => {
    const visitor = (node: ts.Node): ts.Node | undefined => {
      // Remove ALL export declarations
      if (ts.isExportDeclaration(node)) {
        return undefined;
      }

      // Remove export assignments
      if (ts.isExportAssignment(node)) {
        return undefined;
      }

      // Remove export modifiers
      if (ts.isModifier(node) && node.kind === ts.SyntaxKind.ExportKeyword) {
        return undefined;
      }

      return ts.visitEachChild(node, visitor, context);
    };

    const updatedStatements = sourceFile.statements
      .map((statement) => ts.visitNode(statement, visitor))
      .filter((s): s is ts.Statement => s !== undefined);

    return ts.factory.updateSourceFile(sourceFile, updatedStatements);
  };
};

export const removeModuleExportsTransformer: ts.TransformerFactory<
  ts.SourceFile
> = (context) => {
  return (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node | undefined => {
      if (
        ts.isExpressionStatement(node) &&
        ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const left = node.expression.left;

        // Handle module.exports = ...
        if (
          ts.isPropertyAccessExpression(left) &&
          ts.isIdentifier(left.expression) &&
          left.expression.text === 'module' &&
          left.name.text === 'exports'
        ) {
          return undefined;
        }

        // Handle module.exports.x = ...
        if (
          ts.isPropertyAccessExpression(left) &&
          ts.isPropertyAccessExpression(left.expression) &&
          ts.isIdentifier(left.expression.expression) &&
          left.expression.expression.text === 'module' &&
          left.expression.name.text === 'exports'
        ) {
          return undefined;
        }
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitEachChild(sourceFile, visitor, context);
  };
};
