import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import machine from "node-machine-id";
import chalk from "chalk";
import { fileURLToPath } from 'url';
import open from 'open';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


const CWD = process.cwd();


function createSpinner(message) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const spinner = setInterval(() => {
        process.stdout.write(`\r${chalk.cyan(frames[i])} ${message}`);
        i = (i + 1) % frames.length;
    }, 80);
    
    return {
        stop: (clearMessage = true) => {
            clearInterval(spinner);
            if (clearMessage) {
                process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 50) + '\r');
            }
        },
        update: (newMessage) => {
            message = newMessage;
        }
    };
}

async function createTask() {
    try {
         const { default: getVerify } = await import("../lib/getVerify.js");

        const { token } = await getVerify();

        const CWD = process.cwd();
        const tncmetaPath = path.join(CWD, ".tnc", ".tncmeta.json");

        if (!fs.existsSync(tncmetaPath)) {
            console.error(chalk.red("❌ Not inside a ThinkNCollab project."));
            console.log(chalk.yellow("Run `tnc-cli init <roomId>` first."));
            return;
        }

        const fileData = JSON.parse(
            fs.readFileSync(tncmetaPath, "utf-8")
        );

        const roomId = fileData.roomId;

        if (!roomId) {
            console.error(chalk.red("❌ No roomId found."));
            return;
        }
        console.log(chalk.blue('\n🚀 Task Creation CLI\n'));
        
        // Validate roomId and token
        if (!roomId) {
            console.error(chalk.red('❌ No roomId found in .tnc/.tncmeta.json'));
            console.log(chalk.yellow('Please ensure you are in a ThinkNCollab project directory'));
            return;
        }
        
        if (!token) {
            console.error(chalk.red('❌ No token found'));
            console.log(chalk.yellow('Please login first using: tnc login'));
            return;
        }
        
        // STEP 1: Find available port FIRST
        console.log(chalk.gray('🔍 Finding available port for callback server...'));
        const PORT = await findAvailablePort(3002);
        console.log(chalk.green(`✅ Callback server will run on port: ${PORT}`));
        
        // STEP 2: Construct the URL with the found port
        const redirectUrl = `https://thinkncollab.in/cli/tasks/${roomId}/${token}/create?cli=true&callbackPort=${PORT}`;
        
        const spinner = createSpinner('Preparing task creation interface...');  
        
        console.log(chalk.blue('🔗 Opening task creation interface in your browser...'));
        console.log(chalk.gray(`URL: ${redirectUrl}`));
        
        spinner.stop();
        
        // STEP 3: Create callback server
        const server = http.createServer((req, res) => {
            console.log(chalk.yellow(`\n📨 Callback received: ${req.url}`));
            
            // CORS headers for all responses
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CLI-Callback-URL');
            res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
            
            // Handle preflight
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            
            // Parse URL
            const url = new URL(req.url, `http://localhost:${PORT}`);
            
            // Check for callback (handle both /callback and direct query params)
            if (req.url.includes('/callback') || url.searchParams.has('taskId')) {
                const taskId = url.searchParams.get('taskId');
                const attachments = url.searchParams.get('attachments');
                const status = url.searchParams.get('status');
                
                // Log success
                if (status === 'error') {
                    console.log(chalk.red('\n❌ Task creation failed!'));
                } else {
                    console.log(chalk.green('\n✅ Task created successfully!'));
                    if (taskId) {
                        console.log(chalk.blue(`📋 Task ID: ${taskId}`));
                        
                        // Save task ID to file
                        const taskMetaPath = path.join(CWD, ".tnc", "last-task.json");
                        fs.writeFileSync(taskMetaPath, JSON.stringify({
                            taskId,
                            attachments: attachments ? parseInt(attachments) : 0,
                            timestamp: new Date().toISOString(),
                            roomId
                        }, null, 2));
                        console.log(chalk.gray(`📝 Task ID saved to .tnc/last-task.json`));
                    }
                }
                
                // Send response to close browser (HTML with auto-close)
                res.writeHead(200, { 
                    'Content-Type': 'text/html',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${status === 'error' ? 'Failed' : 'Success'}</title>
                        <style>
                            body { 
                                font-family: Arial, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                background: ${status === 'error' ? '#f44336' : '#4CAF50'};
                                color: white;
                            }
                            .message {
                                text-align: center;
                                padding: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="message">
                            <h1>${status === 'error' ? '❌ Task Failed' : '✅ Task Created'}</h1>
                            ${taskId ? `<p>Task ID: ${taskId}</p>` : ''}
                            <p>Closing in 3 seconds...</p>
                        </div>
                        <script>
                            // Send one more callback to ensure it was received
                            fetch(window.location.href, { method: 'GET', mode: 'no-cors' });
                            
                            // Auto close
                            setTimeout(() => window.close(), 3000);
                            
                            // Fallback
                            setTimeout(() => {
                                window.location.href = 'about:blank';
                                setTimeout(() => window.close(), 100);
                            }, 4000);
                        </script>
                    </body>
                    </html>
                `);
                
                // Close server after response
                setTimeout(() => {
                    server.close();
                    console.log(chalk.gray('\n📡 Callback server closed'));
                    process.exit(0);
                }, 2000);
            } else {
                // Handle other requests (like favicon)
                res.writeHead(404);
                res.end('Not found');
            }
        });
        
        // Server error handling
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.log(chalk.yellow(`⚠️  Port ${PORT} is already in use. Callback might not work.`));
                console.log(chalk.yellow('The task will still be created, but you may need to check manually.'));
            } else {
                console.error(chalk.red('Server error:'), err.message);
            }
        });
        
        // Start server
        server.listen(PORT, () => {
            console.log(chalk.gray(`📡 Waiting for callback on http://localhost:${PORT}/callback`));
        });
        
        // Open browser
        setTimeout(async () => {
            try {
                await open(redirectUrl);
                console.log(chalk.green('✅ Browser opened successfully!'));
            } catch (err) {
                if (err.message.includes('No application')) {
                    console.error(chalk.red('❌ Could not open browser automatically.'));
                    console.log(chalk.yellow('Please manually open this URL in your browser:'));
                    console.log(chalk.cyan(redirectUrl));
                } else {
                    console.error(chalk.red('Browser error:'), err.message);
                }
            }
        }, 500);
        
        // Wait for callback or timeout
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log(chalk.yellow('\n⚠️  No callback received within 5 minutes.'));
                console.log(chalk.gray('Your task may have been created successfully.'));
                console.log(chalk.gray('Check your browser to confirm.'));
                server.close();
                resolve();
            }, 300000); // 5 minutes
            
            server.on('close', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
        
    } catch (err) {
        console.error(chalk.red("❌ An unexpected error occurred:"), err.message);
    }
}

// Helper function to find available port
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