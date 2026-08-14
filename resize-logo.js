import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resizeLogos() {
    const inputPath = path.join(__dirname, 'public', 'logo-stability.png');
    const out192 = path.join(__dirname, 'public', 'pwa-192x192.png');
    const out512 = path.join(__dirname, 'public', 'pwa-512x512.png');

    try {
        await sharp(inputPath).resize(192, 192).toFile(out192);
        console.log('✅ pwa-192x192.png generado correctamente');

        await sharp(inputPath).resize(512, 512).toFile(out512);
        console.log('✅ pwa-512x512.png generado correctamente');
    } catch (error) {
        console.error('❌ Error redimensionando el logo:', error);
    }
}

resizeLogos();
