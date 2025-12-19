# 🔐 Git Authentication Setup for Private Repo

## Option 1: GitHub Personal Access Token (Recommended)

### Step 1: Create Token

1. **GitHub.com** → **Settings** (profile → Settings)
2. **Developer settings** (bottom left)
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token (classic)**
5. Settings:
   - **Note:** "chhapai-repo-access"
   - **Expiration:** 90 days (ya custom)
   - **Scopes:** ✅ `repo` (full control)
6. **Generate token**
7. **Copy token** (yeh sirf ek baar dikhega!)

### Step 2: Use Token

```bash
# Git credential helper setup
git config --global credential.helper manager-core

# Push with token
git push origin main
# Username: YOUR_GITHUB_USERNAME
# Password: PASTE_TOKEN_HERE (not actual password!)
```

---

## Option 2: SSH Key (Better Long-term)

### Step 1: Generate SSH Key

```bash
# Generate key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Press Enter for default location
# Enter passphrase (optional)
```

### Step 2: Add to GitHub

1. Copy public key:
```bash
cat ~/.ssh/id_ed25519.pub
```

2. GitHub → **Settings** → **SSH and GPG keys** → **New SSH key**
3. Paste key → **Add SSH key**

### Step 3: Change Remote to SSH

```bash
git remote set-url origin git@github.com:Nikhil4sharma/chhapai.git
git push origin main
```

---

## Option 3: GitHub CLI (Easiest)

```bash
# Install GitHub CLI
winget install GitHub.cli

# Login
gh auth login

# Push
git push origin main
```

---

## Quick Fix: Manual Upload

Agar authentication setup mein time lage, to:

1. **GitHub.com** → Your repo
2. **Upload files** directly
3. Vercel auto-deploy hoga

---

**Option 1 (Token) sabse fast hai! 🚀**

