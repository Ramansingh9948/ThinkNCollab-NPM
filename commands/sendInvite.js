import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";
import machineId from "node-machine-id"; // Add this import

const homeDir = os.homedir();
const baseUrl = "https://thinkncollab.com/cli"; 

async function getEmail() {
  const rcFile = path.join(homeDir, ".tncrc");
  if (!fs.existsSync(rcFile)) {
    console.log("❌ Please login first!");
    process.exit(1);
  }
  const content = fs.readFileSync(rcFile, "utf-8");
  return JSON.parse(content).email;
}

async function getToken() {
  const rcFile = path.join(homeDir, '.tncrc');
  if (!fs.existsSync(rcFile)) {
    console.log("❌ Please login first!");
    process.exit(1);
  }
  const content = fs.readFileSync(rcFile, 'utf-8');
  return JSON.parse(content).token;
}

async function sendInvite(inviteeEmail) {
  try {
    const email = await getEmail();
    const token = await getToken();
    const machineIdValue = machineId.machineIdSync(); // Get machine ID
    
    const CWD = process.cwd();
    
    // Read project metadata
    const metaDataPath = path.join(CWD, ".tnc", '.tncmeta.json');
    if (!fs.existsSync(metaDataPath)) {
      console.log("❌ Not in a ThinkNCollab project. Run 'tnc init' first.");
      process.exit(1);
    }
    
    const metaData = JSON.parse(fs.readFileSync(metaDataPath, 'utf-8'));
    const roomId = metaData.roomId;

    console.log(`📧 Inviting: ${inviteeEmail}`);
    console.log(`🏠 Room ID: ${roomId}`);

    // USING HEADERS FOR AUTHENTICATION
    const res = await axios({
      method: 'post',
      url: `${baseUrl}/invite/${roomId}`,
      params: {
        inviteeEmail: inviteeEmail  // Only inviteeEmail in query params
      },
      headers: {
        'x-user-email': email,
        'x-user-token': token,
        'x-machine-id': machineIdValue
      }
    });

    console.log("✅ Invitation sent successfully to", inviteeEmail);
    console.log("🔗 Invite Link:", res.data.invitationLink);
    
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error("❌ Server error:", error.response.data.message || error.response.status);
      if (error.response.status === 401) {
        console.error("   Unauthorized. Please login again.");
      } else if (error.response.status === 404) {
        console.error("   Room not found.");
      }
    } else if (error.request) {
      // No response received
      console.error("❌ No response from server. Check your internet connection.");
    } else {
      // Other errors
      console.error("❌ Error:", error.message);
    }
  }
}

export default sendInvite;