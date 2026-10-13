# Netflix Architecture Project Installation Guide

**For all team members: Follow these steps EXACTLY to ensure everyone has the same setup.**

---

## Overview

This guide covers installing and configuring **PostgreSQL** , **MongoDB** , **Redis**

**Important:** Create a folder structure to keep everything organized:
```
Netflix/
├── PostgreSQL/          ← PostgreSQL software & data (you'll create this)
├── MongoDB/             ← For future use
└── Redis/               ← For future use
```

You can place this `Netflix/` folder anywhere on your computer (C:, D:, or E: drive - doesn't matter).


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

## Part 2: MongoDB Installation (NoSQL Engine)

### Step 2.1: Download the Database Engine
1. Go to: https://www.mongodb.com/try/download/community
2. Click Select Package
3. Ensure the following settings are selected: 
   * **Version**: `9.0.x` (Current Stable)
   * **Platform**: `Windows`
   * **Package**: `MSI`
4. Click **Download** to save the setup file.

### Step 2.2: Setup & Directory Alignment
**BEFORE running the setup file, create a folder called `MongoDB` inside your master `Netflix/` folder:**
1. Open Windows File Explorer and navigate to your `Netflix/` folder.
2. Create a clean subfolder named: `MongoDB`
3. Run the installer wizard, accept the agreement conditions, and click **Next**.
4. Choose the **Custom** installation type when prompted.
5. Click the **Browse** button next to the installation path field, and change it to point directly to your folder:
   *Example: `D:\Netflix\MongoDB` (or whatever drive you chose).*
6. Ensure **"Install MongoDB as a Service"** and **"Install MongoDB Compass"** are both checked. Click **Next**, click **Install**, and then select **Finish**.

### Step 2.3: Standalone Shell Tool Configuration (`mongosh`)
*⚠️ **Important**: Modern MongoDB server packages no longer bundle the interactive terminal shell (`mongosh`) natively. You must download it separately to run database terminal commands.*

1. Go to: https://www.mongodb.com/try/download/shell
2. Ensure the **Platform** is set to **Windows 64-bit (10+)** and the **Package** type is set to **MSI**. Click **Download**.
3. Run the installer package and click **Next**.
4. When the installer wizard asks for the installation directory, click **Browse** and force it to drop the utility files directly into the core binaries path you used in step 2.2:
   `D:\Netflix\MongoDB\Server\9.0\bin\` *(make sure to adjust the starting drive letter to match your Netflix folder).*
5. Complete the setup wizard by clicking **Install** and then **Finish**.

### Step 2.4: Update Environment Variables (PATH)
1. Press **Windows Key + R**, type `sysdm.cpl`, and press **Enter**.
2. Click the **Environment Variables** button (bottom right).
3. Under "System variables", select the **Path** option and click **Edit**.
4. Click **New** and add the absolute path pointing to your MongoDB binaries folder:
   `D:\Netflix\MongoDB\Server\9.0\bin` *(make sure to adjust the starting drive letter to match your Netflix folder).*
5. Click **OK** on all active prompts to save configurations.

### Step 2.5: Final Shell Verification
1. Close all open Command Prompt windows and open a **brand-new Command Prompt**.
2. Run this evaluation verification command:
   ```bash
   mongosh --version
   ```
   *(If it returns a version number string like `2.13.x`, your local shell tool can talk to the database service cleanly!)*

## Part 3: Redis Installation (In-Memory Caching Layer)

### Step 3.1: Download the Redis Archive
* Go to: https://github.com/tporadowski/redis/releases
* Under assets download the clean, native Windows executable `.zip` distribution archive.
* *Recommended package version*: `Redis-x64-5.0.14.1.zip`

### Step 3.2: Setup & Directory Alignment
**BEFORE extracting any compressed data, create a folder called `Redis` inside your `Netflix/` folder:**
1. Open Windows File Explorer and navigate straight inside your unified `Netflix/` workspace directory.
2. Create a clean subfolder named exactly: `Redis`
3. Extract all content from your downloaded `.zip` file directly into this new path:
   *Example target destination: `D:\Netflix\Redis\` (adjust drive letter to match your workspace).*
4. Extract the .zip file inside the Redis folder that you created.

### Step 3.3: Configure Windows Environment Variables (PATH)
1. Press `Windows Key + R`, type `sysdm.cpl`, and hit Enter.
2. Navigate to **Advanced** -> **Environment Variables**.
3. Under **System variables** (bottom section), select **Path** and click **Edit**.
4. Click **New** and add your explicit binary path location:
   ```text
   D:\Netflix\Redis
   ```
   *(Adjust starting drive letter to match your master folder location).*
5. Click **OK** on all prompt blocks to save configurations.

### Step 3.4: Verification & Execution Terminal Check
1. Open a **NEW Command Prompt** window, switch to your target drive partition, and navigate into your workspace:
   ```bash
   D:
   cd D:\Netflix\Redis
   ```
2. Turn on the cache system database server engine using our local configurations:
   ```bash
   redis-server redis.windows.conf
   ```
3. Open a **second separate Command Prompt window** while leaving the server running, and check structural latency connection flags using the client terminal command utility:
   ```bash
   redis-cli
   ```
4. Run the ping tracking validation string check:
   ```text
   ping
   ```
   *(If it immediately returns a sharp **`PONG`** response statement, your memory cache layer is completely synchronized and functional!)*

