# Quick Push Instructions

## Option 1: Use Personal Access Token (Fastest)

1. Go to: https://github.com/settings/tokens
2. Generate new token (classic) with `repo` permissions
3. Run this command (replace YOUR_TOKEN):

```powershell
cd D:\Project\chhapai
git remote set-url origin https://YOUR_TOKEN@github.com/Nikhil4sharma/chhapai.git
git push origin main
git remote set-url origin https://github.com/Nikhil4sharma/chhapai.git
```

## Option 2: Use GitHub CLI (Recommended)

```powershell
cd D:\Project\chhapai
gh auth login
git push origin main
```

## Option 3: Clear Windows Credentials

1. Open Windows Credential Manager
2. Go to Windows Credentials
3. Find `git:https://github.com`
4. Remove it
5. Then push - Windows will prompt for new credentials

