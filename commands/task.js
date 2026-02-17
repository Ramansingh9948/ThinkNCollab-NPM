import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import machine from "node-machine-id";
import inquirer from "inquirer";
import chalk from "chalk";

const CWD = process.cwd();
const tncrcPath = path.join(os.homedir(), ".tncrc");
const taskFilePath = path.join(CWD, ".tnc", "tasks.json");

async function task() {
    try {
        // Validate login
        if (!fs.existsSync(tncrcPath)) {
            console.error("❌ You are not logged in. Run 'tnc login' first.");
            return;
        }

        // Validate project init
        if (!fs.existsSync(taskFilePath)) {
            console.error("❌ This directory is not initialized. Run 'tnc init' first.");
            return;
        }

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

        const { email, token } = JSON.parse(fs.readFileSync(tncrcPath, "utf-8"));
        const localData = JSON.parse(fs.readFileSync(taskFilePath, "utf-8"));
        const localTasks = localData.tasks || [];

        // API call (correct way using headers)
        const response = await axios.get(
            `https://thinkncollab.com/cli/task/${taskId.trim()}`,
            {
                headers: {
                    email,
                    token,
                    machineId: machine.machineIdSync(),
                },
            }
        );

        const serverTasks = Array.isArray(response.data.task)
            ? response.data.task
            : [response.data.task];

        // Sync with local file
        serverTasks.forEach((serverTask) => {
            const index = localTasks.findIndex((t) => t.id === serverTask.id);

            if (index !== -1) {
                localTasks[index] = {
                    ...localTasks[index],
                    ...serverTask,
                };
            } else {
                localTasks.push(serverTask);
            }
        });

        fs.writeFileSync(
            taskFilePath,
            JSON.stringify({ tasks: localTasks }, null, 2)
        );

        console.log("✅ Task synced successfully");

        serverTasks.forEach(task => {
            console.log(chalk.gray("\n------------------------------------------"));

            const statusColor =
                task.status === "completed"
                    ? chalk.green
                    : task.status === "in-progress"
                        ? chalk.yellow
                        : chalk.red;
            const priorityColor =
                task.priority === "high"
                    ? chalk.red
                    : task.priority === "medium"
                        ? chalk.yellow
                        : chalk.green;


            printField("Task ID", task._id, chalk.cyan.bold, chalk.white);
            printField("Title", task.title, chalk.green.bold, chalk.white);
            printField("Description", task.description || "N/A", chalk.yellow.bold, chalk.white);
            printField("Status", task.status, chalk.blue.bold, statusColor);
            printField("Priority", task.priority, chalk.magenta.bold, priorityColor);
            printField(
                "Due Date",
                task.dueDate ? new Date(task.dueDate).toDateString() : "N/A",
                chalk.cyan.bold,
                chalk.white
            );

            if (task.attachments?.length > 0) {
                printField("Attachments", `${task.attachments.length}`, chalk.blue.bold, chalk.white);

                task.attachments.forEach((att, index) => {
                    console.log(
                        chalk.gray(`                 ${index + 1}. ID: ${att._id}`)
                    );
                    console.log(
                        chalk.gray(`                    Name: ${att.name}`)
                    );
                });
            } else {
                printField("Attachments", "None", chalk.blue.bold, chalk.gray);
            }

            console.log(chalk.gray("------------------------------------------\n"));
        });




    } catch (err) {
        console.error(
            "❌ Error:",
            err.response?.data?.error || err.message
        );
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

    // After first printed line, ensure next raw lines are indented
    lineIndex = 1;
  });
}



export default task;
