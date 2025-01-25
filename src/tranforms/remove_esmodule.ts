import ts from 'typescript';

export const removeEsModuleTransformer: ts.TransformerFactory<ts.SourceFile> = (
  context
) => {
  return (sourceFile) => {
    const visit = (node: ts.Node): ts.Node | undefined => {
      if (
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === 'Object' &&
        ts.isIdentifier(node.expression.expression.name) &&
        node.expression.expression.name.text === 'defineProperty' &&
        node.expression.arguments.length >= 2
      ) {
        const [arg0, arg1] = node.expression.arguments;
        const isExports = ts.isIdentifier(arg0) && arg0.text === 'exports';
        const isEsModule =
          ts.isStringLiteral(arg1) && arg1.text === '__esModule';

        if (isExports && isEsModule) {
          return undefined;
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitEachChild(sourceFile, visit, context);
  };
};
