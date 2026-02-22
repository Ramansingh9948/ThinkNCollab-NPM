import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";
import machine from "node-machine-id";
import CliTable3 from "cli-table3";
import chalk from "chalk";

const homeDir = os.homedir();
const url = "http://localhost:3001/cli/mytasks";

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
// Main Function - with limit parameter
// -----------------------------
async function myTask(limit = 5) {
  try {
    const { email, token } = getAuthData();
    const machineId = machine.machineIdSync();
    
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

    let userTasks = [];
    let recommendations = [];

    try {
      console.log(chalk.blue("🔄 Fetching from server..."));
      
      // FIX: Headers me bhejo - safe!
      const res = await axios.get(`${url}/${roomId}`, {
        params: {
          n: limit,  // sirf n query me
          format: 'json'
        },
        headers: {
          'x-user-email': email,
          'x-user-token': token,
          'x-machine-id': machineId,
          'User-Agent': 'tnc-cli/1.0'
        },
        timeout: 5000
      });

      console.log(chalk.green("✅ Server response received!"));

      // Server sends userTasks and recommendations
      userTasks = res.data.userTasks || [];
      recommendations = res.data.recommendations?.topTasks || [];

      // Cache ONLY top 5 tasks (combine userTasks + recommendations, take first 5)
      const top5Tasks = [...userTasks, ...recommendations].slice(0, 5);
      
      // Cache the data - sirf top 5
      fs.writeFileSync(cacheFile, JSON.stringify({
        userTasks: top5Tasks.filter(t => t.assignedTo?.some(a => a.userId?._id?.toString() === userTasks[0]?.assignedTo?.[0]?.userId?._id?.toString())),
        recommendations: top5Tasks.filter(t => !t.assignedTo?.some(a => a.userId?._id?.toString() === userTasks[0]?.assignedTo?.[0]?.userId?._id?.toString()))
      }, null, 2));

      // Display logic...
      displayTasks(userTasks, recommendations);

    } catch (error) {
      // Offline mode...
      console.log(chalk.red(`❌ Server error: ${error.message}`));
      if (error.code === 'ECONNREFUSED') {
        console.log(chalk.red(`🚨 Server not running at ${url}`));
        console.log(chalk.yellow("💡 Start server: npm start"));
      } else if (error.response?.status === 401) {
        console.log(chalk.red("🔒 Unauthorized! Token expired or invalid."));
        console.log(chalk.yellow("💡 Please login again: tnc-cli login"));
      }
      
      if (fs.existsSync(cacheFile)) {
        console.log(chalk.yellow("⚠️ Offline mode: showing cached tasks"));
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
        userTasks = cached.userTasks || [];
        recommendations = cached.recommendations || [];
        displayTasks(userTasks, recommendations);
      } else {
        console.log(chalk.gray("📭 No cached tasks available."));
      }
    }
  } catch (error) {
    console.error(chalk.red("❌ Error:"), error.message);
  }
}

// Display function
function displayTasks(userTasks, recommendations) {
  // Show user tasks
  if (userTasks.length > 0) {
    const userTable = new CliTable3({
      head: [
        chalk.cyan.bold("Title"),
        chalk.green.bold("Status"),
        chalk.magenta.bold("Category"),
        chalk.red.bold("Priority"),
        chalk.yellow.bold("ID")
      ],
      colWidths: [30, 12, 18, 8, 30],
      wordWrap: true
    });

    console.log(chalk.bold.cyan("\n📋 YOUR ASSIGNED TASKS\n"));
    userTasks.forEach(task => {
      userTable.push([
        chalk.white(task.title || "Untitled"),
        task.status === "completed" ? chalk.green(task.status) : 
          task.status === "in-progress" ? chalk.yellow(task.status) : 
          task.status === "pending" ? chalk.blue(task.status) : chalk.red(task.status || "unknown"),
        chalk.magenta(task.category || "General"),
        task.priority === "critical" ? chalk.bgRed.white(" CRITICAL ") :
          task.priority === "high" ? chalk.red(task.priority) : 
          task.priority === "medium" ? chalk.yellow(task.priority) : 
          task.priority === "low" ? chalk.green(task.priority) : chalk.gray("none"),
        chalk.gray(task._id ? task._id : 'N/A')
      ]);
    });
    console.log(userTable.toString());
  }

  // Show recommendations
  if (recommendations.length > 0) {
  const recTable = new CliTable3({
    head: [
      chalk.cyan.bold("Title"),
      chalk.green.bold("Score"),
      chalk.blue.bold("Status"),
      chalk.red.bold("Priority"),
      chalk.yellow.bold("Due Date"),
      chalk.magenta.bold("ID")  // ← ID column add kiya
    ],
    colWidths: [30, 10, 12, 12, 15, 30],  // ID ke liye width
    wordWrap: true
  });

  console.log(chalk.bold.cyan("\n🎯 RECOMMENDED TASKS\n"));
  
  recommendations.forEach((task, idx) => {
    // Status color
    let statusColor = 
      task.status === "completed" ? chalk.green("✓ Completed") :
      task.status === "in-progress" ? chalk.yellow("⟳ In Progress") :
      task.status === "pending" ? chalk.blue("⏳ Pending") :
      task.isOverdue ? chalk.red("⚠️ Overdue") :
      chalk.gray(task.status || "Unknown");

    recTable.push([
      chalk.white(task.title || "Untitled"),
      
      // Score column
      task.score >= 80 ? chalk.green.bold(task.score) : 
        task.score >= 60 ? chalk.yellow(task.score) : 
        task.score >= 40 ? chalk.hex('#FFA500')(task.score) : chalk.red(task.score || 0),
      
      // Status column
      statusColor,
      
      // Priority column  
      task.priority === "critical" ? chalk.bgRed.white(" CRITICAL ") :
        task.priority === "high" ? chalk.red(task.priority) :
        task.priority === "medium" ? chalk.yellow(task.priority) : 
        task.priority === "low" ? chalk.green(task.priority) : chalk.gray("none"),
      
      // Due Date column
      task.dueDate ? new Date(task.dueDate).toLocaleDateString() : chalk.gray("No date"),
      
      // ID column - short version
      chalk.gray(task._id ? task._id : 'N/A')
    ]);
  });
  
  console.log(recTable.toString());
}

  if (userTasks.length === 0 && recommendations.length === 0) {
    console.log(chalk.gray("📭 No tasks found."));
  }

  // Summary
  console.log(chalk.gray("\n" + "─".repeat(60)));
  console.log(chalk.cyan(`📊 Summary: ${userTasks.length} assigned, ${recommendations.length} recommended`));
  console.log(chalk.gray(`💡 Use -n <number> to see more tasks (e.g., tnc-cli my-tasks -n 10)`));
}

export default myTask;