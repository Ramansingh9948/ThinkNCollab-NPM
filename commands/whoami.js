import fs from "fs";
import os from "os";
import path from "path";

const RC_FILE = path.join(os.homedir(), ".tncrc");

 async function whoami() {
    try{
        if(fs.existsSync(RC_FILE)) {
            const rcData = fs.readFileSync(RC_FILE, "utf-8");
            const {email} = JSON.parse(rcData);
            console.log('You are logged in by the email:', email);
        }
        else{
            console.log("You are not logged-in");
        }

    } catch (error) {
        console.error('Error reading .tncrc file:', error);
    }
}

export default whoami;