import axios from "axios";
import fs from "fs";
import path from "path";
import machine from "node-machine-id";
import chalk from "chalk";
import getVerify from "../lib/getVerify.js";

const CWD = process.cwd();
const BASE_URL = "https://thinkncollab.com/cli";
const metaDataFile = path.join(CWD, ".tnc", ".tncmeta.json");

async function myTeam() {
    try {
        // ✅ Check initialization first
        if (!fs.existsSync(metaDataFile)) {
            console.log(chalk.red("❌ Project not initialized."));
            console.log(chalk.yellow("👉 Run `tnc init` first."));
            return;
        }

        const metaData = JSON.parse(fs.readFileSync(metaDataFile, "utf-8"));

        if (!metaData.roomId) {
            console.log(chalk.red("❌ No room associated with this project."));
            return;
        }

        const roomId = metaData.roomId;
        const projectName = metaData.projectName || "Unknown Project";

        // Get user credentials
        const verifyData = await getVerify();
        const { email, token } = verifyData;
        const machineId = machine.machineIdSync();

        console.log(chalk.blue(`📋 Fetching team members for project: ${projectName}`));
        console.log(chalk.blue(`🏠 Room ID: ${roomId}`));

        // API call with headers for authentication
        const response = await axios({
            method: 'get',
            url: `${BASE_URL}/myTeam/${roomId}`,
            headers: {
                'x-user-email': email,
                'x-user-token': token,
                'x-machine-id': machineId,
                'x-project-id': metaData.projectId // Optional: for project context
            }
            // NO REQUEST BODY - all auth in headers
        });

        const teamMembers = response.data.RoomMembers || [];

        if (teamMembers.length === 0) {
            console.log(chalk.yellow("⚠️ No team members found in this room."));
            return;
        }

        // Display team information
        console.log(chalk.green("\n👥 Team Members:"));
        console.log(chalk.gray("────────────────────────"));

        // Sort members by role or name
        const sortedMembers = teamMembers.sort((a, b) => {
            // Put room owner first if available
            if (a.role === 'owner' && b.role !== 'owner') return -1;
            if (b.role === 'owner' && a.role !== 'owner') return 1;
            return (a.name || a.email).localeCompare(b.name || b.email);
        });

        sortedMembers.forEach((member, index) => {
            // Determine role badge
            let roleBadge = '';
            if (member.role === 'owner') {
                roleBadge = chalk.yellow('👑 Owner');
            } else if (member.role === 'admin' || member.role === 'manager') {
                roleBadge = chalk.blue('⚙️ Admin');
            } else {
                roleBadge = chalk.gray('👤 Member');
            }

            // Format online status
            const status = member.isOnline 
                ? chalk.green('● Online') 
                : chalk.gray('○ Offline');

            console.log(
                chalk.white(`${index + 1}. `) +
                chalk.cyan.bold(member.name || 'Unknown') + 
                chalk.gray(` <${member.email}>`)
            );
            console.log(chalk.gray(`   ${roleBadge}  •  ${status}`));
            
            // Show last active if available
            if (member.lastActive) {
                const lastActive = new Date(member.lastActive).toLocaleString();
                console.log(chalk.gray(`   Last active: ${lastActive}`));
            }
            
            console.log(chalk.gray("────────────────────────"));
        });

        console.log(chalk.green(`\n✅ Total members: ${teamMembers.length}`));

    } catch (err) {
        if (err.response) {
            console.error(chalk.red("❌ Server Error:"), chalk.red(err.response.data.message || err.response.data.error));
            
            if (err.response.status === 401) {
                console.error(chalk.yellow("   Unauthorized. Please login again."));
            } else if (err.response.status === 404) {
                console.error(chalk.yellow("   Room not found. Please check your project."));
            } else if (err.response.status === 403) {
                console.error(chalk.yellow("   You don't have permission to view this team."));
            }
        } else if (err.request) {
            console.error(chalk.red("❌ No response from server. Check your internet connection."));
        } else {
            console.error(chalk.red("❌ Error:"), chalk.red(err.message));
        }
    }
}

export default myTeam; 