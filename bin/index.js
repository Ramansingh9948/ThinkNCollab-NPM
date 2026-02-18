#!/usr/bin/env node
import inquirer from "inquirer";
import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
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
import push from "../commands/push.js";
import taskCompletion from "../commands/taskCompletion.js";
import task from "../commands/task.js";
import createTask from "../commands/createTask.js";
import myTeam from "../commands/myTeam.js";




const RC_FILE = path.join(os.homedir(), ".tncrc");
const VERSION_FILE = path.join(process.cwd(), ".tncversions");
const BASE_URL = "https://thinkncollab.com/rooms";
const CWD = process.cwd();




/** ------------------ LOGIN ------------------ **/
async function login() {
  const answers = await inquirer.prompt([
    { type: "input", name: "email", message: "Email:" },
    { type: "password", name: "password", message: "Password:" }

  ]);

  try {
    console.log("🔐 Logging in...");
    const res = await axios.post("https://thinkncollab.com/login", {
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
      const targetPath = args[roomIndex + 2];
      await push(roomId, targetPath);
      break;
    }
    case "status":
      await Status();
      break;

    case "init":
      const roomIndex = args.indexOf("init");
      const roomid = args[roomIndex + 1];
      if (!roomid) console.log("Usage: tnc-cli init <roomId>");
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
    if(idx === -1 || !args[idx+1]){
      console.log(" Usage: tnc-cli connect <roomId> ");
      process.exit(1);
    }
    const link = args[idx+1];
    await connect(link);
    break;
  }

    case "task-complete": {
    const idx = args.indexOf("task-complete");
    await taskCompletion();
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
  const roomId = args[roomIdx + 1]; 

  await myTask(); 
  break;
}
case "create-task": {
  const roomIdx = args.indexOf("create-task");


  await createTask(); 
  break;
}
case "send": {
  await send(); 
  break;
}
case "invite": {
  const roomIdx = args.indexOf("invite");
  if (roomIdx === -1 || !args[roomIdx + 1]) {
    console.log("Usage: tnc-cli invite <invitee-email>");
    process.exit(1);
  }
  const email = args[roomIdx + 1];

  await sendInvite(email); 
  break;
}
case "task": {
  task();
  break;
}

case "myteam": {
  myTeam();
  break;
}

case "signout": {
  await DAPP();
  break;
 
}

default:
  console.log("================================");
  console.log("   THINKNCOLLAB CLI");
  console.log("================================\n");

  console.log("Authentication:");
  console.log("  tnc-cli login                     Login to your account");
  console.log("  tnc-cli logout                    Logout from your account");
  console.log("  tnc-cli whoami                    Show current logged-in user");
  console.log("");

  console.log("Project / Room:");
  console.log("  tnc-cli init <roomId>             Initialize current folder with a room");
  console.log("  tnc-cli connect <roomId>          Connect project to a room");
  console.log("  tnc-cli status                    Show project status");
  console.log("");

  console.log("Branch:");
  console.log("  tnc-cli create --room <roomId>    Create branch for a room");
  console.log("");


  console.log("Tasks:");
  console.log("  tnc-cli my-tasks                  Show your assigned tasks");
  console.log("  tnc-cli create-task               Create a new task");
  console.log("  tnc-cli task                      View task details");
  console.log("  tnc-cli task-complete             Mark task as completed");
  console.log("");

  console.log("Team:");
  console.log("  tnc-cli myteam                    Show team members");
  console.log("  tnc-cli invite <email>            Invite member to room");
  console.log("");

  console.log("Communication:");
  console.log("  tnc-cli send                      Send message to room");
  console.log("");

  console.log("Utility:");
  console.log("  tnc-cli help                      Show help information");
  console.log("  tnc-cli version                   Show CLI version");
  console.log("  tnc-cli signout                   Sign out from DAPP");
  console.log("");

  break;
}

}

main().catch(err => console.error(err));