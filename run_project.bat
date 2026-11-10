@echo off
title SmartVote System Launcher
echo ===================================================
echo   Starting SmartVote Campus Voting System
echo ===================================================

echo [*] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "SmartVote Backend (FastAPI)" cmd /k "backend\venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

echo [*] Launching Next.js Frontend on http://localhost:3000 ...
start "SmartVote Frontend (Next.js)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   Services are running!
echo   - Web Portal: http://localhost:3000
echo   - API Server: http://127.0.0.1:8000
echo   - API Docs:   http://127.0.0.1:8000/docs
echo ===================================================

timeout /t 3 >nul
start http://localhost:3000
