import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import inquirer from 'inquirer';
import crypto from 'crypto';
import FormData from 'form-data';
import machine from 'node-machine-id';
const RC_FILE = path.join(os.homedir(), '.tncrc');
const VERSION_FILE = path.join(process.cwd(), '.tncversions');
const BASE_URL = 'http://localhost:3001/rooms';
const CWD = process.cwd();
/** ------------------ READ TOKEN ------------------ **/

function readToken() {
  if (!fs.existsSync(RC_FILE)) {
    console.error("❌ Not logged in. Run 'tnc login' first.");
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(RC_FILE));
  return { token: data.token, email: data.email };
}

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
      console.log("⚠️ Ignored:", relativePath);
      continue;
    }

    if (item.isDirectory()) {
      result.push({
        name: item.name,
        type: "folder",
        children: scanFolder(fullPath, ignoreList, rootPath),
        path: item.name
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

function saveVersions(versionMap) {
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionMap, null, 2));
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
      console.error(` Error checking changes for ${relativePath}:`, err.message);
    }

    const newItem = {
      ...item,
      changed,
      hash,
      path: relativePath // Ensure consistent path
    };

    // Recursively check children for folders
    if (item.type === "folder" && item.children && item.children.length > 0) {
      newItem.children = checkChanges(item.children, versionMap, rootPath);
      newItem.changed = newItem.changed || newItem.children.some(c => c.changed);
    }

    return newItem;
  });
}

/** ------------------ MERGE CONFLICT HANDLING ------------------ **/
async function checkMergeConflicts(roomId, branch, localFiles) {
  try {
    console.log('🔍 Checking for merge conflicts...');


    const cloudFiles = await getCloudFiles(roomId, branch);
    const conflicts = [];

    for (const localFile of localFiles) {
      const cloudFile = cloudFiles.find(f => f.path === localFile.path);

      if (cloudFile && localFile.hash !== cloudFile.hash) {

        conflicts.push({
          file: localFile.path,
          message: `File changed by another user in cloud`
        });
      }
    }

    return conflicts;
  } catch (error) {
    console.log(' Could not check conflicts:', error.message);
    return [];
  }
}

async function getCloudFiles(roomId, branch) {

  const { token, email } = readToken();

  try {
    const response = await axios.get(
      `${BASE_URL}/${roomId}/files`,
      {
        params: { branch },
        headers: { authorization: `Bearer ${token}`, email }
      }
    );
    return response.data.files || [];
  } catch (error) {
    console.log('❌ Could not fetch cloud files:', error.message);
    return [];
  }
}

async function handleConflicts(conflicts) {
  if (conflicts.length === 0) return true;

  console.log('\n MERGE CONFLICTS DETECTED:');
  conflicts.forEach(conflict => {
    console.log(`📄 ${conflict.file} - ${conflict.message}`);
  });

  console.log('\n✅ Auto-resolving: Using your local version for all conflicts');
  console.log('💡 Note: Other users\' changes will be overwritten');

  return true;
}

