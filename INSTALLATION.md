# Netflix Architecture Project - Installation Guide

**For all team members: Follow these steps EXACTLY to ensure everyone has the same setup.**

---

## Overview

This guide covers installing and configuring three databases:
1. **PostgreSQL** - Relational database (ACID compliance)
2. **MongoDB** - NoSQL database (flexible documents)
3. **Redis** - In-memory cache (ultra-fast)

**Important:** Install all software in `D:\Netflix\` to keep the C: drive clean and consistent across the team.

---

## Prerequisites

- Windows 10 or Windows 11
- Administrator access
- At least 5GB free space on D: drive
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

### Step 1.3: Choose Installation Directory

**THIS IS IMPORTANT - DO NOT SKIP:**

1. When asked "Installation Directory", change it to:
   ```
   D:\Netflix\PostgreSQL
   ```
   (If D:\Netflix doesn't exist, create it first)

2. Click **Next**

### Step 1.4: Select Components

1. Keep these **CHECKED**:
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (GUI tool for managing databases)
   - ✅ Command Line Tools
   - ✅ Development Libraries

2. Uncheck:
   - ☐ Stack Builder

3. Click **Next**

### Step 1.5: Data Directory

1. Keep the default or change to:
   ```
   D:\Netflix\PostgreSQL\data
   ```

2. Click **Next**

### Step 1.6: Set Superuser Password

**IMPORTANT - REMEMBER THIS PASSWORD!**

1. Username will be: `postgres` (leave as default)
2. Set a password (example: `netflix123` or `postgres`)
3. **Write this down somewhere safe!**
4. Confirm the password
5. Click **Next**

### Step 1.7: Port Number

1. Keep the default port: `5432`
2. Click **Next**

### Step 1.8: Locale

1. Keep default locale
2. Click **Next**

### Step 1.9: Summary

1. Review the installation summary
2. Click **Next** to proceed

### Step 1.10: Finish Installation

1. Wait for installation to complete (2-3 minutes)
2. Uncheck **"Launch Stack Builder"** (we don't need it)
3. Click **Finish**

### Step 1.11: Add PostgreSQL to Windows PATH

**This allows you to use `psql` command from any Command Prompt**

1. Press **Windows Key + R**
2. Type: `sysdm.cpl`
3. Press **Enter**
4. Click **Environment Variables** button (bottom right)
5. Under "System variables", find **Path**
6. Click it → Click **Edit**
7. Click **New**
8. Add this path:
   ```
   D:\Netflix\PostgreSQL\bin
   ```
9. Click **OK** → **OK** → **OK**

### Step 1.12: Verify PostgreSQL Installation

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
   When prompted, enter the password you set in Step 1.6

5. You should see:
   ```
   postgres=#
   ```

6. Exit PostgreSQL:
   ```bash
   \q
   ```

✅ **PostgreSQL is now installed and working!**

### Step 1.13: Create Netflix Database

1. Open Command Prompt
2. Connect to PostgreSQL:
   ```bash
   psql -U postgres
   ```
   (Enter your password)

3. Create the database:
   ```sql
   CREATE DATABASE netflix_db;
   ```

4. Connect to it:
   ```sql
   \c netflix_db
   ```

5. Create the tables (paste this entire block):
   ```sql
   CREATE TABLE users (
       user_id SERIAL PRIMARY KEY,
       email VARCHAR(255) UNIQUE NOT NULL,
       password VARCHAR(255) NOT NULL,
       first_name VARCHAR(100),
       last_name VARCHAR(100),
       subscription_type VARCHAR(50) DEFAULT 'free',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE subscriptions (
       subscription_id SERIAL PRIMARY KEY,
       user_id INT NOT NULL,
       plan VARCHAR(50),
       price DECIMAL(10, 2),
       renewal_date DATE,
       status VARCHAR(50) DEFAULT 'active',
       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
   );

   CREATE TABLE billing (
       billing_id SERIAL PRIMARY KEY,
       user_id INT NOT NULL,
       transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       amount DECIMAL(10, 2),
       payment_method VARCHAR(50),
       status VARCHAR(50) DEFAULT 'completed',
       FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
   );
   ```

6. Verify tables were created:
   ```bash
   \dt
   ```
   You should see all 3 tables listed

7. Exit:
   ```bash
   \q
   ```

✅ **PostgreSQL setup complete!**

---

## Part 2: MongoDB Installation

### Step 2.1: Download MongoDB

1. Go to: https://www.mongodb.com/try/download/community
2. Select **Windows** from the dropdown
3. Select **Windows (x86_64)** 
4. Download the **MSI file** (not ZIP)
5. Save to your Downloads folder

### Step 2.2: Run the Installer

1. **Double-click** the MongoDB installer (`.msi` file)
2. Click **Next** on the welcome screen
3. Accept the license agreement
4. Click **Next**

### Step 2.3: Choose Installation Directory

**THIS IS IMPORTANT - DO NOT SKIP:**

1. When asked "Service Configuration", change the path to:
   ```
   D:\Netflix\MongoDB
   ```

2. Click **Next**

### Step 2.4: MongoDB Service Setup

1. Keep these **CHECKED**:
   - ✅ Install MongoDB as a Windows Service
   - ✅ Run the service as Network Service user (default)
   - ✅ Install MongoDB Compass (optional but useful)

2. Click **Next**

### Step 2.5: Finish Installation

1. Review summary
2. Click **Install**
3. Wait for installation to complete (2-3 minutes)
4. Click **Finish**

### Step 2.6: Add MongoDB to Windows PATH

1. Press **Windows Key + R**
2. Type: `sysdm.cpl`
3. Click **Environment Variables**
4. Find **Path** → Click **Edit**
5. Click **New**
6. Add this path:
   ```
   D:\Netflix\MongoDB\bin
   ```
7. Click **OK** → **OK** → **OK**

### Step 2.7: Verify MongoDB Installation

1. **Close all Command Prompt windows**
2. **Open a NEW Command Prompt**
3. Run:
   ```bash
   mongosh --version
   ```
   You should see a version number

4. Connect to MongoDB:
   ```bash
   mongosh
   ```
   You should see:
   ```
   Current Mongosh Log ID: ...
   Connecting to: mongodb://127.0.0.1:27017/?directConnection=true
   ```

5. Exit MongoDB:
   ```bash
   exit
   ```

✅ **MongoDB is now installed and working!**

### Step 2.8: Create Netflix Database and Collections

1. Open Command Prompt
2. Connect to MongoDB:
   ```bash
   mongosh
   ```

3. Create the database:
   ```javascript
   use netflix_db
   ```

4. Create collections (paste this entire block):
   ```javascript
   db.createCollection("videos");
   db.createCollection("preferences");
   db.createCollection("metadata");
   db.createCollection("viewing_history");
   ```

5. Verify collections were created:
   ```javascript
   show collections
   ```
   You should see all 4 collections listed

6. Insert sample video document:
   ```javascript
   db.videos.insertOne({
       title: "Breaking Bad",
       genre: "Drama",
       release_year: 2008,
       rating: 9.5,
       description: "A high school chemistry teacher turns to producing meth"
   });
   ```

7. Verify it was inserted:
   ```javascript
   db.videos.findOne()
   ```

8. Exit:
   ```javascript
   exit
   ```

✅ **MongoDB setup complete!**

---

## Part 3: Redis Installation

### Step 3.1: Download Redis

Redis doesn't have an official Windows installer. We'll use the Windows Community Build:

1. Go to: https://github.com/microsoftarchive/redis/releases
2. Download **Redis-x64-3.2.100.msi** (latest version available)
3. Save to your Downloads folder

Alternatively, download from: https://redis.io/download

### Step 3.2: Run the Installer

1. **Double-click** the Redis installer
2. Click **Next** on the welcome screen

### Step 3.3: Choose Installation Directory

**THIS IS IMPORTANT - DO NOT SKIP:**

1. When asked "Destination Folder", change it to:
   ```
   D:\Netflix\Redis
   ```

2. Click **Next**

### Step 3.4: Redis Configuration

1. Keep the default port: `6379`
2. Check: ✅ **Add Redis to Windows Services**
3. Click **Install**
4. Wait for installation to complete
5. Click **Finish**

### Step 3.5: Add Redis to Windows PATH

1. Press **Windows Key + R**
2. Type: `sysdm.cpl`
3. Click **Environment Variables**
4. Find **Path** → Click **Edit**
5. Click **New**
6. Add this path:
   ```
   D:\Netflix\Redis
   ```
7. Click **OK** → **OK** → **OK**

### Step 3.6: Verify Redis Installation

1. **Close all Command Prompt windows**
2. **Open a NEW Command Prompt**
3. Run:
   ```bash
   redis-cli --version
   ```
   You should see a version number

4. Connect to Redis:
   ```bash
   redis-cli
   ```
   You should see:
   ```
   127.0.0.1:6379>
   ```

5. Test Redis:
   ```bash
   PING
   ```
   You should see: `PONG`

6. Set a test key:
   ```bash
   SET mykey "Hello Redis"
   ```

7. Get the value:
   ```bash
   GET mykey
   ```
   You should see: `"Hello Redis"`

8. Exit:
   ```bash
   EXIT
   ```

✅ **Redis is now installed and working!**

---

## Verification Checklist

**After completing all installations, verify everything works:**

- [ ] PostgreSQL: `psql --version` returns version number
- [ ] PostgreSQL: Can connect with `psql -U postgres`
- [ ] PostgreSQL: Database `netflix_db` exists
- [ ] PostgreSQL: Tables `users`, `subscriptions`, `billing` exist
- [ ] MongoDB: `mongosh --version` returns version number
- [ ] MongoDB: Can connect with `mongosh`
- [ ] MongoDB: Database `netflix_db` exists
- [ ] MongoDB: Collections created successfully
- [ ] Redis: `redis-cli --version` returns version number
- [ ] Redis: Can connect with `redis-cli`
- [ ] Redis: `PING` command returns `PONG`

---

## Quick Reference: Common Commands

### PostgreSQL
```bash
# Connect to PostgreSQL
psql -U postgres

# List all databases
\l

# Connect to a database
\c netflix_db

# List all tables
\dt

# Exit PostgreSQL
\q
```

### MongoDB
```bash
# Connect to MongoDB
mongosh

# Show all databases
show databases

# Use/create a database
use netflix_db

# Show all collections
show collections

# Exit MongoDB
exit
```

### Redis
```bash
# Connect to Redis
redis-cli

# Check if Redis is running
PING

# Set a key-value pair
SET key value

# Get a value
GET key

# Delete a key
DEL key

# Exit Redis
EXIT
```

---

## Troubleshooting

### PostgreSQL won't connect
- Check if service is running: Open Services, look for PostgreSQL
- Verify password is correct (set during installation)
- Make sure port 5432 is not blocked

### MongoDB won't connect
- Check if service is running: Open Services, look for MongoDB
- Verify port 27017 is not blocked
- Try restarting the MongoDB service

### Redis won't connect
- Check if service is running: Open Services, look for Redis
- Verify port 6379 is not blocked
- Try restarting the Redis service

### Commands not found
- Make sure PATH was added correctly
- Restart Command Prompt after adding PATH
- Check that installation directories are correct

---

## Final Folder Structure

After all installations, your system should look like this:

```
C:\Users\BLACHADI\Desktop\Netflix_Architecture\
├── databases/
│   ├── postgresql_schema.sql
│   ├── mongodb_schema.js
│   └── redis_config.conf
├── scripts/
│   ├── generate_users.py
│   ├── generate_videos.py
│   └── requirements.txt
├── frontend/
├── README.md
└── INSTALLATION.md (this file)

D:\Netflix\
├── PostgreSQL/          ← PostgreSQL software & data
├── MongoDB/             ← MongoDB software & data
└── Redis/               ← Redis software & data
```

---

## Next Steps

1. ✅ All three databases installed and verified
2. ⏳ Run Python data generation scripts
3. ⏳ Set up Node.js/Express backend
4. ⏳ Build frontend UI
5. ⏳ Connect everything together

---

**Questions? Ask your team lead or check the main README.md**
