@echo off
chcp 65001 >nul
echo ========================================
echo   提交PR到AI-Running-Companion
echo   元气值和哈特心脏系统
echo ========================================
echo.

cd /d D:\AI-Running-Companion-Fork

echo 【步骤1】检查当前状态...
git status
echo.

echo 【重要】请先完成以下操作：
echo 1. 访问: https://github.com/Kitty123567890/AI-Running-Companion
echo 2. 点击右上角 "Fork" 按钮
echo 3. 等待Fork完成
echo.
set /p forked=已完成Fork? (y/n):

if /i not "%forked%"=="y" (
    echo.
    echo 请先完成Fork，然后重新运行此脚本。
    echo.
    pause
    exit
)

echo.
echo 【步骤2】添加你的Fork为远程仓库...
git remote add myfork https://github.com/hanhuangmu/AI-Running-Companion.git 2>nul
if errorlevel 1 (
    echo 远程仓库已存在，更新URL...
    git remote set-url myfork https://github.com/hanhuangmu/AI-Running-Companion.git
)

echo.
echo 【步骤3】查看远程仓库...
git remote -v
echo.

echo 【步骤4】推送分支到你的Fork...
echo 正在推送 feature/energy-heart-system 分支...
git push myfork feature/energy-heart-system

if errorlevel 1 (
    echo.
    echo ❌ 推送失败！
    echo.
    echo 可能的原因：
    echo 1. 需要认证：请使用GitHub Personal Access Token
    echo 2. 网络问题：检查网络连接
    echo.
    echo 获取Token: https://github.com/settings/tokens
    echo.
    pause
    exit
)

echo.
echo ========================================
echo ✅ 代码已成功推送！
echo ========================================
echo.
echo 【步骤5】创建Pull Request
echo.
echo 1. 访问: https://github.com/hanhuangmu/AI-Running-Companion
echo 2. 点击 "Compare ^& pull request" 按钮
echo 3. 确认设置:
echo    - Base repository: Kitty123567890/AI-Running-Companion
echo    - Base branch: develop
echo    - Head repository: hanhuangmu/AI-Running-Companion
echo    - Compare branch: feature/energy-heart-system
echo.
echo 4. 填写PR信息（复制 PR提交指南.md 中的模板）
echo.
echo 5. 点击 "Create pull request"
echo.
echo 是否现在打开GitHub页面？
set /p open=打开? (y/n):

if /i "%open%"=="y" (
    start https://github.com/hanhuangmu/AI-Running-Companion
)

echo.
echo PR提交指南文件: D:\AI-Running-Companion-Fork\PR提交指南.md
echo.
pause