/** ------------------ CLOUDINARY UPLOAD ------------------ **/
async function uploadFileSigned(filePath, folder, roomId, token, email) {
  const filename = path.basename(filePath);

  const sigRes = await axios.post(
    `${BASE_URL}/${roomId}/get-upload-signature`,
    { filename, folder, roomId },
    { headers: { authorization: `Bearer ${token}`, email } }
  );

  const { signature, timestamp, api_key, cloud_name } = sigRes.data;

  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));
  formData.append("folder", folder);
  formData.append("public_id", filename);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("api_key", api_key);

  const cloudRes = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`,
    formData,
    { headers: formData.getHeaders() }
  );

  return cloudRes.data.secure_url;
}

/** ------------------ UPLOAD TREE - FIXED PATH CONSTRUCTION ------------------ **/
async function uploadTree(fileTree, folderHex, roomId, token, email, previousVersions, parentPath = "") {
  const uploaded = [];

  for (const node of fileTree) {

    let relativePath;
    if (parentPath) {
      relativePath = path.join(parentPath, node.name).replace(/\\/g, "/");
    } else {
      relativePath = node.path || node.name;
    }

    if (node.type === "folder") {
      const children = await uploadTree(node.children, folderHex, roomId, token, email, previousVersions, relativePath);

      uploaded.push({
        ...node,
        children,
        hash: node.hash,
        path: relativePath
      });
    } else {
      const prevFile = previousVersions[relativePath];

      if (node.changed) {
        try {
          console.log(` Uploading changed file: ${relativePath}`);
          const url = await uploadFileSigned(path.join(CWD, node.path), `tnc_uploads/${folderHex}`, roomId, token, email);
          console.log(` Uploaded: ${relativePath}`);

          uploaded.push({
            ...node,
            url,
            hash: node.hash,
            path: relativePath,
            version: prevFile ? prevFile.version + 1 : 1
          });
        } catch (err) {
          console.error(` Failed to upload ${relativePath}:`, err.message);

          uploaded.push({
            ...node,
            url: prevFile?.url,
            hash: node.hash,
            path: relativePath,
            version: prevFile?.version || 1
          });
        }
      } else {

        console.log(` Using previous version for: ${relativePath}`);
        uploaded.push({
          ...node,
          url: prevFile?.url,
          hash: node.hash,
          path: relativePath,
          version: prevFile?.version || 1
        });
      }
    }
  }

  return uploaded;
}

/** ------------------ PUSH FUNCTION WITH MERGE CONFLICT CHECK ------------------ **/
async function push(roomId, targetPath) {
  const { token, email } = readToken();
  const tncMetaPath = path.join(process.cwd(), ".tnc", ".tncmeta.json");
  if (!fs.existsSync(tncMetaPath)) {
    console.error(" Project not initialized. Run 'tnc-cli init' first.");
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(tncMetaPath, "utf-8"));
  const projectId = meta.projectId;
  const branch = meta.branch;
  const branchId = meta.branchId;
  const tncPushInfo = path.join(process.cwd(), ".tnc", ".tncpush.json");

  const lastFolderId = JSON.parse(fs.readFileSync(tncPushInfo, "utf-8")).folderId;
  const stats = fs.statSync(targetPath);
  const rootFolder = stats.isDirectory() ? targetPath : path.dirname(targetPath);
  const ignoreList = loadIgnore(rootFolder);
  let content;
  if (stats.isDirectory()) {
    content = scanFolder(targetPath, ignoreList);
  } else {
    const relativePath = path.basename(targetPath);
    content = shouldIgnore(relativePath, ignoreList)
      ? []
      : [{ name: relativePath, type: "file", path: relativePath, size: stats.size }];
  }
  if (!content.length) {
    console.log(" Nothing to upload (all ignored).");
    return;
  }
  const previousVersions = loadVersions();
  console.log(' Previous versions:', Object.keys(previousVersions).length);

  const contentWithChanges = checkChanges(content, previousVersions);


  const changedFiles = contentWithChanges.flatMap(item =>
    item.changed ? [item.path] : []
  );
  console.log('Changed files:', changedFiles.length, changedFiles);

  const hasChanges = contentWithChanges.some(item => item.changed || (item.children && item.children.some(c => c.changed)));

  if (!hasChanges) {
    console.log(" No changes detected since last push.");
    return;
  }


  const localFiles = getLocalFilesList(contentWithChanges);
  const conflicts = await checkMergeConflicts(roomId, branch, localFiles);

  if (conflicts.length > 0) {
    const shouldContinue = await handleConflicts(conflicts);
    if (!shouldContinue) {
      console.error('Push cancelled due to conflicts');
      return;
    }
  }

  try {
    const folderHex = crypto.createHash("md5").update(path.basename(targetPath) + Date.now()).digest("hex");
    console.log(" Uploading to Cloudinary...");
    const uploadedTree = await uploadTree(contentWithChanges, folderHex, roomId, token, email, previousVersions);
    console.log(" Sending metadata...");
    const res = await axios.post(
      `${BASE_URL}/${roomId}/upload`,
      { folderId: folderHex, content: uploadedTree, uploadedBy: email, projectId, latestFolderId: lastFolderId, branch: branch, branchId: branchId },
      { headers: { authorization: `Bearer ${token}`, email } }
    );
    console.log(" Upload complete! Metadata stored successfully.");
    const newVersionMap = {};
    const flattenAndStore = (items) => {
      for (const item of items) {
        if (item.type === "file") {
          newVersionMap[item.path] = {
            hash: item.hash,
            url: item.url,
            version: item.version || 1
          };
        }
        if (item.children) flattenAndStore(item.children);
      }
    };
    flattenAndStore(uploadedTree);
    saveVersions(newVersionMap);

    const versionNumbers = Object.values(newVersionMap).map(f => f.version || 1);
    const latestVersion = versionNumbers.length > 0 ? Math.max(...versionNumbers) : 1;
    const newPushRecord = {
      version: latestVersion,
      pushedAt: new Date().toISOString(),
      roomId: roomId,
      pushedBy: email,
      projectId: projectId,
      folderId: res.data.folderId,
      branch: res.data.branch,
      branchId: res.data.branchId
    };

    const pushFilePath = path.join(CWD, ".tnc", ".tncpush.json");
    fs.writeFileSync(
      pushFilePath,
      JSON.stringify(newPushRecord, null, 2)
    );

    console.log(` Saved ${Object.keys(newVersionMap).length} files to .tncversions`);

  } catch (err) {
    console.error(" Upload failed:", err.response?.data || err.message);
  }
}

function getLocalFilesList(contentWithChanges) {
  const files = [];

  function extractFiles(items) {
    for (const item of items) {
      if (item.type === "file") {
        files.push({
          path: item.path,
          hash: item.hash,
          content: fs.readFileSync(path.join(CWD, item.path), 'utf-8')
        });
      }
      if (item.children) {
        extractFiles(item.children);
      }
    }
  }

  extractFiles(contentWithChanges);
  return files;
}

export default push;