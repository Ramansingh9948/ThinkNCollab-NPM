import fs from "fs";
import os from "os";
import path from "path";
import inquirer from "inquirer";
import axios from "axios";
import machineId from "node-machine-id";

const CWD = process.cwd();

async function projectInit(roomId) {
  try {
    const answer = await inquirer.prompt([
      { type: "input", name: "projectName", message: "Enter Project Name:" }
    ]);

    const HomeDir = os.homedir();
    const tncrcPath = path.join(HomeDir, ".tncrc");

    if (!fs.existsSync(tncrcPath)) {
      console.error("❌ You are not logged in. Run 'tnc login' first.");
      process.exit(1);
    }

    // Read user credentials from .tncrc
    const data = fs.readFileSync(tncrcPath, "utf-8");
    const userData = JSON.parse(data);
    const currentUser = userData.email;
    const userToken = userData.token;
    const machineIdValue = machineId.machineIdSync(); // or await machineId.machineId()

    console.log("Initializing project...");

    // Initialize project via backend - CREDENTIALS IN HEADERS
    const response = await axios.post(
      "https://thinkncollab.com/cli/init",
      {
        projectName: answer.projectName,
        roomId: roomId
        // Note: owner, token, machineId are NOT in body
      },
      {
        headers: {
          'x-user-email': currentUser,
          'x-user-token': userToken,
          'x-machine-id': machineIdValue
        }
      }
    );

    const projectData = response.data;
    const projectId = projectData.project._id;

    // Ensure .tnc folder exists at project root
    const tncFolderPath = path.join(CWD, ".tnc");
    if (!fs.existsSync(tncFolderPath)) {
      fs.mkdirSync(tncFolderPath, { recursive: true });
    }

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
      JSON.stringify({}, null, 2)
    );

    console.log("✅ Project initialized successfully!");
    console.log(`📁 Project ID: ${projectId}`);
    console.log(`🌿 Branch: main`);
    
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      console.error(`❌ Server error: ${error.response.data.message || error.response.status}`);
      if (error.response.status === 400) {
        console.error("Please check your login credentials");
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error("❌ No response from server. Please check your internet connection.");
    } else {
      // Something happened in setting up the request
      console.error("❌ Error:", error.message);
    }
    process.exit(1);
  }
}

export default projectInit;