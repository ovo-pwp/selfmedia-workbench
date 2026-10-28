@echo off
chcp 65001 >nul
title 我的小工作台
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" set "NODE_EXE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"

if not defined NODE_EXE (
  echo.
  echo   [!] 没有找到 Node.js
  echo       请到 https://nodejs.org 下载 LTS 版本安装，免费。
  echo.
  pause
  exit /b 1
)

echo.
echo   正在启动，稍后会自动打开浏览器...
echo   这个窗口不要关，关了服务就停了。
echo.
"%NODE_EXE%" server.js
pause
