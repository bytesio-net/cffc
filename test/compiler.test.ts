import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { build, init } from '../src/cffc';

const TEST_DIR = path.join(__dirname, 'test-build');

function readOutputFile(filename: string): string {
  try {
    return fs.readFileSync(path.join(TEST_DIR, 'build', filename), 'utf8');
  } catch {
    return '';
  }
}

describe('Build Script with --noExport', () => {
  let originalArgv: string[];

  beforeAll(() => {
    originalArgv = process.argv;

    // Clean and create test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Create test files
    const testFiles = [
      {
        name: 'imports.test.ts',
        content: `import * as crypto from 'crypto';\nimport { readFile } from 'fs';`,
      },
      {
        name: 'exports-variable.test.ts',
        content: `export const DEFAULT_CONFIG = { foo: 'bar' };\nconsole.log(exports.DEFAULT_CONFIG);`,
      },
      {
        name: 'exports-function.test.ts',
        content: `export function handler() {}\n(0, exports.handler)();`,
      },
      {
        name: 'module-exports.test.ts',
        content: `module.exports = { foo: 'bar' };\nmodule.exports.version = '1.0';\n`,
      },
      {
        name: 'export-default.test.ts',
        content: `const App = () => { }\nexport default App;\nexports.default = App;`,
      },
      {
        name: 'type-imports.test.ts',
        content: `import type { Request } from 'express';\nimport { Router } from 'express';`,
      },
      {
        name: 'mixed-exports.test.ts',
        content: `export const foo = 1;\n export function bar() {}\nmodule.exports = { foo: 2 };`,
      },
    ];

    testFiles.forEach(({ name, content }) => {
      fs.writeFileSync(path.join(TEST_DIR, name), content);
    });

    // Create tsconfig
    const tsConfig = {
      compilerOptions: {
        target: 'ES5',
        outDir: './build',
        rootDir: '.',
        strict: true,
        moduleResolution: 'node',
      },
    };

    const tsConfigPath = path.join(TEST_DIR, 'tsconfig.json');
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));

    // Mock CLI arguments
    process.argv = ['node', 'compiler.ts', '-p', tsConfigPath, '--noExport'];

    // Initialize and run build
    try {
      const config = init();
      build(config);
    } catch (error) {
      console.error('Build failed:', error);
      throw error;
    }
  }, 30000);

  afterAll(() => {
    process.argv = originalArgv;
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test('converts imports to require()', () => {
    const output = readOutputFile('imports.test.js');
    expect(output).toMatch(/var crypto = require\(["']crypto["']\)/);
    expect(output).toMatch(
      /var __fs = require\(["']fs["']\);\s*var readFile = __fs\.readFile/
    );
    expect(output).not.toMatch(/import/);
  });

  test('removes exported variables and exports references', () => {
    const output = readOutputFile('exports-variable.test.js');
    expect(output).toMatch(/var DEFAULT_CONFIG = { foo: 'bar' }/);
    expect(output).toMatch(/console.log\(DEFAULT_CONFIG\)/);
    expect(output).not.toMatch(/export/);
    expect(output).not.toMatch(/exports\.DEFAULT_CONFIG/);
  });

  test('removes exported functions and exports references', () => {
    const output = readOutputFile('exports-function.test.js');
    expect(output).toMatch(/function handler\s*\(\s*\)\s*\{/);
    expect(output).not.toMatch(/export/);
    expect(output).not.toMatch(/\(0, exports\.handler\)/);
    expect(output).toMatch(/handler\(\)/);
  });

  test('removes module.exports patterns', () => {
    const output = readOutputFile('module-exports.test.js');
    expect(output).not.toMatch(/module\.exports/);
    expect(output).toMatch('');
  });

  test('removes type-only imports', () => {
    const output = readOutputFile('type-imports.test.js');
    expect(output).not.toMatch(/Request/);
    expect(output).toMatch(/var __express = require\(["']express["']\)/);
    expect(output).toMatch(/var Router = __express\.Router/);
  });

  test('handles export default', () => {
    const output = readOutputFile('export-default.test.js');
    expect(output).toMatch(/var App = function \(\) { }/);
    expect(output).not.toMatch(/export default/);
    expect(output).not.toMatch(/exports\.default/);
  });

  test('handles mixed exports', () => {
    const output = readOutputFile('mixed-exports.test.js');
    expect(output).not.toMatch(/export/);
    expect(output).not.toMatch(/module\.exports/);
    expect(output).toMatch(/var foo = 1/);
    expect(output).toMatch(/function bar\(\) { }/);
  });

  test('removes __esModule marker', () => {
    const output = readOutputFile('exports-variable.test.js');
    expect(output).not.toMatch(/Object\.defineProperty\(exports, "__esModule"/);
  });

  test('removes empty exports', () => {
    const output = readOutputFile('imports.test.js');
    expect(output).not.toMatch(/export\s*{\s*}/);
  });
});
