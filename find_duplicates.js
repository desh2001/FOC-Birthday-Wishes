import { BIRTHDAY_DATA } from './src/data.js';

let names = new Set();
let duplicates = [];
let whatsapp = new Set();

BIRTHDAY_DATA.forEach(item => {
    let rawName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    let wNum = item.whatsapp;

    if (names.has(rawName)) {
        duplicates.push(`Duplicate by name: ${item.name}`);
    } else {
        names.add(rawName);
    }

    if (wNum && whatsapp.has(wNum)) {
        duplicates.push(`Duplicate by whatsapp: ${item.name} (${wNum})`);
    } else if (wNum) {
        whatsapp.add(wNum);
    }
});

console.log(`Found ${duplicates.length} potential duplicates.`);
console.log(duplicates.join('\n'));
