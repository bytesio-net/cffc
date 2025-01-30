# CloudFront Functions Compiler (cffc)

**cffc** is a specialized TypeScript compiler extension that enables seamless development of CloudFront Functions using Typescript.

Amazon CloudFront Functions have strict requirements **cffc** extends the official TypeScript compiler (`tsc`) with:
- 🔄 Automatic export/import transformation

## Features ✨

- 🛠 **TSC Extensions** - Full TypeScript support with CloudFront-specific transforms
- 🚫 **noExport** - Remove all export declarations
- 🔄 **Import Conversion** - Transform ES imports to CommonJS `require()`
- 🧼 **Module Cleanup** - Remove `__esModule` markers and `module.exports`

## Installation 📦

```bash
# Global installation
npm install -g cffc

# Local project installation
npm install --save-dev cffc
```

## Usage 
```bash
cffc -p tsconfig.cfFn.json
```

Flag | Description |
| - | - |
| `-p` | 	Path to tsconfig.json (default: tsconfig.json) |
| `--export` | Disables export removal and keeps standard module behavior (ESM/CJS intact) |

## Idea
This tool extends the TypeScript compiler (tsc) to convert modern TypeScript code into CloudFront-compatible JavaScript. It works in two main steps:

1. Convert to ESNext: First, it compiles TypeScript into ESNext JavaScript, preserving modern syntax like import/export.
2. Rewrite Syntax: Then, it applies custom transformations to rewrite the code:

- Converts import → require()
- Removes export and module.exports
- Cleans up __esModule markers
- Strips unnecessary runtime code

This ensures the output is compatible with CloudFront Functions' strict ES5 runtime while maintaining a modern development workflow.