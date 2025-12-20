# ⚡ Quick Push Commands

## 🚀 One-Time Setup (First Time Only)

```bash
# 1. Git initialize
cd D:\Project\chhapai
git init

# 2. Add all files
git add .

# 3. First commit
git commit -m "Initial commit: Complete Order Flow Tool codebase"

# 4. Add remote (YOUR_USERNAME aur REPO_NAME replace karo)
git remote add origin https://github.com/YOUR_USERNAME/chhapai-order-flow.git

# 5. Rename branch to main
git branch -M main

# 6. Push to GitHub
git push -u origin main
```

---

## 🔄 Regular Updates (After First Push)

```bash
# 1. Check status
git status

# 2. Add changes
git add .

# 3. Commit
git commit -m "Update: Description of changes"

# 4. Push
git push
```

---

## 🔐 Authentication

**Personal Access Token use karo:**
- Username: GitHub username
- Password: Personal Access Token (GitHub → Settings → Developer settings → Personal access tokens)

**Ya GitHub CLI:**
```bash
gh auth login
git push
```

---

## ✅ Verify Push

GitHub repository page pe check karo:
- https://github.com/YOUR_USERNAME/chhapai-order-flow

---

**Note:** Pehli baar push karte waqt authentication chahiye. Personal Access Token ya GitHub CLI use karo.
