# SmartVote Cloud Deployment Guide
### Complete Step-by-Step Instructions to Deploy SmartVote to the Cloud for Free

---

## Architecture Overview in Cloud
SmartVote consists of three components:
1. **PostgreSQL Database** (Stores users, decoupled votes, and audit logs)
2. **FastAPI Backend API** (Python 3.13 REST API + APScheduler clock)
3. **Next.js Frontend Portal** (Next.js 16 + React 19 web app)

---

## Method 1: The Recommended 100% Free Cloud Stack (Easiest & Most Stable)

This combination gives you free persistent hosting with custom HTTPS domains:
- **Database:** [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com) (Free serverless PostgreSQL)
- **Backend:** [Render.com](https://render.com) (Free Python web service)
- **Frontend:** [Vercel.com](https://vercel.com) (Free Next.js hosting by creators of Next.js)

### Step 1: Push Code to GitHub
1. Open PowerShell or Command Prompt in your project directory:
   ```bash
   git init
   git add .
   git commit -m "Deploy SmartVote to cloud"
   ```
2. Create a new repository on [GitHub](https://github.com/new) named `CollegeVotingSystem`.
3. Push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/CollegeVotingSystem.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Create Free Cloud PostgreSQL Database on Neon.tech
1. Go to [https://neon.tech](https://neon.tech) and sign up with GitHub (free forever tier).
2. Click **Create Project** -> Name it `smartvote-db`.
3. Copy the **Connection String** (it looks like):
   ```
   postgresql://smartvote_owner:abc123xyz@ep-fancy-pond-12345.us-east-2.aws.neon.tech/smartvote?sslmode=require
   ```

---

### Step 3: Deploy FastAPI Backend on Render.com
1. Go to [https://render.com](https://render.com) and sign in with GitHub.
2. Click **New +** -> **Web Service**.
3. Select your GitHub repository (`CollegeVotingSystem`).
4. Configure the settings:
   - **Name:** `smartvote-backend`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free`
5. Click **Advanced** -> **Add Environment Variable**:
   - `DATABASE_URL`: *(paste the Neon connection string from Step 2)*
   - `JWT_SECRET_KEY`: `super_secret_jwt_key_smartvote_2026_xyz`
   - `JWT_ALGORITHM`: `HS256`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `30`
   - `ENVIRONMENT`: `production`
6. Click **Create Web Service**.
7. Once deployed, copy your backend URL (e.g. `https://smartvote-backend.onrender.com`).

---

### Step 4: Run Initial Seeding on the Cloud Database
Once your backend is connected to the cloud database, populate the departments, elections, candidates, and student accounts:
1. In Render dashboard, open your `smartvote-backend` service.
2. Click the **Shell** tab.
3. Run:
   ```bash
   python seed.py
   ```
4. All 5 departments, 32 user accounts, and test elections are now created on your cloud database!

---

### Step 5: Deploy Next.js Frontend on Vercel
1. Go to [https://vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** -> **Project**.
3. Select `CollegeVotingSystem` from your GitHub repos.
4. In **Project Settings**:
   - **Root Directory:** Click `Edit` and select `frontend`.
   - **Framework Preset:** `Next.js`
5. In **Environment Variables**, add:
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: `https://smartvote-backend.onrender.com` *(your Render backend URL from Step 3 without trailing slash)*
6. Click **Deploy**.
7. In ~60 seconds, your site is live with a global HTTPS link like `https://college-voting-system.vercel.app`!

---

## Method 2: All-in-One Blueprint on Render (`render.yaml`)

We have already configured a `render.yaml` file in your repository:
1. Push your repository to GitHub.
2. In [Render.com](https://render.com), click **New +** -> **Blueprint**.
3. Select your `CollegeVotingSystem` repository.
4. Render will read `render.yaml` and automatically create:
   - Managed PostgreSQL database
   - FastAPI backend service
   - Next.js frontend service
   - Network links between them
5. Click **Apply**.

---

## Method 3: All-in-One Cloud Container on Railway.app

1. Go to [https://railway.app](https://railway.app) and sign in.
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Railway will detect your `docker-compose.yml` and launch PostgreSQL, FastAPI, and Next.js in a single project network.
4. You can also install the Railway plugin inside Antigravity to manage and inspect deployments directly from chat:
   `<plugin-card catalog-id="antigravity-plugins-partners/plugin/railway"></plugin-card>`

---

## Method 4: Single Cloud VM (AWS EC2 / DigitalOcean / Oracle Cloud Free Tier)

If your college provides a virtual server or you have an AWS/DigitalOcean account:
1. SSH into the cloud VM:
   ```bash
   ssh ubuntu@your-server-ip
   ```
2. Install Docker & Docker Compose:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose
   ```
3. Clone your code:
   ```bash
   git clone https://github.com/<your-username>/CollegeVotingSystem.git
   cd CollegeVotingSystem
   ```
4. Launch with one command:
   ```bash
   docker-compose up -d --build
   ```
5. Run the database seed:
   ```bash
   docker exec -it smartvote_backend python seed.py
   ```
6. Open `http://your-server-ip:3000` in your web browser!

