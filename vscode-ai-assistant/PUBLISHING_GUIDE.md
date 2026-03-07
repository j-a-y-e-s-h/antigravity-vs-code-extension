# 📦 Antigravity Extension Publishing Guide

There are two primary ways to "upload" or distribute your VS Code extension: **Packaging and Local Sharing** (VSIX) or **Official Marketplace Publishing**.

---

## 🛠️ Prerequisites
You need the official VS Code Extension Manager (`vsce`) installed globally on your machine:
```bash
npm install -g @vscode/vsce
```

---

## 1. Local Packaging (.vsix)
Use this if you want to create a single installer file (`.vsix`) that you can send to others or upload to your GitHub Release page.

### Step 1: Update `package.json`
Open `vscode-ai-assistant/package.json` and ensure your `publisher` and `version` are correct:
```json
{
  "publisher": "j-a-y-e-s-h",  // Change this to your unique publisher name
  "version": "1.0.0"
}
```

### Step 2: Package the Extension
Run this command from the `vscode-ai-assistant` folder:
```bash
vsce package
```
This will generate a file named `ai-ide-assistant-1.0.0.vsix`. 

### How to Install it:
1. Open VS Code.
2. Go to the **Extensions** view (`Ctrl+Shift+X`).
3. Click the `...` (top right) → **Install from VSIX...**
4. Select your `.vsix` file.

---

## 2. Official Marketplace Publishing
Use this to make your extension searchable and installable by anyone directly from VS Code.

### Step 1: Create a Publisher Account
1. Go to the [Visual Studio Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. Create a **Publisher** (e.g., `j-a-y-e-s-h`). Use the same name in your `package.json`.

### Step 2: Get a Personal Access Token (PAT)
1. Log in to [Azure DevOps](https://dev.azure.com/).
2. Click **User Settings** (top right) → **Personal Access Tokens**.
3. Create a new token:
   - **Organization**: All accessible organizations.
   - **Scopes**: Custom defined → Marketplace (Publish).
4. **Important**: Copy this token immediately!

### Step 3: Login and Publish
Run these commands in your terminal:
```bash
# Login with your PAT
vsce login <your-publisher-name>

# Publish to the world!
vsce publish
```

---

## 💡 Best Practices
- **README**: Ensure your `README.md` is in the `vscode-ai-assistant` folder (it will be shown on the Marketplace).
- **Icon**: Add an `icon` field to `package.json` to make it look professional.
- **License**: Ensure you have a `LICENSE` file in the root.

---

## 🚀 Final Recommendation
For your current stage, **Option 1 (VSIX)** is the best starting point. Upload the `.vsix` file to your [GitHub repository](https://github.com/j-a-y-e-s-h/antigravity-vs-code-extension) under "Releases" so people can download and install it manually!
