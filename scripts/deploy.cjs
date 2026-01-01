#!/usr/bin/env node

/**
 * FirebaseデプロイとGitHubへの自動コミット・プッシュスクリプト
 * Windows (PowerShell) と Unix系 (bash) の両方に対応
 */

const { execSync } = require('child_process');
const { platform } = require('os');

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf-8', 
      stdio: 'inherit',
      ...options 
    });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    throw error;
  }
}

function hasChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim().length > 0;
  } catch (error) {
    console.warn('⚠️  Could not check git status. Skipping git operations.');
    return false;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('⚠️  Could not get current branch. Using "main" as default.');
    return 'main';
  }
}

async function main() {
  console.log('🚀 Starting deployment process...\n');

  // Gitの変更をチェックしてコミット・プッシュ
  if (hasChanges()) {
    console.log('📝 Changes detected. Committing to git...\n');
    
    try {
      // 変更をステージング
      exec('git add .');
      
      // コミットメッセージを生成（現在の日時を使用）
      const now = new Date();
      const commitMsg = `Deploy: ${now.toISOString().replace('T', ' ').substring(0, 19)}`;
      
      // コミット
      try {
        exec(`git commit -m "${commitMsg}"`);
        console.log('✅ Committed changes\n');
      } catch (error) {
        console.warn('⚠️  Commit failed. This might be because there are no changes or the commit was aborted.\n');
      }
      
      // 現在のブランチを取得してプッシュ
      const currentBranch = getCurrentBranch();
      console.log(`📤 Pushing to GitHub (branch: ${currentBranch})...\n`);
      
      try {
        exec(`git push origin ${currentBranch}`);
        console.log('✅ Successfully pushed to GitHub\n');
      } catch (error) {
        console.error('⚠️  Push failed. Please check your git remote and branch.');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error during git operations:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️  No changes to commit. Skipping git commit.\n');
  }

  // Firebaseにビルド
  console.log('🏗️  Building project...\n');
  exec('npm run build');

  // Firebaseにデプロイ
  console.log('\n🚀 Deploying to Firebase...\n');
  exec('firebase deploy');

  console.log('\n✅ Deployment complete!');
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
});
