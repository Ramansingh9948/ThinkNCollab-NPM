import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";

const homeDir = os.homedir();
const url = "http://localhost:3001/cli/invite"; // backend endpoint

// Get saved email from ~/.tncrc
async function getEmail() {
  const rcFile = path.join(homeDir, ".tncrc");

  if (!fs.existsSync(rcFile)) {
    console.log("⚠️ Please login first!");
    process.exit(1);
  }

  const content = fs.readFileSync(rcFile, "utf-8");
  const email = JSON.parse(content).email;
  return email;
}
async function getToken() {
  const rcFile = path.join(homeDir, '.tncrc');
  if(!fs.readFileSync(rcFile)){
    console.log("⚠️ Please login first! ")
  }
  const content = fs.readFileSync(rcFile, 'utf-8');
  const token = JSON.parse(content).token;
  return token;


}

// Fetch tasks for a given room
async function sendInvite(inviteeEmail) {
  try {
    const email = await getEmail();
    const token = await getToken();

    const res = await axios.get(`${url}/${roomId}`, {
      params: { email, token,inviteeEmail } 
    });

    const tasks = res.data.tasks;

    if (!tasks.length) {
      console.log("📭 No tasks assigned.");
      return;
    }

    console.log("📋 Your Tasks:");
    tasks.forEach((task, i) => {
      console.log(`${i + 1}. ${task.title} — ${task.status}`);
    });

  } catch (error) {
    console.error("❌ Error fetching tasks:", error.response?.data || error.message);
  }
}

export default sendInvite;
