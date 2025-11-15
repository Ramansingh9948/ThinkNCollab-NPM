# 🧠 ThinkNCollab CLI (Develoment Phase)

A powerful command-line interface for seamless collaboration with **ThinkNCollab** — push files, manage rooms, and collaborate directly from your terminal.

---

## 🚀 Quick Start

```bash
# Install the CLI globally
npm install -g thinkncollab-cli

# Login to your ThinkNCollab account
tnc-cli login

# Push files to a room
tnc-cli push --room <roomId> <path>

# Logout 
tnc-cli logout
```

---

## 🔐 Authentication

### **Login Command**

Authenticate with your ThinkNCollab account to enable CLI access:

```bash
tnc-cli login
```

### **What Happens During Login**

- Opens a secure browser window to ThinkNCollab’s authentication page  
- Completes OAuth2 authentication flow  
- Creates an encrypted `.tncrc` configuration file in your home directory  
- Stores secure tokens for future CLI sessions  

### **Manual Authentication**

```bash
tnc-cli login --token YOUR_AUTH_TOKEN
```

### **Verify Authentication**

```bash
tnc-cli whoami
```

### **Logout**

Clear stored credentials:

```bash
tnc-cli logout
```

---

## 📦 File Operations

### **Push Command**

Push files or directories to ThinkNCollab rooms:

```bash
tnc-cli push --room <roomId> <path>
```

#### **Syntax**

```bash
tnc-cli push --room ROOM_ID PATH [ADDITIONAL_PATHS...]
```

#### **Examples**

| Action | Command |
|--------|----------|
| Push a single file | `tnc-cli push --room 64a1b2c3d4e5f6a1b2c3d4e5 document.pdf` |
| Push entire folder | `tnc-cli push --room 64a1b2c3d4e5f6a1b2c3d4e5 ./src/` |
| Push multiple items | `tnc-cli push --room 64a1b2c3d4e5f6a1b2c3d4e5 file1.js assets/ components/` |
| Push current directory | `tnc-cli push --room 64a1b2c3d4e5f6a1b2c3d4e5 .` |

#### **Options**

| Option | Short | Description |
|---------|--------|-------------|
| `--room` | `-r` | **Required:** Target room ID |
| `--message` | `-m` | Commit message describing changes |
| `--force` | `-f` | Force push (overwrite conflicts) |
| `--dry-run` | — | Preview files before pushing |
| `--exclude` | — | Additional patterns to exclude |

---

## 🧩 Room Management

| Command | Description |
|----------|--------------|
| `tnc-cli rooms list` | List accessible rooms |
| `tnc-cli rooms info <id>` | Show details for a specific room |

---

## 🚫 File Ignoring

Use a `.ignoretnc` file in your project root to exclude files/folders during push.

### **Example `.ignoretnc`**

```text
# Dependencies
node_modules/
vendor/
bower_components/

# Build outputs
/dist
/build
/.next
/out

# Environment
.env
.env.local
.env.production
.env.development

# Logs
*.log
npm-debug.log*
yarn-debug.log*

# Temporary / OS
*.tmp
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Test
*.test.js
*.spec.js
/coverage/

# Large assets
*.psd
*.ai
*.sketch
```

### **Pattern Rules**

| Type | Example | Description |
|------|----------|-------------|
| Directory | `dist/` | Ignore whole directory |
| File Extension | `*.log` | Ignore all `.log` files |
| Specific File | `secret.env` | Ignore single file |
| Wildcard | `test-*.js` | Match name patterns |
| Negation | `!keep.js` | Include despite other rules |
| Comment | `# comment` | Ignored by parser |

---

## ⚙️ Configuration

After login, an encrypted `.tncrc` file is created in your home directory.

### **Example `.tncrc`**

```json
{
  "user": {
    "id": "encrypted_user_id",
    "email": "encrypted_email",
    "name": "encrypted_display_name"
  },
  "auth": {
    "token": "encrypted_jwt_token",
    "refreshToken": "encrypted_refresh_token",
    "expires": "2025-12-31T23:59:59Z"
  },
  "workspace": {
    "id": "encrypted_workspace_id",
    "name": "encrypted_workspace_name"
  },
  "settings": {
    "defaultRoom": "optional_default_room_id",
    "autoSync": false
  }
}
```

### **Environment Variables**

```bash
export TNC_API_TOKEN="your_api_token"
export TNC_API_URL="https://api.thinkncollab.com"
export TNC_DEFAULT_ROOM="your_default_room_id"
```

---

## ⚡ Advanced Usage

### **Batch Push**

```bash
tnc-cli push --room room1,room2,room3 ./shared-assets/
```

### **CI/CD Integration**

```bash
tnc-cli login --token $TNC_DEPLOY_TOKEN
tnc-cli push --room $PRODUCTION_ROOM ./dist/ --message "Build ${CI_COMMIT_SHA}"
```

### **Watch for Changes (Experimental)**

```bash
tnc-cli watch --room 64a1b2c3d4e5f6a1b2c3d4e5 ./src/
```

---

## 🧰 Troubleshooting

### **Authentication Issues**

```bash
tnc-cli logout
tnc-cli login
```

- Ensure valid token and room access  
- Token may need refresh or rotation  

### **Permission Errors**

- Confirm write access to target room  
- Check if the room ID is active  

### **File Size Limits**

| Type | Limit |
|------|--------|
| Individual File | 100 MB |
| Total Push | 1 GB |

### **Debug Mode**

Enable detailed logs:

```bash
tnc-cli --debug push --room 64a1b2c3d4e5f6a1b2c3d4e5 ./path/
```

---

## 🔒 Security Guidelines

- **Never share** your `.tncrc` file — it stores encrypted tokens  
- **Never commit** `.tncrc` to Git or any version control  
- Use `.ignoretnc` to exclude sensitive files  
- Rotate API tokens regularly  
- Validate room access before pushing confidential data  

---

## 💡 Best Practices

- Use environment variables for automated environments  
- Review `.ignoretnc` before each push  
- Run `--dry-run` to preview changes  
- Monitor push logs for unexpected files  

---

## 🧭 Command Reference

| Command | Description |
|----------|-------------|
| `tnc-cli login` | Authenticate with ThinkNCollab |
| `tnc-cli logout` | Clear credentials |
| `tnc-cli whoami` | Show current user info |
| `tnc-cli push --room <id> <path>` | Push files/folders to a room |
| `tnc-cli rooms list` | List all accessible rooms |
| `tnc-cli rooms info <id>` | Show room details |
| `tnc-cli --version` | Show CLI version |
| `tnc-cli --help` | Show help information |

---

## 🧩 Resources & Support

- 📘 **Documentation:** [docs.thinkncollab.com/cli](https://thinkncollab.com/cli)  
  
- ✉️ **Email:** support@thinkncollab.com  
- 💬 **Community:** Join our [ThinkNCollab Discord](https://discord.gg/thinkncollab)

---

## 📄 License

MIT License – see `LICENSE` file for details.
