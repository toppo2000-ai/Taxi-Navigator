#!/bin/bash

# FirebaseデプロイとGitHubへの自動コミット・プッシュスクリプト

set -e  # エラーが発生したら停止

echo "🚀 Starting deployment process..."

# 変更があるか確認
if [ -z "$(git status --porcelain)" ]; then
  echo "⚠️  No changes to commit. Skipping git commit."
else
  echo "📝 Changes detected. Committing to git..."
  
  # 変更をステージング
  git add .
  
  # コミットメッセージを生成（現在の日時を使用）
  COMMIT_MSG="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
  
  # コミット
  git commit -m "$COMMIT_MSG" || {
    echo "⚠️  Commit failed. This might be because there are no changes or the commit was aborted."
  }
  
  # 現在のブランチを取得
  CURRENT_BRANCH=$(git branch --show-current)
  echo "📤 Pushing to GitHub (branch: $CURRENT_BRANCH)..."
  
  # プッシュ
  git push origin "$CURRENT_BRANCH" || {
    echo "⚠️  Push failed. Please check your git remote and branch."
    exit 1
  }
  
  echo "✅ Successfully pushed to GitHub"
fi

# Firebaseにビルド
echo "🏗️  Building project..."
npm run build

# Firebaseにデプロイ
echo "🚀 Deploying to Firebase..."
firebase deploy

echo "✅ Deployment complete!"
