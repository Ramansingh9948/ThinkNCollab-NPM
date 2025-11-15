import { scanDirectory } from "./scanner.js";
import { uploadFile } from "./uploader.js";
import path from "path";
import fs from "fs";

export async function pushToRoom(roomId) {
  const currentDir = process.cwd();
  console.log(`📂 Scanning directory: ${currentDir}`);

  const files = scanDirectory(currentDir);

  const uploadedFiles = [];
  for (let file of files) {
    const url = await uploadFile(file);
    uploadedFiles.push({
      name: file.name,
      path: file.path,
      size: file.size,
      url,
    });
  }

  // Instead of real backend, save JSON locally for now
  const outputPath = path.join(currentDir, `tnc_snapshot_${roomId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(uploadedFiles, null, 2));

  console.log(`✅ Snapshot saved at ${outputPath}`);
}
