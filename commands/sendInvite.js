import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";

const homeDir = os.homedir();
const url = "http://localhost:3001/cli/invite"; 
// Get saved email from ~/.tncrc
async function getEmail() {
  const rcFile = path.join(homeDir, ".tncrc");

  if (!fs.existsSync(rcFile)) {
    console.log(" Please login first!");
    process.exit(1);
  }

  const content = fs.readFileSync(rcFile, "utf-8");
  const email = JSON.parse(content).email;
  return email;
}
async function getToken() {
  const rcFile = path.join(homeDir, '.tncrc');
  if(!fs.readFileSync(rcFile)){
    console.log(" Please login first! ")
  }
  const content = fs.readFileSync(rcFile, 'utf-8');
  const token = JSON.parse(content).token;
  return token;


}
async function sendInvite(inviteeEmail) {
  try {
    const email = await getEmail();
    const token = await getToken();
    const CWD = process.cwd();
    const metaDataPath = path.join(".tnc", '.tncmeta.json'); 
    const metaData = JSON.parse(fs.readFileSync(path.join(CWD, metaDataPath), 'utf-8'));
    const roomId = metaData.roomId;
    console.log(email, token, roomId, inviteeEmail);
const res = await axios({
  method: 'post',
  url: `${url}/${roomId}`,
  params: {
    email,
    token,
    inviteeEmail,
    roomId
  }
});
    console.log(" Invitation sent successfully to", inviteeEmail);
    console.log("Invite Link:", res.data.invitationLink);
  } catch (error) {
    console.error(" Error while generating the invitation link:", error.response?.data || error.message);
  }
}
export default sendInvite;
