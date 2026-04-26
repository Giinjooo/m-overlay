# GitHub Push Guide for M-Overlay

## Option 1: Using Git Bash (Recommended)

1. Go to your M-Overlay folder on computer
2. Right-click → "Open Git Bash here"
3. Run these commands:

```bash
git pull origin master
git add .
git commit -m "Fix Railway deployment"
git push origin master
```

4. If it asks for username/password, enter your GitHub username and password

---

## Option 2: Using GitHub Website

1. Go to https://github.com/Giinjooo/m-overlay
2. Click "Upload files" button
3. Drag and drop these files from your M-Overlay folder:
   - railway.json
   - Procfile
   - package.json
   - package-lock.json
   - public/index.html
4. Add commit message: "Fix Railway deployment"
5. Click "Commit changes"

---

## After Push - Go to Railway

1. Go to https://railway.app
2. Click your m-overlay project
3. Click "Deploy" button
4. Wait for deployment to finish
5. Try your URL: https://overlay-production-b36c.up.railway.app