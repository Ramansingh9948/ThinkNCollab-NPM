import axios from "axios";
import machine from "node-machine-id";
import fs from "fs";
import os from "os";
import path from "path";
import inquirer from "inquirer";

const tncrcPath = path.join(os.homedir(), ".tncrc");

async function connect(roomId) {
  if (!fs.existsSync(tncrcPath)) {
    console.error("❌ You are not logged in. Run 'tnc login' first.");
    process.exit(1);
  }

  const answer = await inquirer.prompt([
    { type: "input", name: "BranchName", message: "Enter Branch Name to create a branch:" }
  ]);

  const data = fs.readFileSync(tncrcPath, "utf-8");
  const { email, token } = JSON.parse(data);
  const machineId = machine.machineIdSync();

  try {
    // USING HEADERS FOR AUTHENTICATION
    const response = await axios({
      method: 'post',
      url: `https://thinkncollab.com/cli/connect/${roomId}`,
      data: {
        branchName: answer.BranchName  // Only branchName in request body
      },
      headers: {
        'x-user-email': email,
        'x-user-token': token,
        'x-machine-id': machineId
      }
    });

    const CWD = process.cwd();
    const tncFolderPath = path.join(CWD, ".tnc");
    
    if (!fs.existsSync(tncFolderPath)) {
      fs.mkdirSync(tncFolderPath, { recursive: true });
    }
    
    // Write metadata file
    const metaFilePath = path.join(tncFolderPath, ".tncmeta.json");
    const pushFilePath = path.join(tncFolderPath, ".tncpush.json");

    const metaFileInfo = JSON.stringify({
      "projectId": response.data.project._id,
      "projectName": response.data.project.name,
      "roomId": response.data.project.roomId,
      "currentBranch": answer.BranchName,
      "lastCommit": null,
      "files": {}
    }, null, 2);
    
    fs.writeFileSync(metaFilePath, metaFileInfo);
    fs.writeFileSync(pushFilePath, JSON.stringify({}, null, 2));

    console.log("✅ Connected to project:", response.data.project.name);
    console.log("👥 Members connected:", response.data.project.membersConnected.length);
    console.log("🌿 Current branch:", answer.BranchName);

  } catch (err) {
    if (err.response) {
      console.error("❌ Error:", err.response.data.error || err.response.data.message);
      if (err.response.status === 401) {
        console.error("   Please login again.");
      }
    } else {
      console.error("❌ Error:", err.message);
    }
  }
}

export default connect;