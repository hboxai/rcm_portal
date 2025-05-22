#!/usr/bin/env node

/**
 * This script fixes TypeScript import statements by adding .js extensions
 * to relative imports, as required by ES modules in Node.js with moduleResolution: 'NodeNext'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory to search for TypeScript files
const rootDir = path.join(__dirname, 'src');

// Function to find all .ts files recursively
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fileList = findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to fix import statements in a file
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Regular expression to match relative imports without file extensions
  const importRegex = /import\s+(?:(?:{[^}]*})|(?:[^{}\s,]+))(?:\s*,\s*(?:(?:{[^}]*})|(?:[^{}\s,]+)))?\s+from\s+['"](\.[^'"]*)['"]/g;
  
  content = content.replace(importRegex, (match, importPath) => {
    // Skip if the import already has a file extension
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    
    modified = true;
    const newImportPath = `${importPath}.js`;
    return match.replace(importPath, newImportPath);
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed imports in: ${filePath}`);
  }
}

// Find and fix all TypeScript files
const tsFiles = findTsFiles(rootDir);
console.log(`Found ${tsFiles.length} TypeScript files to process.`);

tsFiles.forEach(filePath => {
  try {
    fixImports(filePath);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
});

console.log('Import fixing completed!');
