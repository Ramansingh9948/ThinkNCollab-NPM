import  os from 'os'
import fs from 'fs'
import path from 'path';

const RC_FILE = os.homedir();

async function getVerify() {
    const tncfilepath = path.join(RC_FILE, ".tncrc");

    if (!fs.existsSync(tncfilepath)) {
          throw new Error("Configuration file not found. Please login first.");
        }
    
        const doc = await fs.readFileSync(tncfilepath, "utf-8");
        const obj = JSON.parse(doc);
       

        
        return obj;

}

export default getVerify;