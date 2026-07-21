import { BIRTHDAY_DATA, getLocalImagePath, EXPLICIT_MAP } from './src/data.js';
import fs from 'fs';

const files = fs.readdirSync('./public/img');

let matchedFiles = new Set();
BIRTHDAY_DATA.forEach(student => {
    const path = getLocalImagePath(student);
    if (path) {
        matchedFiles.add(path.replace('img/', ''));
    }
});

const unmatchedFiles = files.filter(f => !matchedFiles.has(f));
console.log(`Unmatched Files (${unmatchedFiles.length}):`);
console.log(unmatchedFiles.join('\n'));
