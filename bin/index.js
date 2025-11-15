#!/usr/bin/env node
import inquirer from "inquirer";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import FormData from "form-data";
import projectInit from "../commands/init.js";
import Status from "../commands/status.js";
import pull from "../commands/pull.js";
import whoami from "../commands/whoami.js";
import help from "../commands/help.js";
import version from "../commands/version.js";
import createBranch from "../commands/branch.js"
import myTask from "../commands/myTask.js"
import sendInvite from '../commands/sendInvite.js'
import connect from '../commands/connect.js'
import machine from  "node-machine-id";



const RC_FILE = path.join(os.homedir(), ".tncrc");
const VERSION_FILE = path.join(process.cwd(), ".tncversions");
const BASE_URL = "http://localhost:3001/rooms";
const CWD = process.cwd();

/** ------------------ LOGIN ------------------ **/
async function login() {
  const answers = await inquirer.prompt([
    { type: "input", name: "email", message: "Email:" },
    { type: "password", name: "password", message: "Password:" }

  ]);

  try {
    console.log("🔐 Logging in...");
    const res = await axios.post("http://localhost:3001/login", {
      email: answers.email,
      password: answers.password,
      machineId: await machine.machineIdSync()
    });

    const { token, email } = res.data;
    fs.writeFileSync(RC_FILE, JSON.stringify({ token, email }, null, 2));
    console.log(`✅ Login successful! Token saved to ${RC_FILE}`);
  } catch (err) {
    console.error("❌ Login failed:", err.response?.data?.message || err.message);
  }
}

/** ------------------ LOGOUT ------------------ **/
async function logout() {
  try {
    if (fs.existsSync(RC_FILE)) {
      await fs.promises.rm(RC_FILE, { force: true });
      console.log("✅ Logged out successfully. Local credentials removed.");
    } else {
      console.log("ℹ️ No active session found.");
    }
  } catch (err) {
    console.error("❌ Error during logout:", err.message);
  }
}

/** ------------------ TOKEN UTILS ------------------ **/
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

