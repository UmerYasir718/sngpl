@echo off
title Auto PDF Generator
echo Starting server and automation process...
cd %~dp0
node scripts/automation.js
pause
