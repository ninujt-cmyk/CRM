const fs = require('fs');
const path = require('path');

const MODEL_CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const MODELS_TO_DOWNLOAD = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

const targetDir = path.join(__dirname, '../public/models');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function downloadFile(fileName) {
  const url = `${MODEL_CDN_URL}${fileName}`;
  const filePath = path.join(targetDir, fileName);
  
  console.log(`Downloading: ${fileName}...`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    console.log(`✓ Successfully downloaded: ${fileName}`);
  } catch (error) {
    console.error(`✗ Error downloading ${fileName}:`, error);
    process.exit(1);
  }
}

async function main() {
  console.log('Starting face-api models download...');
  for (const file of MODELS_TO_DOWNLOAD) {
    await downloadFile(file);
  }
  console.log('✓ All face-api models downloaded successfully!');
}

main();
