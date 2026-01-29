#!/usr/bin/env node
/**
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This script adds copyright headers to all source files.
 * Usage: node scripts/add-copyright-headers.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COPYRIGHT_HEADER_JSX = `/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 *
 * For licensing inquiries: hentertrabelsi@gmail.com
 */

`;

const COPYRIGHT_HEADER_JS = `/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 */

`;

const COPYRIGHT_HEADER_CSS = `/**
 * OmniPitch 3D Soccer Experience
 * Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
 *
 * This file is proprietary and confidential.
 * Unauthorized copying, transfer, or use is strictly prohibited.
 */

`;

const COPYRIGHT_HEADER_HTML = `<!--
  OmniPitch 3D Soccer Experience
  Copyright (c) 2026 OmniPitch Games. All Rights Reserved.

  This file is proprietary and confidential.
  Unauthorized copying, transfer, or use is strictly prohibited.
-->

`;

const COPYRIGHT_HEADER_PY = `# OmniPitch 3D Soccer Experience
# Copyright (c) 2026 OmniPitch Games. All Rights Reserved.
#
# This file is proprietary and confidential.
# Unauthorized copying, transfer, or use is strictly prohibited.
#
# For licensing inquiries: hentertrabelsi@gmail.com

`;

// Directories to process
const directories = [
  path.join(__dirname, '..', 'src'),
  path.join(__dirname, '..', 'server'),
];

// File extensions to process
const extensions = {
  '.jsx': COPYRIGHT_HEADER_JSX,
  '.js': COPYRIGHT_HEADER_JS,
  '.css': COPYRIGHT_HEADER_CSS,
  '.html': COPYRIGHT_HEADER_HTML,
  '.py': COPYRIGHT_HEADER_PY,
};

// Files to exclude
const excludeFiles = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'package-lock.json',
];

function shouldProcessFile(filePath) {
  const basename = path.basename(filePath);
  const dirname = path.dirname(filePath);
  
  // Check excluded directories
  for (const exclude of excludeFiles) {
    if (dirname.includes(exclude) || basename === exclude) {
      return false;
    }
  }
  
  // Check file extension
  const ext = path.extname(filePath);
  return extensions.hasOwnProperty(ext);
}

function hasCopyrightHeader(content, ext) {
  const copyrightMarkers = [
    'Copyright (c) 2026 OmniPitch Games',
    'OmniPitch 3D Soccer Experience',
  ];
  
  return copyrightMarkers.some(marker => content.includes(marker));
}

function addCopyrightHeader(filePath) {
  const ext = path.extname(filePath);
  const header = extensions[ext];
  
  if (!header) {
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has copyright
  if (hasCopyrightHeader(content, ext)) {
    console.log(`  [SKIP] Already has header: ${filePath}`);
    return false;
  }
  
  // Handle shebang for JS/Node files
  if ((ext === '.js' || ext === '.jsx') && content.startsWith('#!')) {
    const lines = content.split('\n');
    const shebang = lines[0];
    content = lines.slice(1).join('\n');
    fs.writeFileSync(filePath, shebang + '\n' + header + content);
  } else {
    fs.writeFileSync(filePath, header + content);
  }
  
  console.log(`  [ADDED] ${filePath}`);
  return true;
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let count = 0;
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip excluded directories
      if (excludeFiles.includes(file)) {
        continue;
      }
      count += processDirectory(fullPath);
    } else if (stat.isFile() && shouldProcessFile(fullPath)) {
      if (addCopyrightHeader(fullPath)) {
        count++;
      }
    }
  }
  
  return count;
}

function processConfigFiles() {
  const configFiles = [
    path.join(__dirname, '..', 'vite.config.js'),
    path.join(__dirname, '..', 'index.html'),
  ];
  
  let count = 0;
  for (const filePath of configFiles) {
    if (fs.existsSync(filePath) && shouldProcessFile(filePath)) {
      if (addCopyrightHeader(filePath)) {
        count++;
      }
    }
  }
  
  return count;
}

// Main execution
console.log('='.repeat(60));
console.log('OmniPitch Copyright Header Manager');
console.log('='.repeat(60));
console.log('');

let totalAdded = 0;

// Process source directories
for (const dir of directories) {
  if (fs.existsSync(dir)) {
    console.log(`Processing: ${dir}`);
    totalAdded += processDirectory(dir);
    console.log('');
  }
}

// Process config files
console.log('Processing config files...');
totalAdded += processConfigFiles();
console.log('');

console.log('='.repeat(60));
console.log(`Total headers added: ${totalAdded}`);
console.log('='.repeat(60));
