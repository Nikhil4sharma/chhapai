@echo off
echo ========================================
echo   GitHub Push Script - Chhapai Project
echo ========================================
echo.

REM Check if git is initialized
if not exist .git (
    echo [1/6] Initializing Git repository...
    git init
    echo ✓ Git initialized
) else (
    echo [1/6] Git repository already exists
)

echo.
echo [2/6] Checking current status...
git status

echo.
echo [3/6] Adding all files...
git add .
echo ✓ Files added

echo.
echo [4/6] Committing changes...
set /p COMMIT_MSG="Enter commit message (or press Enter for default): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update: Complete codebase with all latest changes
git commit -m "%COMMIT_MSG%"
echo ✓ Changes committed

echo.
echo [5/6] Checking remote...
git remote -v

echo.
echo [6/6] Ready to push!
echo.
echo IMPORTANT: Make sure you have:
echo   1. Created GitHub repository
echo   2. Added remote: git remote add origin YOUR_REPO_URL
echo   3. Set branch: git branch -M main
echo.
set /p PUSH_NOW="Push to GitHub now? (y/n): "
if /i "%PUSH_NOW%"=="y" (
    echo.
    echo Pushing to GitHub...
    git push -u origin main
    echo.
    echo ✓ Push complete!
) else (
    echo.
    echo To push manually, run:
    echo   git push -u origin main
)

echo.
echo ========================================
echo   Done!
echo ========================================
pause

