import fs from 'fs';
import { BIRTHDAY_DATA } from './src/data.js';

let uniqueMap = new Map();
let duplicatesRemoved = 0;

BIRTHDAY_DATA.forEach(item => {
    let key = item.name.trim().toLowerCase() + '|' + item.birthday.trim();
    if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
    } else {
        duplicatesRemoved++;
    }
});

let uniqueData = Array.from(uniqueMap.values());
let newDataString = `export const BIRTHDAY_DATA = ${JSON.stringify(uniqueData, null, 4)};\n\n`;

let content = fs.readFileSync('./src/data.js', 'utf8');

// Replace the old BIRTHDAY_DATA
// It starts at the beginning of the file until "export const LOCAL_IMAGES"
const splitToken = 'export const LOCAL_IMAGES = [';
const parts = content.split(splitToken);

if (parts.length === 2) {
    let newContent = newDataString + splitToken + parts[1];
    fs.writeFileSync('./src/data.js', newContent, 'utf8');
    console.log(`Deduplication complete. Removed ${duplicatesRemoved} duplicates. Total unique records remaining: ${uniqueData.length}`);
} else {
    console.error("Could not find the split token in data.js");
}
