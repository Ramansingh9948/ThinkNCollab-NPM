import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import machine from "node-machine-id";
import chalk from "chalk";
import FormData from "form-data";
import getVerify from "../lib/getVerify.js";

const CWD = process.cwd();
const TNC_API_URL = "http://localhost:3001/";
const metaDataFile = path.join(CWD, ".tnc", ".tncmeta.json");
const metaData = JSON.parse(fs.readFileSync(metaDataFile, "utf-8"));
const roomId = metaData.roomId;

async function myTeam() {
    try {
        const verifyData = await getVerify();
        const { email, token } = verifyData;
        const response = await axios.get(`${TNC_API_URL}cli/myTeam/${roomId}`, {
            headers: {
                email,
                token,
                machineId: machine.machineIdSync(),
            },
        });
        const teamMembers = response.data.RoomMembers || [];
        if (teamMembers.length === 0) {
            console.log(chalk.yellow("⚠️  You are not part of any team yet."));
            return;
        }
        console.log(chalk.green("👥 Your Team Members:"))
        teamMembers.forEach(member => {
            console.log(chalk.blue(`- ${member.name} (${member.email})`));
        });
    } catch (err) {
        if (err.response) {
            console.error(chalk.red("❌ Error:"), chalk.red(err.response.data.error));
        } else {
            console.error(chalk.red("❌ Error:"), chalk.red(err.message));
        }
    }
}
export default myTeam;