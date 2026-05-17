const fs = require('fs');
const path = require('path');

function listFiles(dir, indent = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.endsWith('.log') || entry.name === '.env') continue;
        console.log(`${indent}${entry.name}${entry.isDirectory() ? '/' : ''}`);
        if (entry.isDirectory()) {
            listFiles(path.join(dir, entry.name), indent + '  ');
        }
    }
}

listFiles('.');