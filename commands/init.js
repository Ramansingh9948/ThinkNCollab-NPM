import fs from "fs";
import os from "os";
import path from "path";
import inquirer from "inquirer";
import axios from "axios";
import machine from "node-machine-id";

const CWD = process.cwd();

async function projectInit(roomId) {
  const answer = await inquirer.prompt([
    { type: "input", name: "projectName", message: "Enter Project Name:" }
  ]);

  const HomeDir = os.homedir();
  const tncrcPath = path.join(HomeDir, ".tncrc");

  if (!fs.existsSync(tncrcPath)) {
    console.error("❌ You are not logged in. Run 'tnc login' first.");
    process.exit(1);
  }

  const data = fs.readFileSync(tncrcPath, "utf-8");
  const currentUser = JSON.parse(data).email;
  const userToken = JSON.parse(data).token;

  // Initialize project via backend
  const response = await axios.post("http://localhost:3001/cli/init", {
    projectName: answer.projectName,
    owner: currentUser,
    token: userToken,
    machineId: await machine.machineIdSync(),
    roomId: roomId 
  });

  const projectId = response.data.project._id;

  // Ensure .tnc folder exists at project root
  const tncFolderPath = path.join(CWD, ".tnc");
  if (!fs.existsSync(tncFolderPath)) fs.mkdirSync(tncFolderPath, { recursive: true });

  // Write metadata file
  const metaFilePath = path.join(tncFolderPath, ".tncmeta.json");
  const pushFilePath = path.join(tncFolderPath, ".tncpush.json");
  fs.writeFileSync(
    metaFilePath,
    JSON.stringify(
      {
        projectId,
        projectName: answer.projectName,
        currentBranch: "main",
        roomId: roomId,
        lastCommit: null,
        files: {}
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    pushFilePath,
   " {} "
  )

  console.log("✅ Project initialized successfully!");
}

export default projectInit;
