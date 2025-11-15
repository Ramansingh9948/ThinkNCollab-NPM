import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";
import inquirer from "inquirer";
import getUserInfo from "../lib/getVerify.js";


async function updateBranch(branchName, branchId) {
  const currentDir = process.cwd();
  const tncFolder = path.join(currentDir, ".tnc");
  const tncmetaFile = path.join(tncFolder, ".tncmeta.json");

  // Ensure .tnc folder exists
  if (!fs.existsSync(tncFolder)) {
    fs.mkdirSync(tncFolder, { recursive: true });
  }

  let meta = {};

  // Read existing meta if exists
  if (fs.existsSync(tncmetaFile)) {
    try {
      const data = fs.readFileSync(tncmetaFile, "utf-8");
      meta = JSON.parse(data);
    } catch {
      console.warn("⚠️ Warning: Corrupted .tncmeta.json, creating a new one.");
      meta = {};
    }
  }

  // Update the current branch
  meta.branch = branchName;
  Object.assign(meta, {branchId: `${branchId}`});

  // Write updated data
  fs.writeFileSync(tncmetaFile, JSON.stringify(meta, null, 2), "utf-8");

  console.log(`🌿 Switched to branch '${branchName}'`);
}

// Creates a new branch for a room
async function createBranch(roomId) {
  try {
    const { branchName } = await inquirer.prompt([
      {
        type: "input",
        name: "branchName",
        message: "Enter the new branch name:",
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return "Branch name cannot be empty";
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(input.trim())) {
            return "Branch name can only contain letters, numbers, hyphens, and underscores";
          }
          return true;
        },
      },
    ]);

   const userInfo = await getUserInfo();   // FIXED

if (!userInfo) {
  throw new Error("User info could not be loaded. Please login first.");
}

const email = userInfo.email;
const token = userInfo.token;

if (!email || !token) {
  throw new Error("User email or token missing. Please login again.");
}

console.log(email, token);


    const res = await axios.post("http://localhost:3001/cli/createBranch", {
      branchName: branchName.trim(),
      roomId : roomId,
      email: email,
      token:token
    });

const {
  success,
  message,
  branch: { id, name, roomId: branchRoomId, headVersionId } = {},
} = res.data;


    if (res.data.success) {
      console.log(`✅ Branch '${branchName}' created successfully!`);
      await updateBranch(branchName, id);
    } else {
      console.log(`❌ Failed to create branch: ${res.data.message}`);
    }
  } catch (error) {
    if (error.response?.data?.message) {
      console.error(`❌ Error: ${error.response.data.message}`);
    } else if (error.message) {
      console.error(`❌ Error: ${error.message}`);
    } else {
      console.error("❌ An unexpected error occurred");
    }
    process.exit(1);
  }
}

export default createBranch;