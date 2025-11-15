#!/usr/bin/env node
import fs from "fs";
import path from "path";
import axios from "axios";
import https from "https";
import http from "http";
import os from "os";
import chalk from "chalk";

const RC_FILE = path.join(os.homedir(), ".tncrc");

/** ------------------ TOKEN UTILS ------------------ **/
function readToken() {
  if (!fs.existsSync(RC_FILE)) {
    console.error(chalk.red("❌ Not logged in. Run 'tnc login' first."));
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(RC_FILE));
  return { token: data.token, email: data.email };
}

/** ------------------ DOWNLOAD FILE ------------------ **/ 
async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) fs.mkdirSync(fileDir, { recursive: true });
    const file = fs.createWriteStream(filePath);
    const client = url.startsWith("https") ? https : http;

    client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve(filePath);
        });
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });
}

/**------------------PROCESS FOLDER CONTENT------------------**/
async function processFolderContent(content, basePath = "") {
  let downloadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of content) {
    // Skip folders entirely - only process files
    if (item.type === "folder" && item.children) {
      const result = await processFolderContent(item.children, basePath);
      downloadedCount += result.downloadedCount;
      skippedCount += result.skippedCount;
      errorCount += result.errorCount;
      continue;
    }

    // Only process files
    if (item.type === "file" && item.url) {
      const itemPath = path.join(basePath, item.path);

      // Skip .tnc files
      if (itemPath.includes('.tnc')) {
        skippedCount++;
        continue;
      }

      try {
        if (fs.existsSync(itemPath)) {
          const existingStats = fs.statSync(itemPath);
          if (existingStats.size === item.size) {
            console.log(chalk.gray(`✅ Already exists: ${itemPath}`));
            skippedCount++;
            continue;
          }
        }

        console.log(chalk.yellow(`📥 Downloading: ${itemPath}`));
        await downloadFile(item.url, itemPath);
        console.log(chalk.green(`✅ Downloaded: ${itemPath}`));
        downloadedCount++;
      } catch (err) {
        console.error(chalk.red(`❌ Failed to download ${itemPath}: ${err.message}`));
        errorCount++;
      }
    }
  }

  return { downloadedCount, skippedCount, errorCount };
}

/** ------------------ PULL FUNCTION ------------------ **/
export default async function pull(roomId, version = "latest") {
  try {
    const { token, email } = readToken();
    const tncMetaPath = path.join(process.cwd(), ".tnc", ".tncmeta.json");

    if (!fs.existsSync(tncMetaPath)) {
      console.error(chalk.red("❌ Project not initialized. Run 'tnc init' first."));
      return;
    }

    const meta = JSON.parse(fs.readFileSync(tncMetaPath, "utf-8"));
    const projectId = meta.projectId;

    console.log(chalk.blue(`\n🚀 Pulling files from room ${roomId}...`));
    console.log(`📋 Project: ${projectId}`);
    console.log(`🎯 Version: ${version}\n`);

    let url = `https://thinkncollab.com/folders/${roomId}/download`;
    const params = { projectId };

    if (version !== "latest") {
      const versionNum = parseInt(version);
      if (isNaN(versionNum)) {
        console.error(chalk.red("❌ Version must be a number"));
        return;
      }
      params.version = versionNum;
    }

    console.log(chalk.gray("🔍 Making API request with:"), { roomId, projectId, version });
    console.log(chalk.gray("🌐 API URL:"), url);

    const response = await axios.get(url, {
      params,
      headers: { authorization: `Bearer ${token}`, email },
    });

    console.log(chalk.green("✅ API Response received"));
    const folderData = response.data;

    if (!folderData) {
      console.log(chalk.red("❌ No data found in response"));
      return;
    }

    const rootContent = folderData.rootContent || folderData.content || folderData;
    const folderVersion = folderData.version || 1;

    if (!rootContent || !Array.isArray(rootContent)) {
      console.log(chalk.red("❌ No valid content found in response"));
      console.log("📋 Response structure:", Object.keys(folderData));
      return;
    }

    console.log(chalk.cyan(`📦 Found version ${folderVersion} with ${rootContent.length} items\n`));

    // Backup versions file
    const versionsFile = path.join(process.cwd(), ".tncversions");
    const backupPath = path.join(process.cwd(), `.tncversions.backup`);
    if (fs.existsSync(versionsFile) && !fs.existsSync(backupPath)) {
      fs.copyFileSync(versionsFile, backupPath);
      console.log(chalk.gray(`💾 Backup created: ${path.basename(backupPath)}`));
    }

    // Download files
    const result = await processFolderContent(rootContent, process.cwd());

    console.log("\n" + "=".repeat(35));
    console.log(chalk.bold("\n📊 Download Summary"));
    console.log("=".repeat(35));
    console.log(`✅ Downloaded: ${result.downloadedCount} files`);
    console.log(`📋 Skipped: ${result.skippedCount} files`);
    console.log(`❌ Errors: ${result.errorCount} files`);

    if (result.errorCount > 0) {
      console.log(chalk.yellow("\n⚠️  Some files failed to download. Check above logs."));
    }

    // Update .tncversions
    const newVersionMap = {};
    const flattenContent = (items) => {
      for (const item of items) {
        if (item.type === "file") {
          newVersionMap[item.path] = {
            hash: item.contentHash || item.hash || "",
            url: item.url || null,
            version: item.version || 1,
            size: item.size || 0,
          };
        }
        if (item.children) flattenContent(item.children);
      }
    };

    flattenContent(rootContent);
    fs.writeFileSync(versionsFile, JSON.stringify(newVersionMap, null, 2));

    console.log("");
    console.log(chalk.green(`💾 Updated local versions file with ${Object.keys(newVersionMap).length} files`));
    console.log(chalk.bold.green(`🎉 Pull completed successfully!\n`));
  } catch (err) {
    console.error(chalk.red(`❌ Pull failed: ${err.message}`));

    if (err.response) {
      console.error(chalk.red(`📡 Server status: ${err.response.status}`));
      const msg =
        typeof err.response.data === "object"
          ? err.response.data.message || JSON.stringify(err.response.data)
          : err.response.data;
      console.error(chalk.red("📡 Server message:"), msg);
    } else if (err.request) {
      console.error(chalk.yellow("🌐 No response from server — check backend (localhost:3001)."));
    } else {
      console.error(chalk.red("🔧 Configuration error:"), err.message);
    }
  }
}
