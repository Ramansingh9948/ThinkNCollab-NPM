import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import machine from 'node-machine-id';
import inquirer from "inquirer";











const CWD = process.cwd();
const BASE_URL = "https://thinkncollab.com/cli"; 
const tncrcPath = path.join(os.homedir(), '.tncrc');
const tncMetaPath = path.join(CWD, '.tnc', '.tncmeta.json');
async function taskCompletion() {
  try {
    // Check login status
    if (!fs.existsSync(tncrcPath)) {
      console.error("❌ You are not logged in. Run 'tnc login' first.");
      process.exit(1);
    }

    // Check project initialization
    if (!fs.existsSync(tncMetaPath)) {
      console.error("❌ This directory is not initialized. Run 'tnc init' first.");
      process.exit(1);
    }

    // Read credentials
    const tncrcData = fs.readFileSync(tncrcPath, "utf-8");
    const { email, token } = JSON.parse(tncrcData);
    const machineId = machine.machineIdSync();

    // Read project metadata
    const tncMetaData = fs.readFileSync(tncMetaPath, "utf-8");
    const { projectId, projectName } = JSON.parse(tncMetaData);

    // Get task ID from user
    const { taskId } = await inquirer.prompt([
      {
        type: "input",
        name: "taskId",
        message: "Enter Task ID to mark as complete:",
      },
    ]);

    const trimmedTaskId = taskId.trim();

    if (!trimmedTaskId) {
      console.error("❌ Task ID cannot be empty.");
      process.exit(1);
    }

    console.log(`📋 Marking task ${trimmedTaskId} as completed...`);

    // USING HEADERS FOR AUTHENTICATION
    const response = await axios({
      method: 'post',
      url: `${BASE_URL}/taskcomplete/${trimmedTaskId}`,
      headers: {
        'x-user-email': email,
        'x-user-token': token,
        'x-machine-id': machineId,
        'x-project-id': projectId // Optional: send project context
      }
      // NO REQUEST BODY - all auth in headers
    });

    console.log("✅", response.data.message);
    
    // Optional: Update local metadata if needed
    console.log(`📌 Project: ${projectName}`);
    console.log(`🔗 Task ID: ${trimmedTaskId}`);

  } catch (err) {
    if (err.response) {
      console.error("❌ Error:", err.response.data.message || err.response.data.error);
      if (err.response.status === 401) {
        console.error("   Please login again - invalid or expired token.");
      } else if (err.response.status === 404) {
        console.error("   Task not found. Please check the Task ID.");
      }
    } else if (err.request) {
      console.error("❌ No response from server. Check your internet connection.");
    } else {
      console.error("❌ An unexpected error occurred:", err.message);
    }
    process.exit(1);
  }
}

export default taskCompletion;