/** ------------------ SCAN FOLDER - FIXED ------------------ **/
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
        children: scanFolder(fullPath, ignoreList, rootPath), // ✅ Keep same rootPath
        path: item.name // ✅ Only store folder name, not full path
      });
    } else {
      const stats = fs.statSync(fullPath);
      result.push({
        name: item.name,
        type: "file",
        path: relativePath, // ✅ Keep relative path for files
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
      console.error(`❌ Error checking changes for ${relativePath}:`, err.message);
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
    // ✅ FIXED: Correct path construction without duplication
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
          console.log(`📤 Uploading changed file: ${relativePath}`);
          const url = await uploadFileSigned(path.join(CWD, node.path), `tnc_uploads/${folderHex}`, roomId, token, email);
          console.log(`✅ Uploaded: ${relativePath}`);

          uploaded.push({
            ...node,
            url,
            hash: node.hash,
            path: relativePath,
            version: prevFile ? prevFile.version + 1 : 1
          });
        } catch (err) {
          console.error(`❌ Failed to upload ${relativePath}:`, err.message);
          // Fallback to previous version if upload fails
          uploaded.push({
            ...node,
            url: prevFile?.url,
            hash: node.hash,
            path: relativePath,
            version: prevFile?.version || 1
          });
        }
      } else {
        // Unchanged file - use previous URL and version
        console.log(`📋 Using previous version for: ${relativePath}`);
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

/** ------------------ PUSH FUNCTION ------------------ **/
async function push(roomId, targetPath) {
  const { token, email } = readToken();
  const tncMetaPath = path.join(process.cwd(), ".tnc", ".tncmeta.json");
  if (!fs.existsSync(tncMetaPath)) {
    console.error("❌ Project not initialized. Run 'tnc init' first.");
    process.exit(1);
  }
  const meta = JSON.parse(fs.readFileSync(tncMetaPath, "utf-8"));
  const projectId = meta.projectId;


   const tncPushInfo = path.join(process.cwd(), ".tnc", ".tncpush.json");
  if (!fs.existsSync(tncMetaPath)) {
    console.error("❌ Project not initialized. Run 'tnc init' first.");
    process.exit(1);
  }
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
    console.log("⚠️ Nothing to upload (all ignored).");
    return;
  }

  const previousVersions = loadVersions();
  console.log('📁 Previous versions:', Object.keys(previousVersions).length);

  const contentWithChanges = checkChanges(content, previousVersions);

  // Debug: Show what changed
  const changedFiles = contentWithChanges.flatMap(item =>
    item.changed ? [item.path] : []
  );
  console.log('🔄 Changed files:', changedFiles.length, changedFiles);

  const hasChanges = contentWithChanges.some(item => item.changed || (item.children && item.children.some(c => c.changed)));

  if (!hasChanges) {
    console.log("ℹ️ No changes detected since last push.");
    return;
  }

  try {
    const folderHex = crypto.createHash("md5").update(path.basename(targetPath) + Date.now()).digest("hex");

    console.log("🚀 Uploading to Cloudinary...");
    const uploadedTree = await uploadTree(contentWithChanges, folderHex, roomId, token, email, previousVersions);

    console.log("🗂️ Sending metadata...");
     const res = await axios.post(
      `${BASE_URL}/${roomId}/upload`,
      { folderId: folderHex, content: uploadedTree, uploadedBy: email, projectId, latestFolderId: lastFolderId},
      { headers: { authorization: `Bearer ${token}`, email } }
    );

    console.log("✅ Upload complete! Metadata stored successfully.");

    // Save version hashes WITH URLs
    const newVersionMap = {};
    const flattenAndStore = (items) => {
      for (const item of items) {
        if (item.type === "file") {
          newVersionMap[item.path] = {
            hash: item.hash,
            url: item.url, // ✅ Store URL locally
            version: item.version || 1
          };
        }
        if (item.children) flattenAndStore(item.children);
      }
    };
    flattenAndStore(uploadedTree);
    saveVersions(newVersionMap);

    // Determine latest version number from uploaded files
    const versionNumbers = Object.values(newVersionMap).map(f => f.version || 1);
    const latestVersion = versionNumbers.length > 0 ? Math.max(...versionNumbers) : 1;

    const newPushRecord = {
        version: latestVersion,
        pushedAt: new Date().toISOString(),
        roomId: roomId,
        pushedBy: email,
        projectId: projectId,
        folderId: res.data.folderId
    };



    const pushFilePath = path.join(CWD, ".tnc", ".tncpush.json");
    fs.writeFileSync(
      pushFilePath,
      JSON.stringify(newPushRecord, null, 2)
    );

    console.log(`💾 Saved ${Object.keys(newVersionMap).length} files to .tncversions`);

  } catch (err) {
    console.error("❌ Upload failed:", err.response?.data || err.message);
  }
}

/** ------------------ CLI HANDLER ------------------ **/
async function main() {
  const args = process.argv.slice(2);

  switch (args[0]) {
    case "login":
      await login();
      break;

    case "logout":
      await logout();
      break;

    case "push": {
      const roomIndex = args.indexOf("--room");
      if (roomIndex === -1 || !args[roomIndex + 1] || !args[roomIndex + 1]) {
        console.error("Usage: tnc push --room <roomId> <file-or-folder-path>");
        process.exit(1);
      }
      const roomId = args[roomIndex + 1];
      const targetPath = args[roomIndex + 3];
      await push(roomId, targetPath);
      break;
    }
    case "status":
      await Status();
      break;

    case "init":
      const roomIndex = args.indexOf("init");
      const roomid = args[roomIndex + 1];
      if (!roomid) console.log("Usage: tnc-cli init --room <roomId>");
      await projectInit(roomid);
      break;
    
 case "create":
  const roomIdx = args.indexOf("--room");
  if (roomIdx === -1 || !args[roomIdx + 1]) {
    console.log("Usage: tnc-cli create --room <roomId>");
    console.log("Example: tnc-cli create --room 507f1f77bcf86cd799439011");
    process.exit(1);
  }
  
  const roomId = args[roomIdx + 1];
  
  // Basic roomId validation (MongoDB ObjectId format)
  if (!/^[0-9a-fA-F]{24}$/.test(roomId)) {
    console.log("❌ Error: Invalid room ID format");
    process.exit(1);
  }

  await createBranch(roomId);
  break;

  case "connect": {
    const idx = args.indexOf("connect");
    const link = args[idx+1];

    await connect(link);
    break;

    

  }

    case "pull": {
      const roomIndex = args.indexOf("--room");
      if (roomIndex === -1 || !args[roomIndex + 1]) {
        console.error("Usage: tnc pull --room <roomId> [--version <version>]");
        process.exit(1);
      }

      const roomId = args[roomIndex + 1];
      let version = "latest";

      // Check for --version flag
      const versionIndex = args.indexOf("--version");
      if (versionIndex !== -1 && args[versionIndex + 1]) {
        version = args[versionIndex + 1];
      }

      await pull(roomId, version);
      break;
    }

    case "whoami":
      await whoami();
      break;

    case "help":
      await help();
      break;

    case "version":
      await version();
      break;

case "my-tasks": {
  const roomIdx = args.indexOf("my-tasks");
  const roomId = args[roomIdx + 1]; // fixed typo

  await myTask(roomId); 
  break;
}
case "invite": {
  const roomIdx = args.indexOf("invite");
  const email = args[roomIdx + 1]; // fixed typo

  await sendInvite(email); 
  break;
}

    default:
      console.log("✅ TNC CLI ready!");
      console.log("Commands:");
      console.log("  tnc-cli login");
      console.log("  tnc-cli init");
      console.log("  tnc-cli push --room <roomId> <path>");
      console.log("  tnc-cli create"); //creating a branch
      console.log("  tnc-cli pull --room <roomId>");
      console.log("  tnc-cli sync branch --room <roomId>");
      console.log("  tnc-cli merge <roomId>")
      console.log("  tnc-cli status");
      console.log("  tnc-cli whoami");
      console.log("  tnc-cli my-tasks <roomId>");
      console.log("  tnc-cli logout");
      console.log("  tnc-cli help");
      console.log("  tnc-cli version");
      
    }
}

main().catch(err => console.error(err));