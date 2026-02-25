import axios from "axios";
import fs from "fs";
import path from "path";
import machine from "node-machine-id";
import chalk from "chalk";
import { fileURLToPath } from 'url';
import open from 'open';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();
const BASE_URL = "https://thinkncollab.com/cli";

async function createTask() {
    try {
        const { default: getVerify } = await import("../lib/getVerify.js");
        const { email, token } = await getVerify();
        const machineId = machine.machineIdSync();

        const tncmetaPath = path.join(CWD, ".tnc", ".tncmeta.json");

        if (!fs.existsSync(tncmetaPath)) {
            console.error(chalk.red("❌ Not inside a ThinkNCollab project."));
            return;
        }

        const fileData = JSON.parse(fs.readFileSync(tncmetaPath, "utf-8"));
        const roomId = fileData.roomId;
        const projectName = fileData.projectName || "Unknown Project";

        if (!roomId) {
            console.error(chalk.red("❌ No roomId found."));
            return;
        }
        
        console.log(chalk.blue('\n🚀 Task Creation CLI'));
        console.log(chalk.gray(`📁 Project: ${projectName}`));
        console.log(chalk.gray(`🏠 Room ID: ${roomId}\n`));
        
        // STEP 1: Find available port for callback
        console.log(chalk.gray('🔍 Finding available port for callback...'));
        const CALLBACK_PORT = await findAvailablePort(3002);
        console.log(chalk.green(`✅ Callback server on port: ${CALLBACK_PORT}`));
        
        // STEP 2: Create a session first using a direct API call
        console.log(chalk.blue('\n🔐 Creating secure session...'));
        
        const sessionResponse = await axios.post(`${BASE_URL}/create-session`, {}, {
            headers: {
                'x-user-email': email,
                'x-user-token': token,
                'x-machine-id': machineId,
                'x-room-id': roomId
            }
        });
        
        const { sessionToken } = sessionResponse.data;
        console.log(chalk.green(`✅ Session created successfully!`));
        
        // STEP 3: Create callback server
        const callbackServer = http.createServer((req, res) => {
            if (req.url.includes('/callback') || req.url.includes('?taskId=')) {
                const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
                const taskId = url.searchParams.get('taskId');
                const taskTitle = url.searchParams.get('title');
                
                console.log(chalk.green(`\n✅ Task Created: ${taskTitle || 'Untitled'} (ID: ${taskId})`));
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                        <body style="font-family: Arial; text-align: center; padding: 50px;">
                            <h2>✅ Task Created Successfully!</h2>
                            <p>Task ID: ${taskId}</p>
                            <p>Title: ${taskTitle || 'Untitled'}</p>
                            <p>You can close this window now.</p>
                            <script>
                                setTimeout(() => window.close(), 2000);
                            </script>
                        </body>
                    </html>
                `);
                
                // Close servers after callback
                setTimeout(() => {
                    callbackServer.close();
                    console.log(chalk.green('\n✅ Task creation complete!'));
                    process.exit(0);
                }, 2000);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        
        callbackServer.listen(CALLBACK_PORT, () => {
            console.log(chalk.green(`✅ Callback server on http://localhost:${CALLBACK_PORT}`));
        });
        
        // STEP 4: Open the task creation page directly with session token
        const taskCreationUrl = `http://localhost:3001/cli/tasks/${roomId}/create?session=${sessionToken}&cli=true&callbackPort=${CALLBACK_PORT}`;
        
        console.log(chalk.blue('\n🔗 Opening task creation interface...'));
        
        setTimeout(async () => {
            try {
                await open(taskCreationUrl);
                console.log(chalk.green('✅ Browser opened successfully!'));
            } catch (err) {
                console.error(chalk.red('❌ Could not open browser automatically.'));
                console.log(chalk.yellow('Please open this URL manually in your browser:'));
                console.log(chalk.cyan(taskCreationUrl));
            }
        }, 1000);
        
        console.log(chalk.gray('\n⏳ Waiting for task creation in browser...'));
        console.log(chalk.gray('   (The CLI will automatically close when task is created)\n'));
        
        // Wait forever (until callback closes)
        await new Promise(() => {});
        
    } catch (err) {
        console.error(chalk.red("❌ Error:"), err.message);
        if (err.response) {
            console.error(chalk.red("Server response:"), err.response.data);
        }
    }
}

async function findAvailablePort(startPort) {
    const net = await import('net');
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(findAvailablePort(startPort + 1));
            } else {
                reject(err);
            }
        });
    });
}

export default createTask;