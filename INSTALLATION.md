# Netflix Architecture Project Installation Guide

**For all team members: Follow these steps EXACTLY to ensure everyone has the same setup.**

---

## Overview

This guide covers setting up everything you need to run the project on **Windows**:

| Part | Tool | How it runs |
|---|---|---|
| 1 | **PostgreSQL** (relational database) | Installed natively on Windows |
| 2 | **Redis** (in-memory cache) | Installed natively on Windows |
| 3 | **Docker Desktop** and **Node.js** | Tools you install once |
| 4 | **Kafka, ZooKeeper, Cassandra, Flink and the Zuul gateway** | Run in Docker with one command (`docker-compose.yml`) |
| 5 | Daily start-up checklist and troubleshooting | |

**Important:** Create a folder structure to keep everything organized:
```
Netflix/
├── PostgreSQL/          ← PostgreSQL software & data (you'll create this)
└── Redis/               ← Redis (you'll create this)
```

You can place this `Netflix/` folder anywhere on your computer (C:, D:, or E: drive - doesn't matter).

The project code itself comes from the GitHub repository (see `README.md`), not from this folder.


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
   D:\Netflix\PostgreSQL\bin
   ```
   (Replace the starting drive letter `D:` with the drive where your `Netflix/` folder is.)

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

## Part 2: Redis Installation (In-Memory Caching Layer)

### Step 2.1: Download the Redis Archive
* Go to: https://github.com/tporadowski/redis/releases
* Under assets download the clean, native Windows executable `.zip` distribution archive.
* *Recommended package version*: `Redis-x64-5.0.14.1.zip`

### Step 2.2: Setup & Directory Alignment
**BEFORE extracting any compressed data, create a folder called `Redis` inside your `Netflix/` folder:**
1. Open Windows File Explorer and navigate straight inside your unified `Netflix/` workspace directory.
2. Create a clean subfolder named exactly: `Redis`
3. Extract all content from your downloaded `.zip` file directly into this new path:
   *Example target destination: `D:\Netflix\Redis\` (adjust drive letter to match your workspace).*
4. Extract the .zip file inside the Redis folder that you created.

### Step 2.3: Configure Windows Environment Variables (PATH)
1. Press `Windows Key + R`, type `sysdm.cpl`, and hit Enter.
2. Navigate to **Advanced** -> **Environment Variables**.
3. Under **System variables** (bottom section), select **Path** and click **Edit**.
4. Click **New** and add your explicit binary path location:
   ```text
   D:\Netflix\Redis
   ```
   *(Adjust starting drive letter to match your master folder location).*
5. Click **OK** on all prompt blocks to save configurations.

### Step 2.4: Verification & Execution Terminal Check
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

### Step 2.5: Run Redis as a Windows service

Without this, Redis only runs while the `redis-server` window is open, and the backend will fail with "connection refused" if you forget to start it.

1. Close the window running `redis-server` (Ctrl + C).
2. Open **Command Prompt as Administrator** and run:
   ```bash
   cd D:\Netflix\Redis
   redis-server --service-install redis.windows.conf
   redis-server --service-start
   ```
3. Check again with `redis-cli`, then `ping` (you should get `PONG`).

From now on Redis starts automatically with Windows.

✅ **Redis is now installed and working!**

---

## Part 3: Docker Desktop and Node.js

### Step 3.1: Install Docker Desktop

1. Go to: https://www.docker.com/products/docker-desktop/
2. Download and run the Windows installer, keep the default options (WSL 2 backend).
3. Restart your computer if the installer asks.
4. Start **Docker Desktop** and wait until it says Docker is running.
5. Open a **new Command Prompt** and check:
   ```bash
   docker --version
   docker compose version
   ```
   *(On older Docker Desktop versions the second command is `docker-compose --version`. Use whichever works on your PC, and replace `docker compose` with `docker-compose` in the commands below.)*

### Step 3.2: Install Node.js

1. Go to: https://nodejs.org
2. Download the **LTS** version for Windows and run the installer with the default options.
3. Open a **new Command Prompt** and check:
   ```bash
   node --version
   npm --version
   ```

✅ **Docker and Node.js are ready.**

---

## Part 4: Start the Docker Infrastructure (Kafka, Cassandra, Flink, Zuul)

All of these run from the single file `docker-compose.yml` at the root of the repository.

### Step 4.1: Get the project

```bash
git clone https://github.com/ChadiBlal/netflix-architecture.git
cd netflix-architecture
```

### Step 4.2: (Optional) Choose where Cassandra stores its data

By default Docker keeps Cassandra's data in a normal Docker volume, so you can skip this step.
If you want the data in a specific folder, copy `.env.example` to `.env` and uncomment the `CASSANDRA_DATA` line with your own path.

### Step 4.3: Start everything

Make sure **Docker Desktop is running**, then:

```bash
docker compose up -d --build
```

- The **first run takes several minutes**: Docker downloads the images and builds the Zuul gateway.
- Cassandra needs about a minute after starting before it accepts connections.

### Step 4.4: Verify

```bash
docker compose ps
```

All services should show as running. Then check in your browser:

| What | Address |
|---|---|
| Flink dashboard | http://localhost:8081 |
| Zuul gateway health check | http://localhost:8080/healthcheck |

### Useful commands

| Goal | Command |
|---|---|
| Stop everything (data is kept) | `docker compose down` |
| Start again | `docker compose up -d` |
| See logs of one service | `docker compose logs -f kafka` |
| Delete everything **including data** | `docker compose down -v` (careful!) |

✅ **The infrastructure is running.**

---

## Part 5: Daily Start-up Checklist and Troubleshooting

### Ports used by the project

| Component | Address | Where it runs |
|---|---|---|
| Zuul API Gateway | `localhost:8080` | Docker |
| Account Service | `localhost:5001` | Windows (Node.js) |
| Playback & Catalogue Service | `localhost:5002` | Windows (Node.js) |
| PostgreSQL | `localhost:5432` | Windows |
| Redis | `localhost:6379` | Windows |
| Kafka (from Windows) | `localhost:9092` | Docker |
| Kafka (from inside Docker, e.g. Flink) | `kafka:19092` | Docker |
| Cassandra | `localhost:9042` | Docker |
| Flink dashboard | `localhost:8081` | Docker |

### Start-up order

1. Start **PostgreSQL** (it starts automatically with Windows after installation).
2. Start **Redis** (automatic if you did Step 2.5, otherwise run `redis-server redis.windows.conf`).
3. Start **Docker Desktop**, then run `docker compose up -d` in the repository.
4. Start the two Node.js services (ports 5001 and 5002).
5. Open the frontend.

### Common problems

| Problem | Likely cause and fix |
|---|---|
| Backend shows "connection refused" on port 6379 | Redis is not running. Start it (see start-up order). |
| Backend cannot connect to PostgreSQL | Check the service is running and that you use the same password, port (5432) and database name as the team. |
| `docker compose` fails immediately | Docker Desktop is not running. Start it and wait until it is ready. |
| Request to `localhost:8080/api/...` returns a 5xx error | Zuul cannot reach your Node.js service. Check the service is running on port 5001 or 5002. Windows Firewall may also ask to allow Node.js, click **Allow**. |
| Port already in use | Another program uses that port. Close it, or stop the container that uses it. |
| Cassandra connection fails right after start | Wait about a minute and try again. |
