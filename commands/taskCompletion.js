import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import machine from 'node-machine-id';
import inquirer from "inquirer";



const CWD = process.cwd();

const tncrcPath = path.join(os.homedir(), '.tncrc');
const tncMetaPath = path.join(CWD, '.tnc', '.tncmeta.json');

async function taskCompletion() {
  try {
    if (!fs.existsSync(tncrcPath)) {
      console.error("❌ You are not logged in. Run 'tnc login' first.");
      process.exit(1);
    }

    if (!fs.existsSync(tncMetaPath)) {
      console.error("❌ This directory is not initialized. Run 'tnc init' first.");
      process.exit(1);
    }

    const tncrcData = fs.readFileSync(tncrcPath, "utf-8");
    const { email, token } = JSON.parse(tncrcData);

    const tncMetaData = fs.readFileSync(tncMetaPath, "utf-8");
    const { projectId } = JSON.parse(tncMetaData);

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

    const response = await axios.post(
      `https://thinkncollab.com/cli/taskcomplete/${trimmedTaskId}`,
      {
        email,
        token,
        machineId: machine.machineIdSync(),
      }
    );

    console.log("✅ Task marked as complete:", response.data.message);
  } catch (err) {
    if (err.response) {
      console.error("❌ Error:", err.response.data.error);
    } else {
      console.error("❌ An unexpected error occurred:", err.message);
    }
    process.exit(1);
  }
}
export default taskCompletion;