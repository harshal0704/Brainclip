const fs = require('fs');

const path = 'C:/work/aim_high/Brainclip/Brainclip_Complete_Runtime.ipynb';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

let patched = false;
for (const cell of data.cells) {
    if (cell.cell_type === 'code' && cell.source) {
        for (let i = 0; i < cell.source.length; i++) {
            if (cell.source[i].includes('sudo apt-get install -y chromium-browser ffmpeg')) {
                if (!cell.source[i].includes('portaudio19-dev')) {
                    cell.source[i] = cell.source[i].replace(
                        'sudo apt-get install -y chromium-browser ffmpeg', 
                        'sudo apt-get install -y chromium-browser ffmpeg portaudio19-dev python3-pyaudio'
                    );
                    patched = true;
                }
            }
        }
    }
}

if (patched) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log("Patched Brainclip_Complete_Runtime.ipynb to include portaudio19-dev");
} else {
    console.log("Already patched or pattern not found");
}
