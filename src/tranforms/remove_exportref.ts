import ts from 'typescript';

export const removeExportsReferencesTransformer: ts.TransformerFactory<
  ts.SourceFile
> = (context) => {
  return (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node | undefined => {
      // Remove export assignments (exports.x = ...)
      if (
        ts.isExpressionStatement(node) &&
        ts.isBinaryExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.left) &&
        ts.isIdentifier(node.expression.left.expression) &&
        node.expression.left.expression.text === 'exports'
      ) {
        return undefined;
      }

      // Replace exports.x with x in all contexts
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'exports'
      ) {
        return ts.factory.createIdentifier(node.name.text);
      }

      // Handle (0, exports.x)() pattern
      if (
        ts.isCallExpression(node) &&
        ts.isParenthesizedExpression(node.expression) &&
        ts.isBinaryExpression(node.expression.expression) &&
        node.expression.expression.operatorToken.kind ===
          ts.SyntaxKind.CommaToken &&
        ts.isPropertyAccessExpression(node.expression.expression.right) &&
        ts.isIdentifier(node.expression.expression.right.expression) &&
        node.expression.expression.right.expression.text === 'exports'
      ) {
        return ts.factory.updateCallExpression(
          node,
          node.expression.expression.right.name,
          node.typeArguments,
          node.arguments
        );
      }

      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitEachChild(sourceFile, visitor, context);
  };
};
