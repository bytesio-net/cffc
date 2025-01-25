import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { convertImportsTransformer } from './tranforms/convert_import';
import { removeEsModuleTransformer } from './tranforms/remove_esmodule';
import {
  removeExportTransformer,
  removeModuleExportsTransformer,
} from './tranforms/remove_export';
import { removeExportsReferencesTransformer } from './tranforms/remove_exportref';

interface BuildConfig {
  compilerOptions: ts.CompilerOptions;
  rootNames: string[];
  noExport: boolean;
}

export const init = (): BuildConfig => {
  const args = process.argv.slice(2);

  // Extract custom --noExport flag
  const noExportIndex = args.indexOf('--noExport');
  const noExport = noExportIndex !== -1;
  if (noExport) args.splice(noExportIndex, 1);

  // Parse standard TSC command line arguments
  const commandLine = ts.parseCommandLine(args);
  if (commandLine.errors.length > 0) {
    throw new Error(
      commandLine.errors.map((e) => e.messageText.toString()).join('\n')
    );
  }

  // Resolve tsconfig path (CLI --project has higher priority)
  const tsconfigPath = commandLine.options.project || 'tsconfig.json';
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`tsconfig not found: ${tsconfigPath}`);
  }

  // Read and parse tsconfig
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(`TSConfig error: ${configFile.error.messageText}`);
  }

  // Merge CLI options with tsconfig (CLI options take precedence)
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
    commandLine.options,
    tsconfigPath
  );

  if (parsedConfig.errors.length > 0) {
    throw new Error(
      parsedConfig.errors.map((e) => e.messageText.toString()).join('\n')
    );
  }

  // Determine root files (CLI files override tsconfig)
  const rootNames =
    commandLine.fileNames.length > 0
      ? commandLine.fileNames
      : parsedConfig.fileNames;

  // Resolve to absolute paths
  const absoluteRootNames = rootNames.map((file) =>
    path.isAbsolute(file)
      ? file
      : path.resolve(path.dirname(tsconfigPath), file)
  );

  // Verify files exist
  absoluteRootNames.forEach((file) => {
    if (!fs.existsSync(file)) throw new Error(`Source file not found: ${file}`);
  });

  return {
    compilerOptions: parsedConfig.options,
    rootNames: absoluteRootNames,
    noExport,
  };
};

export const build = (config: BuildConfig): void => {
  const { compilerOptions, rootNames, noExport } = config;

  const program = ts.createProgram({ rootNames, options: compilerOptions });
  const sourceFiles = program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile && !sf.fileName.endsWith('types.ts'));

  console.log(
    'Processing:',
    sourceFiles.map((sf) => sf.fileName)
  );

  sourceFiles.forEach((sourceFile) => {
    transpileFile(sourceFile, compilerOptions, noExport);
  });
};

const transpileFile = (
  sourceFile: ts.SourceFile,
  options: ts.CompilerOptions,
  noExport: boolean
) => {
  const result = ts.transpileModule(sourceFile.text, {
    compilerOptions: {
      ...options,
      module: noExport ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
    },
    transformers: noExport
      ? {
          before: [convertImportsTransformer],
          after: [
            removeEsModuleTransformer,
            removeExportsReferencesTransformer,
            removeModuleExportsTransformer,
            removeExportTransformer,
          ],
        }
      : undefined,
  });

  const cleanedOutput = result.outputText
    .replace(/^"use strict";\s*[\r\n]*/gm, '')
    .replace(/^export\s*{\s*};?$\n?/gm, '')
    .trim();

  if (!cleanedOutput || /^\/\*.*\*\/$/.test(cleanedOutput)) {
    console.log(`Skipped empty file: ${sourceFile.fileName}`);
    return;
  }

  const outPath = path.join(
    options.outDir || 'build',
    path.basename(sourceFile.fileName).replace(/\.ts$/, '.js')
  );

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, cleanedOutput);
  console.log(`Generated: ${outPath}`);
};

// CLI Execution
if (require.main === module) {
  try {
    const config = init();
    build(config);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
