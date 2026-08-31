# Mailbox Intake Dashboard — local Windows setup
# Default target: C:\D data\Hemanth\Cursor\Project

param(
    [string]$ProjectPath = "C:\D data\Hemanth\Cursor\Project",
    [string]$RepoUrl = "https://github.com/H10473/feature-mailbox-intake-dashboard.git"
)

$ErrorActionPreference = "Stop"

Write-Host "Mailbox Intake Dashboard setup" -ForegroundColor Cyan
Write-Host "Target folder: $ProjectPath"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git is required. Install from https://git-scm.com/download/win"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js/npm is required (Node 20+). Install from https://nodejs.org/"
}

New-Item -ItemType Directory -Force -Path $ProjectPath | Out-Null
Set-Location $ProjectPath

if (Test-Path ".git") {
    Write-Host "Repository already exists. Pulling latest main..."
    git fetch origin
    git checkout main
    git pull origin main
} else {
    $items = Get-ChildItem -Force | Where-Object { $_.Name -notin @('.', '..') }
    if ($items.Count -gt 0) {
        throw "Folder is not empty. Clear it or choose another path."
    }
    Write-Host "Cloning repository..."
    git clone $RepoUrl .
}

Write-Host "Installing dependencies..."
npm install

Write-Host ""
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Run:  npm run dev"
Write-Host "Open: http://localhost:5173"
