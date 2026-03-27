import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import machine from "node-machine-id";
import inquirer from "inquirer";
import chalk from "chalk";

const CWD = process.cwd();
const BASE_URL = "https://thinkncollab.com/cli";
const tncrcPath = path.join(os.homedir(), ".tncrc");
const tncMetaPath = path.join(CWD, ".tnc", ".tncmeta.json");
const taskFilePath = path.join(CWD, ".tnc", "tasks.json");

async function task() {
    try {
        // Validate login
        if (!fs.existsSync(tncrcPath)) {
            console.error("❌ You are not logged in. Run 'tnc login' first.");
            return;
        }

        // Validate project init
        if (!fs.existsSync(tncMetaPath)) {
            console.error("❌ This directory is not initialized. Run 'tnc init' first.");
            return;
        }

        // Read credentials
        const tncrcData = fs.readFileSync(tncrcPath, "utf-8");
        const { email, token } = JSON.parse(tncrcData);
        const machineId = machine.machineIdSync();

        // Read project metadata
        const tncMetaData = fs.readFileSync(tncMetaPath, "utf-8");
        const { projectId, projectName } = JSON.parse(tncMetaData);

        // Ask Task ID
        const { taskId } = await inquirer.prompt([
            {
                type: "input",
                name: "taskId",
                message: "Enter Task ID:",
            },
        ]);

        if (!taskId?.trim()) {
            console.error("❌ Task ID cannot be empty.");
            return;
        }

        console.log(`📋 Fetching task ${taskId.trim()} from project: ${projectName}`);

        // API call with headers for authentication
        const response = await axios({
            method: 'get',
            url: `${BASE_URL}/task/${taskId.trim()}`,
            headers: {
                'x-user-email': email,
                'x-user-token': token,
                'x-machine-id': machineId,
                'x-project-id': projectId // Optional: for project context
            }
        });

        // Handle response data
        const serverTasks = Array.isArray(response.data.task)
            ? response.data.task
            : [response.data.task];

        // Read or initialize local tasks file
        let localData = { tasks: [] };
        if (fs.existsSync(taskFilePath)) {
            try {
                localData = JSON.parse(fs.readFileSync(taskFilePath, "utf-8"));
            } catch (e) {
                console.log("⚠️ Corrupted tasks file, creating new one");
            }
        }
        
        const localTasks = localData.tasks || [];

        // Sync with local file
        serverTasks.forEach((serverTask) => {
            const index = localTasks.findIndex((t) => t._id === serverTask._id);

            if (index !== -1) {
                localTasks[index] = {
                    ...localTasks[index],
                    ...serverTask,
                    lastSynced: new Date().toISOString()
                };
            } else {
                localTasks.push({
                    ...serverTask,
                    lastSynced: new Date().toISOString()
                });
            }
        });

        // Ensure .tnc folder exists
        const tncFolder = path.join(CWD, ".tnc");
        if (!fs.existsSync(tncFolder)) {
            fs.mkdirSync(tncFolder, { recursive: true });
        }

        // Write updated tasks
        fs.writeFileSync(
            taskFilePath,
            JSON.stringify({ 
                tasks: localTasks,
                lastUpdated: new Date().toISOString(),
                projectId 
            }, null, 2)
        );

        console.log("✅ Task synced successfully\n");

        // Display task information
        serverTasks.forEach(task => {
            console.log(chalk.gray("────────────────────────────────────"));

            const statusColor =
                task.status === "completed"
                    ? chalk.green
                    : task.status === "in-progress"
                        ? chalk.yellow
                        : task.status === "todo"
                            ? chalk.blue
                            : chalk.red;
            
            const priorityColor =
                task.priority === "high"
                    ? chalk.red
                    : task.priority === "medium"
                        ? chalk.yellow
                        : task.priority === "low"
                            ? chalk.green
                            : chalk.gray;

            // Print task details
            printField("Task ID", task._id, chalk.cyan.bold, chalk.white);
            printField("Title", task.title, chalk.green.bold, chalk.white);
            printField("Description", task.description || "No description", chalk.yellow.bold, chalk.white);
            printField("Status", task.status, chalk.blue.bold, statusColor);
            printField("Priority", task.priority || "Not set", chalk.magenta.bold, priorityColor);
            printField("Created At", task.createdAt ? new Date(task.createdAt).toLocaleString() : "N/A", chalk.cyan.bold, chalk.white);
            printField("Updated At", task.updatedAt ? new Date(task.updatedAt).toLocaleString() : "N/A", chalk.cyan.bold, chalk.white);
            printField(
                "Due Date",
                task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Not set",
                chalk.cyan.bold,
                chalk.white
            );

            // Show assigned users if any
            if (task.assignedTo && task.assignedTo.length > 0) {
                printField("Assigned To", `${task.assignedTo.length} user(s)`, chalk.blue.bold, chalk.white);
                task.assignedTo.forEach((user, index) => {
                    console.log(
                        chalk.gray(`                 ${index + 1}. ${ user.userId.name} ,  ${(user.userId.email)} [Status: ${user.status}]`)
                    );
                });
            }

            // Show attachments if any
            if (task.attachments?.length > 0) {
                printField("Attachments", `${task.attachments.length} file(s)`, chalk.blue.bold, chalk.white);
                task.attachments.forEach((att, index) => {
                    console.log(
                        chalk.gray(`                 ${index + 1}. ${att.name || att.filename || 'Attachment'}`)
                    );
                    if (att.url) {
                        console.log(chalk.gray(`                    URL: ${att.url}`));
                    }
                });
            } else {
                printField("Attachments", "None", chalk.blue.bold, chalk.gray);
            }

            console.log(chalk.gray("────────────────────────────────────\n"));
        });

    } catch (err) {
        if (err.response) {
            console.error("❌ Server Error:", err.response.data.message || err.response.data.error);
            if (err.response.status === 401) {
                console.error("   Unauthorized. Please login again.");
            } else if (err.response.status === 404) {
                console.error("   Task not found. Please check the Task ID.");
            } else if (err.response.status === 403) {
                console.error("   You don't have permission to access this task.");
            }
        } else if (err.request) {
            console.error("❌ No response from server. Check your internet connection.");
        } else {
            console.error("❌ Error:", err.message);
        }
    }
}

function printField(label, value, labelColor, valueColor, width = 15) {
    const terminalWidth = process.stdout.columns || 80;
    const plainLabel = label.padEnd(width);
    const labelPart = `${plainLabel} : `;
    const indent = " ".repeat(labelPart.length);
    const availableWidth = terminalWidth - indent.length;

    // Normalize multiline input
    const rawLines = String(value).replace(/\r/g, "").split("\n");

    rawLines.forEach((rawLine, lineIndex) => {
        let words = rawLine.split(" ");
        let currentLine = "";

        words.forEach(word => {
            if ((currentLine + word).length > availableWidth) {
                if (lineIndex === 0 && currentLine === "") {
                    console.log(
                        labelColor(plainLabel) + " : " + valueColor(word)
                    );
                } else {
                    console.log(indent + valueColor(currentLine.trim()));
                    currentLine = word + " ";
                }
            } else {
                currentLine += word + " ";
            }
        });

        if (currentLine.trim()) {
            if (lineIndex === 0) {
                console.log(
                    labelColor(plainLabel) +
                        " : " +
                        valueColor(currentLine.trim())
                );
            } else {
                console.log(indent + valueColor(currentLine.trim()));
            }
        }
    });
}

export default task;