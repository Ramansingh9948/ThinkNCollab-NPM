import fs from "fs";
import path from "path";
import crypto from "crypto";

const VERSION_FILE = path.join(process.cwd(), ".tncversions");
const CWD = process.cwd();

/** ------------------ IGNORE HANDLING ------------------ **/
function loadIgnore(folderPath) {
  const ignoreFile = path.join(folderPath, ".ignoretnc");
  if (!fs.existsSync(ignoreFile)) return [];
  return fs
    .readFileSync(ignoreFile, "utf-8")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
}

function shouldIgnore(relativePath, ignoreList) {
  return ignoreList.some(pattern => {
    if (pattern.endsWith("/**")) {
      const folder = pattern.slice(0, -3);
      return relativePath === folder || relativePath.startsWith(folder + path.sep);
    }
    if (pattern.startsWith("*.")) {
      return relativePath.endsWith(pattern.slice(1));
    }
    return relativePath === pattern;
  });
}

/** ------------------ SCAN FOLDER ------------------ **/
function scanFolder(folderPath, ignoreList, rootPath = folderPath) {
  const items = fs.readdirSync(folderPath, { withFileTypes: true });
  const result = [];
  for (const item of items) {
    const fullPath = path.join(folderPath, item.name);
    const relativePath = path.relative(rootPath, fullPath);

    if (shouldIgnore(relativePath, ignoreList)) {
      continue;
    }

    if (item.isDirectory()) {
      result.push({
        name: item.name,
        type: "folder",
        children: scanFolder(fullPath, ignoreList, rootPath),
        path: relativePath
      });
    } else {
      const stats = fs.statSync(fullPath);
      result.push({
        name: item.name,
        type: "file",
        path: relativePath,
        size: stats.size
      });
    }
  }
  return result;
}

/** ------------------ VERSIONING ------------------ **/
function loadVersions() {
  if (!fs.existsSync(VERSION_FILE)) return {};
  const data = JSON.parse(fs.readFileSync(VERSION_FILE, "utf-8"));
  
  // Backward compatibility: if old format (just strings), convert to new format
  const converted = {};
  for (const [path, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      converted[path] = { hash: value, url: '', version: 1 };
    } else {
      converted[path] = value;
    }
  }
  return converted;
}

function computeFileHash(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      // For folders: hash of sorted file names + their hashes
      const items = fs.readdirSync(filePath).sort();
      const childrenHashes = items.map(name => 
        computeFileHash(path.join(filePath, name))
      ).filter(Boolean).join('|');
      
      return crypto.createHash("sha256")
        .update(`folder:${filePath}|${childrenHashes}`)
        .digest("hex");
    } else {
      // For files: hash of content + file metadata
      const content = fs.readFileSync(filePath);
      const stats = fs.statSync(filePath);
      
      return crypto.createHash("sha256")
        .update(content)
        .update(`size:${stats.size}|mtime:${stats.mtimeMs}`)
        .digest("hex");
    }
  } catch (err) {
    console.error(`❌ Error computing hash for ${filePath}:`, err.message);
    return null;
  }
}

function checkChanges(fileTree, versionMap, rootPath = CWD) {
  return fileTree.map(item => {
    const fullPath = path.join(rootPath, item.path || item.name);
    const relativePath = item.path || item.name;
    
    let hash = null;
    let changed = true;

    try {
      if (fs.existsSync(fullPath)) {
        hash = computeFileHash(fullPath);
        
        // Check against previous version
        const prevVersion = versionMap[relativePath];
        if (prevVersion && prevVersion.hash === hash) {
          changed = false;
        }
      }
    } catch (err) {
      console.error(`❌ Error checking changes for ${relativePath}:`, err.message);
    }

    const newItem = { 
      ...item, 
      changed, 
      hash,
      path: relativePath
    };

    // Recursively check children for folders
    if (item.type === "folder" && item.children && item.children.length > 0) {
      newItem.children = checkChanges(item.children, versionMap, rootPath);
      newItem.changed = newItem.changed || newItem.children.some(c => c.changed);
    }

    return newItem;
  });
}

