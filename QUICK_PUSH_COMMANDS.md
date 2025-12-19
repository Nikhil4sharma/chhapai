# ⚡ Quick Push Commands

## Method 1: Personal Access Token

```bash
# 1. Token generate karo (GitHub.com → Settings → Developer settings)
# 2. Token copy karo

# 3. Push karo
git push origin main

# Username: Nikhil4sharma
# Password: PASTE_TOKEN_HERE (not actual password!)
```

---

## Method 2: SSH (One-time Setup)

```bash
# 1. SSH key generate
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. Public key copy
cat ~/.ssh/id_ed25519.pub
# Copy output

# 3. GitHub → Settings → SSH keys → Add key

# 4. Remote change to SSH
git remote set-url origin git@github.com:Nikhil4sharma/chhapai.git

# 5. Push
git push origin main
```

---

## Method 3: GitHub CLI

```bash
# Install
winget install GitHub.cli

# Login
gh auth login

# Push
git push origin main
```

---

**Token method sabse simple! 2 minutes mein ho jayega! 🚀**

