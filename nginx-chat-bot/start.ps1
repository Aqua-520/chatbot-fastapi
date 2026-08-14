# ==============================================================================
# nginx 一键启动脚本 (Windows)
# 作用:
#   1. 若 nginx.exe 不存在,自动下载 nginx/1.24.0 并解压所需文件
#   2. 保留 git 中自定义的 html/ 前端 与 conf/nginx.conf 配置不被覆盖
#   3. 后台启动 nginx(监听 5200,/api 反向代理到 fast_api 的 1086 端口)
#
# 用法:
#   powershell -ExecutionPolicy Bypass -File start.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$nginxExe = Join-Path $root "nginx.exe"
$version  = "1.24.0"
$url      = "https://nginx.org/download/nginx-$version.zip"

if (-not (Test-Path $nginxExe)) {
    Write-Host "[1/3] 未检测到 nginx.exe,开始下载 nginx/$version ..." -ForegroundColor Yellow
    Write-Host "      (国内网络若慢,可手动下载 zip 解压,把 nginx.exe 放到本目录后再运行)" -ForegroundColor DarkGray
    $zip = Join-Path $env:TEMP "nginx-$version.zip"
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

    Write-Host "[2/3] 解压并部署所需文件..." -ForegroundColor Yellow
    $tmp = Join-Path $env:TEMP "nginx-$version-extract"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Join-Path $tmp "nginx-$version"

    # nginx.exe
    Copy-Item (Join-Path $src "nginx.exe") $root -Force
    # conf/ 下除 nginx.conf 外的自带配置(mime.types 等),不覆盖我们的 nginx.conf
    $confDir = Join-Path $root "conf"
    if (-not (Test-Path $confDir)) { New-Item $confDir -ItemType Directory | Out-Null }
    Get-ChildItem (Join-Path $src "conf") -File | Where-Object { $_.Name -ne "nginx.conf" } | ForEach-Object {
        Copy-Item $_.FullName $confDir -Force
    }

    Remove-Item $zip -Force
    Remove-Item $tmp -Recurse -Force
    Write-Host "      nginx 部署完成" -ForegroundColor Green
} else {
    Write-Host "[1/3] nginx.exe 已存在,跳过下载" -ForegroundColor Green
}

# nginx 运行需要 logs/ 与 temp/ 目录
foreach ($d in @("logs", "temp")) {
    $p = Join-Path $root $d
    if (-not (Test-Path $p)) { New-Item $p -ItemType Directory | Out-Null }
}

Write-Host "[3/3] 启动 nginx ..." -ForegroundColor Cyan
Start-Process -FilePath $nginxExe -WorkingDirectory $root -WindowStyle Hidden
Start-Sleep -Milliseconds 800

Write-Host ""
Write-Host "完成! 访问 http://localhost:5200" -ForegroundColor Green
Write-Host "  - 静态前端: html/"
Write-Host "  - /api 代理到: http://localhost:1086  (请先启动 fast_api 后端)"
Write-Host "  - 停止 nginx: 在本目录执行  .\nginx.exe -s stop"
