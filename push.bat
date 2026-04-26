@echo off
echo ========================================
echo Pushing to GitHub
echo ========================================
echo.
echo Run this in your M-Overlay folder
echo.
git add .
git commit -m "Clean up server.js for Railway"
git push origin master
echo.
echo If asks for username/password - use your GitHub
echo.
pause