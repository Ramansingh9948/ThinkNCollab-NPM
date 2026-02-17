import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";
import machine from "node-machine-id";
import CliTable3 from "cli-table3";
import chalk from "chalk";

const homeDir = os.homedir();
const url = "https://thinkncollab.com/cli/mytasks";

// -----------------------------
// Read ~/.tncrc
// -----------------------------
function getAuthData() {
  const rcFile = path.join(homeDir, ".tncrc");

  if (!fs.existsSync(rcFile)) {
    console.log(chalk.red("⚠️ Please login first!"));
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(rcFile, "utf-8"));
}

// -----------------------------
// Main Function
// -----------------------------
async function myTask() {
  try {
    const { email, token } = getAuthData();

    const CWD = process.cwd();
    const metaDataPath = path.join(CWD, ".tnc", ".tncmeta.json");

    if (!fs.existsSync(metaDataPath)) {
      console.log(chalk.yellow("⚠️ Room metadata not found in current directory!"));
      return;
    }

    const metaData = JSON.parse(fs.readFileSync(metaDataPath, "utf-8"));
    const roomId = metaData.roomId;

    const cacheDir = path.join(CWD, ".tnc");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

    const cacheFile = path.join(cacheDir, "tasks.json");

    let tasks = [];

    try {
      const res = await axios.get(`${url}/${roomId}`, {
        params: {
          email,
          token,
          machineId: machine.machineIdSync()
        }
      });

      tasks = res.data.tasks || [];

      fs.writeFileSync(cacheFile, JSON.stringify(tasks, null, 2));

    } catch (error) {
      if (fs.existsSync(cacheFile)) {
        console.log(chalk.yellow("⚠️ Offline mode: showing cached tasks"));
        tasks = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      } else {
        console.error(
          chalk.red("❌ Error fetching tasks and no cache available:"),
          error.response?.data || error.message
        );
        return;
      }
    }

    if (!tasks.length) {
      console.log(chalk.gray("📭 No tasks assigned."));
      return;
    }

    // -----------------------------
    // Create Table
    // -----------------------------
const table = new CliTable3({
  head: [
    chalk.cyan.bold("Title"),
    chalk.green.bold("Status"),
    chalk.magenta.bold("Category"),
    chalk.red.bold("Priority"),
    chalk.yellow.bold("ID"),
    chalk.blue.bold("Att.")
  ],
  colWidths: [30, 12, 18, 10, 26, 6], // adjusted
  wordWrap: true,
  style: {
    head: [],
    border: ["grey"]
  }
});


    console.log(chalk.bold.cyan("\n📋 YOUR TASKS\n"));

    tasks.forEach(task => {

      // Status color
      let statusColor =
        task.status === "completed"
          ? chalk.green
          : task.status === "in-progress"
          ? chalk.yellow
          : chalk.red;

      // Priority color
      let priorityColor =
        task.priority === "high"
          ? chalk.red
          : task.priority === "medium"
          ? chalk.yellow
          : chalk.green;

      table.push([
        chalk.white(task.title),
        statusColor(task.status),
        chalk.magenta(task.category || "General"),
        priorityColor(task.priority || "low"),
        chalk.gray(task._id),
        chalk.blue(task.attachments?.length || 0)
      ]);
    });

    console.log(table.toString());

  } catch (error) {
    console.error(chalk.red("❌ Error:"), error.message);
  }
}

export default myTask;
