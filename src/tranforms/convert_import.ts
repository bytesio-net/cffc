import ts from 'typescript';

export const convertImportsTransformer: ts.TransformerFactory<ts.SourceFile> = (
  context
) => {
  return (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node | ts.Node[] | undefined => {
      if (ts.isImportDeclaration(node)) {
        // Handle type-only imports (remove completely)
        if (node.importClause?.isTypeOnly) {
          return undefined;
        }

        const moduleSpecifier = node.moduleSpecifier
          .getText()
          .replace(/['"]/g, '');
        const importClause = node.importClause;

        if (importClause) {
          // Handle type-only elements in named imports
          if (
            importClause.namedBindings &&
            ts.isNamedImports(importClause.namedBindings)
          ) {
            const filteredElements = importClause.namedBindings.elements.filter(
              (element) => !element.isTypeOnly
            );

            if (filteredElements.length === 0) {
              return undefined;
            }

            // Create a new import clause without type-only elements
            const newImportClause = ts.factory.updateImportClause(
              importClause,
              false, // isTypeOnly
              importClause.name,
              ts.factory.createNamedImports(filteredElements)
            );

            // Create a new import declaration with the filtered elements
            const newNode = ts.factory.updateImportDeclaration(
              node,
              node.modifiers,
              newImportClause,
              node.moduleSpecifier,
              node.assertClause
            );

            // Process the modified import declaration
            const statements = processRegularImport(newNode, moduleSpecifier);
            return statements.length > 0 ? statements : undefined;
          }

          // Process other import types (namespace, default)
          const statements = processRegularImport(node, moduleSpecifier);
          return statements.length > 0 ? statements : undefined;
        }

        // Handle side-effect-only imports (import "module")
        return undefined;
      }
      return ts.visitEachChild(node, visitor, context);
    };

    return ts.visitEachChild(sourceFile, visitor, context);
  };
};

const createRequireStatement = (varName: string, moduleSpecifier: string) => {
  return ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          varName,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createIdentifier('require'),
            [],
            [ts.factory.createStringLiteral(moduleSpecifier)]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );
};

const processRegularImport = (
  node: ts.ImportDeclaration,
  moduleSpecifier: string
): ts.Node[] => {
  const importClause = node.importClause!;

  // Handle namespace imports (import * as crypto from 'crypto')
  if (
    importClause.namedBindings &&
    ts.isNamespaceImport(importClause.namedBindings)
  ) {
    const varName = importClause.namedBindings.name.text;
    return [createRequireStatement(varName, moduleSpecifier)];
  }

  // Handle default imports (import crypto from 'crypto')
  if (importClause.name) {
    const varName = importClause.name.text;
    return [createRequireStatement(varName, moduleSpecifier)];
  }

  // Handle named imports with remaining specifiers after type-only removal
  if (
    importClause.namedBindings &&
    ts.isNamedImports(importClause.namedBindings)
  ) {
    const varName = `__${moduleSpecifier.replace(/\W/g, '_')}`;
    const requireStatement = createRequireStatement(varName, moduleSpecifier);
    const destructuringStatement = ts.factory.createVariableStatement(
      undefined,
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            ts.factory.createObjectBindingPattern(
              importClause.namedBindings.elements.map((element) =>
                ts.factory.createBindingElement(
                  undefined,
                  element.propertyName,
                  element.name
                )
              )
            ),
            undefined,
            undefined,
            ts.factory.createIdentifier(varName)
          ),
        ],
        ts.NodeFlags.Const
      )
    );
    return [requireStatement, destructuringStatement];
  }

  return [];
};
