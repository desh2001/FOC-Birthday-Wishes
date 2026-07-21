import { BIRTHDAY_DATA, getLocalImagePath } from './src/data.js';

let matchedCount = 0;
BIRTHDAY_DATA.forEach(student => {
    const path = getLocalImagePath(student);
    if (path) {
        matchedCount++;
        // console.log(`Matched: ${student.name} -> ${path}`);
    }
});

console.log(`Matched ${matchedCount} out of ${BIRTHDAY_DATA.length} students.`);
