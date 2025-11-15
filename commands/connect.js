import axios from "axios";
import machine from "node-machine-id";
import fs from "fs";
import os from "os";
import path from "path";

const tncrcPath = path.join(os.homedir(), ".tncrc");

async function connect(roomId) {
  if (!fs.existsSync(tncrcPath)) {
    console.error("❌ You are not logged in. Run 'tnc login' first.");
    process.exit(1);
  }

  const data = fs.readFileSync(tncrcPath, "utf-8");
  const { email, token } = JSON.parse(data);

  try {
    const response = await axios.post(`http://localhost:3001/cli/connect/${roomId}`, {
      email: email,
      token: token,
      machineId: await machine.machineIdSync()
    });
    const CWD= process.cwd();
    const tncFolderPath = path.join(CWD, ".tnc");
     if (!fs.existsSync(tncFolderPath)) fs.mkdirSync(tncFolderPath, { recursive: true });
   
     // Write metadata file
     const metaFilePath = path.join(tncFolderPath, ".tncmeta.json");
     const pushFilePath = path.join(tncFolderPath, ".tncpush.json");

    const metaFileInfo = JSON.stringify({
      "projectId": response.data.project._id,
      "projectName": response.data.project.name,
      "roomId": response.data.project.roomId,
      "branch": null
    });
    fs.writeFileSync(metaFilePath, metaFileInfo);
     fs.writeFileSync(
        pushFilePath,
       " {} "
      )

console.log(response.data);





    // console.log("✅ Connected to project:", response.data.project.name);
    // console.log("Members connected:", response.data.project.membersConnected);

  } catch (err) {
    if (err.response) {
      console.error("❌ Error:", err.response.data.error);
    } else {
      console.error("❌ Error:", err.message);
    }
  }
}

export default connect;
