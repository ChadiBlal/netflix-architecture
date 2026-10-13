# Netflix Architecture Project - PostgreSQL Installation Guide

**For all team members: Follow these steps EXACTLY to ensure everyone has the same setup.**

---

## Overview

This guide covers installing and configuring **PostgreSQL** - the relational database for user accounts, subscriptions, and billing.

**Important:** Create a folder structure to keep everything organized:
```
Netflix/
├── PostgreSQL/          ← PostgreSQL software & data (you'll create this)
├── MongoDB/             ← For future use
└── Redis/               ← For future use
```

You can place this `Netflix/` folder anywhere on your computer (C:, D:, or E: drive - doesn't matter).

---

## Prerequisites

- Windows 10 or Windows 11
- Administrator access
- At least 2GB free space on your hard drive
- Internet connection

---

## Part 1: PostgreSQL Installation

### Step 1.1: Download PostgreSQL

1. Go to: https://www.postgresql.org/download/windows/
2. Click the **"Download the installer"** link
3. Download **PostgreSQL 18.x** (latest stable version)
4. Choose the **Windows x86-64** version
5. **Save the file** to your Downloads folder

### Step 1.2: Run the Installer

1. **Double-click** the PostgreSQL installer (`.exe` file)
2. Click **Next** on the welcome screen

### Step 1.3: Create Your Netflix Folder

**BEFORE you run the installer, create your folder structure:**

1. Open File Explorer
2. Choose ANY location (C:, D:, E: drive - doesn't matter)
3. Create a folder called: `Netflix`
4. Inside `Netflix`, create a subfolder called: `PostgreSQL`

**Example paths (pick ONE):**
- `C:\Netflix\PostgreSQL` (Windows C: drive)
- `D:\Netflix\PostgreSQL` (External drive D:)
- `E:\Netflix\PostgreSQL` (External drive E:)

Now when the installer asks for the installation directory, use the path you created above.

### Step 1.4: Run Installer & Choose Installation Directory

1. When the installer asks "Installation Directory", change it to your Netflix\PostgreSQL folder
   - Example: `D:\Netflix\PostgreSQL` (or whatever drive you chose)

2. Click **Next**

### Step 1.5: Select Components

1. Keep these **CHECKED**:
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (GUI tool for managing databases)
   - ✅ Command Line Tools
   - ✅ Development Libraries

2. Uncheck:
   - ☐ Stack Builder

3. Click **Next**

### Step 1.6: Data Directory

1. Keep the default or it will automatically go to your Netflix\PostgreSQL folder
2. Click **Next**

### Step 1.7: Set Superuser Password

**IMPORTANT - REMEMBER THIS PASSWORD!**

1. Username will be: `postgres` (leave as default)
2. Set a password (example: `netflix123`)
3. **Write this down somewhere safe!**
4. Confirm the password
5. Click **Next**

### Step 1.8: Port Number

1. Keep the default port: `5432`
2. Click **Next**

### Step 1.9: Locale

1. Keep default locale
2. Click **Next**

### Step 1.10: Summary

1. Review the installation summary
2. Click **Next** to proceed

### Step 1.11: Finish Installation

1. Wait for installation to complete (2-3 minutes)
2. Uncheck **"Launch Stack Builder"** (we don't need it)
3. Click **Finish**

### Step 1.12: Add PostgreSQL to Windows PATH

**This allows you to use `psql` command from any Command Prompt**

1. Press **Windows Key + R**
2. Type: `sysdm.cpl`
3. Press **Enter**
4. Click **Environment Variables** button (bottom right)
5. Under "System variables", find **Path**
6. Click it → Click **Edit**
7. Click **New**
8. Add the path to your PostgreSQL bin folder:
   ```
   C:\Netflix\PostgreSQL\bin
   ```
   (Or replace C: with whatever drive you used: D:\Netflix\PostgreSQL\bin, etc.)

9. Click **OK** → **OK** → **OK**

### Step 1.13: Verify PostgreSQL Installation

1. **Close all Command Prompt windows**
2. **Open a NEW Command Prompt**
3. Run this command:
   ```bash
   psql --version
   ```
   You should see: `psql (PostgreSQL) 18.x`

4. Connect to PostgreSQL:
   ```bash
   psql -U postgres
   ```
   When prompted, enter the password you set in Step 1.7

5. You should see:
   ```
   postgres=#
   ```

6. Exit PostgreSQL:
   ```bash
   \q
   ```

✅ **PostgreSQL is now installed and working!**

---

## Verification Checklist

**After completing PostgreSQL installation, verify everything works:**

- [ ] PostgreSQL: `psql --version` returns version number
- [ ] PostgreSQL: Can connect with `psql -U postgres`
- [ ] PostgreSQL service is running in Windows Services

---

## Basic PostgreSQL Commands (Reference)

```bash
# Connect to PostgreSQL
psql -U postgres

# Exit PostgreSQL
\q
```

---

## Troubleshooting

### PostgreSQL won't connect
- Check if service is running: Open Windows Services, look for PostgreSQL
- Verify password is correct (set during installation)
- Make sure port 5432 is not blocked

### Commands not found (psql is not recognized)
- Make sure PATH was added correctly to your Netflix\PostgreSQL\bin folder
- Restart Command Prompt after adding PATH
- Check that your PostgreSQL folder path is correct

### Can't create tables
- Make sure you connected to the `netflix_db` database with `\c netflix_db`
- Verify you pasted the entire SQL code from `postgresql_schema.sql`
- Check for any error messages and ask your team lead

---

## Your Folder Structure

After PostgreSQL installation, your folders should look like this:

```
Netflix/
├── PostgreSQL/          ← PostgreSQL software & data (you just installed this)
├── MongoDB/             ← For future use
└── Redis/               ← For future use
```

---

## 2. MongoDB & Standalone Shell Installation (NoSQL)

### 2.1 Server Engine Installation
* Download the official **MongoDB Community Server MSI** package using this link:
  👉 [Download MongoDB Community Server (Windows MSI)](https://mongodb.com)
  *(Make sure Version is set to 9.0.x, Platform is Windows, and Package is MSI)*
* Run the setup wizard, select **Complete**, and ensure **MongoDB Compass** is checked.
* Finish the installation wizard.

### 2.2 Custom Storage Partition Migration (Freeing Up 2.4GB on C:\)
If your main Windows drive is low on storage space, relocate the application files to another drive partition (e.g., `D:\` or `E:\`) via an administrative directory junction shortcut:
1. Open **Command Prompt as Administrator** and stop the engine:
   ```bash
   net stop MongoDB
   ```
2. Navigate to `C:\Program Files\`, **Cut** the entire `MongoDB` folder, and **Paste** it into your custom drive path (e.g., `D:\Netflix\`).
3. Run this exact shortcut creation command in your Administrator terminal:
   ```cmd
   mklink /J "C:\Program Files\MongoDB" "D:\Netflix\MongoDB"
   ```
4. Turn the engine background service back online:
   ```bash
   net start MongoDB
   ```

### 2.3 Standalone Shell Component Setup (`mongosh`)
* ⚠️ **Crucial Note**: Modern MongoDB server packages no longer bundle the command line terminal shortcut natively. You **MUST** download it separately.
* Download the standalone **MongoDB Shell MSI installer package** using this link:
  👉 [Download Standalone MongoDB Shell (Windows MSI)](https://mongodb.com)
  *(Ensure Platform is Windows 64-bit and Package is MSI)*
* Run the installer wizard and **explicitly change its installation destination directory** to point directly to your system directory binaries folder:
  ```text
  D:\Netflix\MongoDB\Server\9.0\bin\
  ```

### 2.4 Environment Variables Configuration (PATH)
* Open Windows **Environment Variables** (`sysdm.cpl`).
* Add this absolute path location directly into your **System Path variable list**:
  ```text
  D:\Netflix\MongoDB\Server\9.0\bin
  ```

### 2.5 Verification Command
* Open a fresh terminal window and test the shell connection directly:
  ```bash
  mongosh --version
  ```

## Next Steps

1. ✅ PostgreSQL installed and verified
2. ⏳ Database schema design (Presentation 3)
3. ⏳ Create database and tables (Presentation 3)
4. ⏳ Run Python data generation scripts
5. ⏳ Install MongoDB and Redis (when team is ready)
6. ⏳ Set up Node.js/Express backend
7. ⏳ Build frontend UI

---

**Questions? Ask your team lead or check the main README.md**
