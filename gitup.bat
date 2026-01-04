@echo off

echo ==========================================
echo  GitHub Upload Tool
echo ==========================================

:: 1. Add files
git add .

:: 2. Input message (English text prevents encoding errors)
set /p msg="Enter commit message (Press Enter for 'Update'): "

:: Set default if empty
if "%msg%"=="" set msg=Update

:: 3. Commit
git commit -m "%msg%"

:: 4. Push
git push

echo ==========================================
echo  DONE!
echo ==========================================
pause