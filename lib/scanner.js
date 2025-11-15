import fs from "fs";
import path from "path";

export function scanDirectory(dirPath) {
  const result = [];

  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (let file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        result.push({
          name: file,
          path: fullPath,
          size: stat.size,
        });
      }
    }
  }

  walk(dirPath);
  return result;
}
