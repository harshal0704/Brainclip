const fs = require('fs');

const path = 'C:/work/aim_high/Brainclip/Brainclip_Complete_Runtime.ipynb';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

let patched = false;
for (const cell of data.cells) {
    if (cell.cell_type === 'code' && cell.source) {
        for (let i = 0; i < cell.source.length; i++) {
            if (cell.source[i] === 'nest-asyncio==1.6.0\n') {
                if (cell.source[i+1] !== 'fish-speech\n') {
                    cell.source.splice(i + 1, 0, 'fish-speech\n');
                    patched = true;
                }
                break;
            }
        }
    }
}

if (patched) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log("Patched Brainclip_Complete_Runtime.ipynb");
} else {
    console.log("Already patched or pattern not found");
}
