# GitHub Push Script with Token
# Usage: .\push-with-token.ps1

Write-Host "🚀 GitHub Push Script" -ForegroundColor Green
Write-Host ""

# Check if token is provided
$token = Read-Host "Enter your GitHub Personal Access Token (or press Enter to skip)"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host ""
    Write-Host "📝 Token nahi diya. Ye steps follow karo:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. GitHub.com → Settings → Developer settings → Personal access tokens"
    Write-Host "2. Generate new token (classic) with 'repo' scope"
    Write-Host "3. Token copy karo"
    Write-Host "4. Phir se script run karo: .\push-with-token.ps1"
    Write-Host ""
    exit
}

# Set remote URL with token
$remoteUrl = "https://${token}@github.com/Nikhil4sharma/chhapai.git"
Write-Host "Setting remote URL with token..." -ForegroundColor Cyan
git remote set-url origin $remoteUrl

# Push
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Push successful!" -ForegroundColor Green
    Write-Host "Vercel auto-deploy hoga in 2-3 minutes" -ForegroundColor Green
    Write-Host "Check: https://chhapai.vercel.app" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Push failed. Check error above." -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "1. Repository doesn't exist - create it on GitHub first"
    Write-Host "2. Token invalid or expired"
    Write-Host "3. Token doesn't have 'repo' scope"
}


