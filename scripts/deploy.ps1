# FirebaseデプロイとGitHubへの自動コミット・プッシュスクリプト (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting deployment process..." -ForegroundColor Cyan

# 変更があるか確認
$gitStatus = git status --porcelain
if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "⚠️  No changes to commit. Skipping git commit." -ForegroundColor Yellow
} else {
    Write-Host "📝 Changes detected. Committing to git..." -ForegroundColor Green
    
    # 変更をステージング
    git add .
    
    # コミットメッセージを生成（現在の日時を使用）
    $commitMsg = "Deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    
    # コミット
    try {
        git commit -m $commitMsg
        Write-Host "✅ Committed changes" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Commit failed. This might be because there are no changes or the commit was aborted." -ForegroundColor Yellow
    }
    
    # 現在のブランチを取得
    $currentBranch = git branch --show-current
    Write-Host "📤 Pushing to GitHub (branch: $currentBranch)..." -ForegroundColor Cyan
    
    # プッシュ
    try {
        git push origin $currentBranch
        Write-Host "✅ Successfully pushed to GitHub" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Push failed. Please check your git remote and branch." -ForegroundColor Red
        exit 1
    }
}

# Firebaseにビルド
Write-Host "🏗️  Building project..." -ForegroundColor Cyan
npm run build

# Firebaseにデプロイ
Write-Host "🚀 Deploying to Firebase..." -ForegroundColor Cyan
firebase deploy

Write-Host "✅ Deployment complete!" -ForegroundColor Green