/** ------------------ STATUS FUNCTION ------------------ **/
export default async function status() {
  try {
    const tncMetaPath = path.join(process.cwd(), ".tnc", ".tncmeta.json");
    if (!fs.existsSync(tncMetaPath)) {
      console.error("❌ Project not initialized. Run 'tnc init' first.");
      return;
    }

    const meta = JSON.parse(fs.readFileSync(tncMetaPath, "utf-8"));
    const projectId = meta.projectId;
    
    console.log("📊 TNC Project Status");
    console.log("=====================");
    console.log(`Project ID: ${projectId}`);
    console.log(`Directory: ${process.cwd()}`);
    console.log("");

    // Check if versions file exists
    if (!fs.existsSync(VERSION_FILE)) {
      console.log("📭 No previous versions found. Run 'tnc push' first.");
      return;
    }

    const previousVersions = loadVersions();
    const totalFiles = Object.keys(previousVersions).length;
    
    console.log(`📁 Total tracked files: ${totalFiles}`);
    console.log("");

    // Scan current directory for changes
    const ignoreList = loadIgnore(process.cwd());
    const currentContent = scanFolder(process.cwd(), ignoreList);
    const contentWithChanges = checkChanges(currentContent, previousVersions);

    // Analyze changes
    let changedCount = 0;
    let newCount = 0;
    let unchangedCount = 0;
    let ignoredCount = 0;

    const flattenAndAnalyze = (items) => {
      for (const item of items) {
        if (item.type === "file") {
          if (!previousVersions[item.path]) {
            newCount++;
          } else if (item.changed) {
            changedCount++;
          } else {
            unchangedCount++;
          }
        }
        if (item.children) {
          flattenAndAnalyze(item.children);
        }
      }
    };
    
    flattenAndAnalyze(contentWithChanges);

    console.log("🔄 Change Summary:");
    console.log(`  ✅ Unchanged files: ${unchangedCount}`);
    console.log(`  📝 Modified files: ${changedCount}`);
    console.log(`  🆕 New files: ${newCount}`);
    console.log("");

    // Show detailed changes
    if (changedCount > 0 || newCount > 0) {
      console.log("📋 Detailed Changes:");
      console.log("-------------------");
      
      const showChanges = (items, indent = "") => {
        for (const item of items) {
          if (item.type === "file") {
            if (!previousVersions[item.path]) {
              console.log(`${indent}🆕 ${item.path} (new)`);
            } else if (item.changed) {
              console.log(`${indent}📝 ${item.path} (modified)`);
            }
          } else if (item.type === "folder") {
            const hasFileChanges = item.children && item.children.some(child => 
              child.type === 'file' && (!previousVersions[child.path] || child.changed)
            );
            
            if (hasFileChanges) {
              console.log(`${indent}📁 ${item.path}/`);
              if (item.children) {
                showChanges(item.children, indent + "  ");
              }
            }
          }
        }
      };
      
      showChanges(contentWithChanges);
    } else {
      console.log("🎉 No changes detected. Everything is up to date!");
    }

    console.log("");
    
    // Show version info
    const versions = Object.values(previousVersions);
    if (versions.length > 0) {
      const maxVersion = Math.max(...versions.map(v => v.version || 1));
      console.log(`🏷️  Latest version: ${maxVersion}`);
      
      // Show file type breakdown
      const extensions = {};
      Object.keys(previousVersions).forEach(filePath => {
        const ext = path.extname(filePath) || 'no extension';
        extensions[ext] = (extensions[ext] || 0) + 1;
      });
      
      console.log("");
      console.log("📄 File Types:");
      Object.entries(extensions)
        .sort(([,a], [,b]) => b - a)
        .forEach(([ext, count]) => {
          console.log(`  ${ext || '(no ext)'}: ${count} files`);
        });
    }

    // Show last push info if available
    const versionFileStats = fs.statSync(VERSION_FILE);
    console.log("");
    console.log(`⏰ Last push: ${versionFileStats.mtime.toLocaleString()}`);

  } catch (err) {
    console.error("❌ Error checking status:", err.message);
  }
}

