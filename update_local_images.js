import fs from 'fs';

const files = fs.readdirSync('./public/img');

let dataContent = fs.readFileSync('./src/data.js', 'utf8');

// Use a regex to replace the LOCAL_IMAGES array
const localImagesRegex = /export const LOCAL_IMAGES = \[\s*([\s\S]*?)\s*\];/;

const newArrayString = 'export const LOCAL_IMAGES = [\n    "' + files.join('",\n    "') + '"\n];';

if (localImagesRegex.test(dataContent)) {
    dataContent = dataContent.replace(localImagesRegex, newArrayString);
    fs.writeFileSync('./src/data.js', dataContent, 'utf8');
    console.log(`Successfully updated LOCAL_IMAGES with ${files.length} images.`);
} else {
    console.error("Could not find LOCAL_IMAGES array in data.js");
}
