#Requires -Version 5.1
<#
.SYNOPSIS
    Starts the complete Samagama Portal development stack with a single command.

.DESCRIPTION
    Performs all startup steps in order:
      1. Verifies Node.js 20+, npm, and MongoDB are available
      2. Checks that apps\server\.env exists (offers to create it from .env.example)
      3. Validates no placeholder JWT secrets remain
      4. Checks for port conflicts on 4000 and 5173
      5. Installs npm workspace dependencies if node_modules is missing
      6. Builds the @samagama/shared package if its dist/ folder is absent
      7. Starts MongoDB (Windows service -> manual mongod.exe -> prompts user)
      8. Optionally starts Ollama when LLM_PROVIDER=ollama is detected in .env
      9. Launches the API server in a dedicated PowerShell window (port 4000)
     10. Polls http://localhost:4000/health until the server is healthy
     11. Launches the React dev client in a dedicated PowerShell window (port 5173)
     12. Opens http://localhost:5173 in the default browser
     13. Prints a final summary table with URLs and dev credentials

.PARAMETER SkipInstall
    Skip the npm install step (use when dependencies are already up-to-date).

.PARAMETER SkipBuildShared
    Skip building @samagama/shared (use when packages/shared/dist already exists).

.PARAMETER NoBrowser
    Do not automatically open the browser when the client is ready.

.PARAMETER ServerHealthTimeout
    Seconds to wait for the API server health check. Default: 120.

.EXAMPLE
    .\start-dev.ps1
    .\start-dev.ps1 -SkipInstall
    .\start-dev.ps1 -SkipInstall -SkipBuildShared -NoBrowser
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipBuildShared,
    [switch]$NoBrowser,
    [int]$ServerHealthTimeout = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Colour helpers ──────────────────────────────────────────────────────────

function Write-Banner {
    param([string]$text)
    $line = "=" * 55
    Write-Host ""
    Write-Host $line -ForegroundColor Magenta
    Write-Host "  $text" -ForegroundColor Magenta
    Write-Host $line -ForegroundColor Magenta
    Write-Host ""
}

function Write-Step {
    param([string]$msg)
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

function Write-Ok   { param([string]$msg) Write-Host "    [OK]   $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg) Write-Host "    [FAIL] $msg" -ForegroundColor Red }
function Write-Info { param([string]$msg) Write-Host "           $msg" -ForegroundColor Gray }

function Confirm-Continue {
    param([string]$prompt = "Press ENTER to continue (or Ctrl+C to abort)")
    Read-Host "`n    $prompt" | Out-Null
}

# ─── Helper: launch a child PowerShell window ────────────────────────────────
#
# Encodes the script block as Base64 so spaces in $ProjectRoot and quotes in
# titles never break argument parsing.
#
function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$WorkDir,
        [string]$NpmScript,          # e.g. "dev:server"
        [string]$HeaderColor = "Cyan"
    )

    $safeDir  = $WorkDir -replace "'", "''"
    $safeTitle = $Title  -replace "'", "''"

    $block = @"
try { `$host.UI.RawUI.WindowTitle = '$safeTitle' } catch {}
Write-Host ('=' * 50) -ForegroundColor $HeaderColor
Write-Host '  $safeTitle' -ForegroundColor $HeaderColor
Write-Host ('=' * 50) -ForegroundColor $HeaderColor
Write-Host ''
Set-Location '$safeDir'
npm run $NpmScript
if (`$LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[ERROR] Process exited with code ' -NoNewline -ForegroundColor Red
    Write-Host `$LASTEXITCODE -ForegroundColor Red
    Write-Host 'This window will stay open so you can read the error above.' -ForegroundColor Yellow
    Read-Host 'Press ENTER to close'
}
"@

    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($block))
    Start-Process powershell -ArgumentList "-NoExit", "-EncodedCommand", $encoded -WindowStyle Normal
}

# ─── Helper: poll a URL until it responds 200 ────────────────────────────────
function Wait-ForUrl {
    param(
        [string]$Url,
        [int]   $TimeoutSeconds = 60,
        [int]   $PollInterval   = 3
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $attempt  = 0

    while ((Get-Date) -lt $deadline) {
        $attempt++
        try {
            $r = Invoke-WebRequest -Uri $Url -TimeoutSec ($PollInterval - 1) -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }

        $remaining = [int]($deadline - (Get-Date)).TotalSeconds
        Write-Host "           Attempt $attempt — waiting (${remaining}s remaining)..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $PollInterval
    }
    return $false
}

# ─── Helper: check whether a local TCP port is in LISTEN state ───────────────
function Test-PortInUse {
    param([int]$Port)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# ─── Helper: kill whatever owns a port ───────────────────────────────────────
function Clear-Port {
    param([int]$Port)
    Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
}

# ─── Helper: test whether mongod is accepting connections ────────────────────
function Test-MongoAlive {
    try {
        # mongosh must be in PATH; suppress all output — we only care about exit code
        $null = & mongosh --eval "db.adminCommand('ping')" --quiet 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

# =============================================================================
#  MAIN
# =============================================================================

$ProjectRoot = $PSScriptRoot

Write-Banner "Samagama Portal — Development Stack Launcher"

# ─── STEP 1: Prerequisites ───────────────────────────────────────────────────
Write-Step "Checking prerequisites..."

# Node.js
try {
    $nodeRaw   = (node --version 2>&1).ToString().Trim()
    $nodeMajor = [int]($nodeRaw -replace 'v(\d+)\..*', '$1')
    if ($nodeMajor -lt 20) {
        Write-Fail "Node.js v20 or higher is required. Found: $nodeRaw"
        Write-Info "Download the LTS installer from https://nodejs.org"
        exit 1
    }
    Write-Ok "Node.js $nodeRaw"
} catch {
    Write-Fail "Node.js is not installed or not in PATH."
    Write-Info "Download the LTS installer from https://nodejs.org"
    exit 1
}

# npm
try {
    $npmRaw = (npm --version 2>&1).ToString().Trim()
    Write-Ok "npm $npmRaw"
} catch {
    Write-Fail "npm is not installed or not in PATH."
    exit 1
}

# MongoDB — locate mongod.exe (needed only for manual-start fallback)
$mongodExe = $null
$mongodCandidates = @(
    "$env:ProgramFiles\MongoDB\Server\8.0\bin\mongod.exe",
    "$env:ProgramFiles\MongoDB\Server\7.0\bin\mongod.exe",
    "$env:ProgramFiles\MongoDB\Server\6.0\bin\mongod.exe",
    "$env:ProgramFiles\MongoDB\Server\5.0\bin\mongod.exe"
)
foreach ($c in $mongodCandidates) {
    if (Test-Path $c) { $mongodExe = $c; break }
}
if (-not $mongodExe) {
    # Try PATH as last resort
    $inPath = Get-Command mongod -ErrorAction SilentlyContinue
    if ($inPath) { $mongodExe = $inPath.Source }
}

if ($mongodExe) {
    Write-Ok "mongod found: $mongodExe"
} else {
    Write-Warn "mongod.exe not found in standard locations."
    Write-Info "If MongoDB is already running as a service, this is fine."
    Write-Info "Otherwise download from https://www.mongodb.com/try/download/community"
}

# Ollama (optional)
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaCmd) {
    Write-Ok "Ollama found: $($ollamaCmd.Source)"
} else {
    Write-Info "Ollama not installed (chatbot will use cloud/mock — this is fine)."
}

# ─── STEP 2: .env check ──────────────────────────────────────────────────────
Write-Step "Checking environment configuration..."

$envFile    = Join-Path $ProjectRoot "apps\server\.env"
$envExample = Join-Path $ProjectRoot ".env.example"
$envContent = ""

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Write-Warn "apps\server\.env not found — copying from .env.example"
        Copy-Item $envExample $envFile
        Write-Info ""
        Write-Info "ACTION REQUIRED: Open apps\server\.env and replace the two"
        Write-Info "placeholder JWT secrets with real random values."
        Write-Info ""
        Write-Info "Generate a secret (run TWICE, use different outputs):"
        Write-Info "  node -e `"console.log(require('crypto').randomBytes(48).toString('hex'))`""
        Write-Info ""
        Confirm-Continue "Press ENTER once you have updated apps\server\.env"
    } else {
        Write-Fail "apps\server\.env is missing and no .env.example was found."
        Write-Info "Create apps\server\.env with at minimum:"
        Write-Info "  NODE_ENV=development"
        Write-Info "  PORT=4000"
        Write-Info "  MONGODB_URI=mongodb://127.0.0.1:27017/samagama"
        Write-Info "  JWT_ACCESS_SECRET=<64-char random hex>"
        Write-Info "  JWT_REFRESH_SECRET=<different 64-char random hex>"
        Write-Info "  CORS_ORIGINS=http://localhost:5173"
        Write-Info "  LLM_PROVIDER=mock"
        Write-Info "  EMBEDDING_PROVIDER=mock"
        exit 1
    }
}

$envContent = Get-Content $envFile -Raw -ErrorAction SilentlyContinue

# Warn about obvious placeholders
if ($envContent -match "paste-a-random|<your-|YOUR_SECRET|change.me") {
    Write-Warn "apps\server\.env still contains placeholder values."
    Write-Info "The server will likely refuse to start. Update JWT_ACCESS_SECRET"
    Write-Info "and JWT_REFRESH_SECRET with real secrets, then re-run this script."
    Confirm-Continue "Press ENTER to proceed anyway (or Ctrl+C to abort and fix first)"
} else {
    Write-Ok "apps\server\.env present and secrets look non-empty"
}

# Detect LLM provider
$llmProvider = "mock"
if ($envContent -match "(?m)^LLM_PROVIDER=(\S+)") { $llmProvider = $Matches[1] }
Write-Info "LLM provider: $llmProvider"

# ─── STEP 3: Port conflicts ───────────────────────────────────────────────────
Write-Step "Checking port availability..."

foreach ($port in @(4000, 5173)) {
    if (Test-PortInUse -Port $port) {
        Write-Warn "Port $port is already occupied."
        $ans = Read-Host "           Kill the process on port $port and free it? (y/N)"
        if ($ans -eq 'y' -or $ans -eq 'Y') {
            Clear-Port -Port $port
            Start-Sleep -Milliseconds 500
            if (-not (Test-PortInUse -Port $port)) {
                Write-Ok "Port $port is now free"
            } else {
                Write-Warn "Could not free port $port — the service using it may still conflict."
            }
        } else {
            Write-Info "Continuing with port $port occupied — the service may fail to bind."
        }
    } else {
        Write-Ok "Port $port is free"
    }
}

# ─── STEP 4: Install npm dependencies ────────────────────────────────────────
if (-not $SkipInstall) {
    Write-Step "Installing npm workspace dependencies..."

    $nodeModulesRoot = Join-Path $ProjectRoot "node_modules"
    if (-not (Test-Path $nodeModulesRoot)) {
        Write-Info "node_modules not found — running npm install (may take 1-2 minutes)..."
        Push-Location $ProjectRoot
        try {
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install exited with code $LASTEXITCODE" }
        } finally {
            Pop-Location
        }
        Write-Ok "Dependencies installed"
    } else {
        Write-Ok "node_modules already present (pass -SkipInstall to silence this check)"
    }
} else {
    Write-Info "Skipping npm install (-SkipInstall)"
}

# ─── STEP 5: Build @samagama/shared ──────────────────────────────────────────
if (-not $SkipBuildShared) {
    Write-Step "Building @samagama/shared..."

    $sharedDist = Join-Path $ProjectRoot "packages\shared\dist\index.js"
    if (-not (Test-Path $sharedDist)) {
        Write-Info "packages\shared\dist not found — building shared package..."
        Push-Location $ProjectRoot
        try {
            npm run build:shared
            if ($LASTEXITCODE -ne 0) { throw "build:shared exited with code $LASTEXITCODE" }
        } finally {
            Pop-Location
        }
        Write-Ok "@samagama/shared built"
    } else {
        Write-Ok "@samagama/shared already built"
    }
} else {
    Write-Info "Skipping @samagama/shared build (-SkipBuildShared)"
}

# ─── STEP 6: Start MongoDB ────────────────────────────────────────────────────
Write-Step "Starting MongoDB..."

if (Test-MongoAlive) {
    Write-Ok "MongoDB is already running and accepting connections"
} else {
    # Option A: Windows service named "MongoDB"
    $svc = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -eq 'Running') {
            Write-Ok "MongoDB Windows service is running"
        } else {
            Write-Info "Starting MongoDB Windows service..."
            try {
                Start-Service -Name MongoDB -ErrorAction Stop
                Start-Sleep -Seconds 3
                if (Test-MongoAlive) {
                    Write-Ok "MongoDB service started"
                } else {
                    Write-Warn "Service started but mongosh ping failed — proceeding anyway."
                }
            } catch {
                Write-Warn "Could not start MongoDB service: $($_.Exception.Message)"
                Write-Info "You may need to run this script as Administrator."
            }
        }
    }
    # Option B: Launch mongod.exe in its own window
    elseif ($mongodExe) {
        $dbPath = "C:\data\db"
        if (-not (Test-Path $dbPath)) {
            Write-Info "Creating MongoDB data directory: $dbPath"
            New-Item -ItemType Directory -Path $dbPath -Force | Out-Null
        }

        Write-Info "Launching mongod.exe in a new window..."
        $mongoBlock = @"
try { `$host.UI.RawUI.WindowTitle = 'Samagama - MongoDB' } catch {}
Write-Host ('=' * 50) -ForegroundColor Yellow
Write-Host '  MongoDB  --  port 27017' -ForegroundColor Yellow
Write-Host ('=' * 50) -ForegroundColor Yellow
Write-Host ''
& '$($mongodExe -replace "'","''")'  --dbpath '$($dbPath -replace "'","''")'
Read-Host 'MongoDB exited. Press ENTER to close this window.'
"@
        $mongoEncoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($mongoBlock))
        Start-Process powershell -ArgumentList "-NoExit", "-EncodedCommand", $mongoEncoded -WindowStyle Normal

        Write-Info "Waiting for MongoDB to initialise..."
        $mongoReady = $false
        for ($i = 1; $i -le 20; $i++) {
            Start-Sleep -Seconds 1
            if (Test-MongoAlive) { $mongoReady = $true; break }
        }
        if ($mongoReady) {
            Write-Ok "MongoDB is accepting connections"
        } else {
            Write-Warn "MongoDB did not respond within 20 seconds — the server will retry."
        }
    }
    # Option C: Ask the user to start it manually
    else {
        Write-Warn "Cannot start MongoDB automatically (mongod.exe not found, no Windows service)."
        Write-Info "Start MongoDB manually using one of these commands:"
        Write-Info "  net start MongoDB                         (as Administrator)"
        Write-Info "  mongod --dbpath C:\data\db                (keep the window open)"
        Write-Info "  or start MongoDB Compass — it bundles a local server option"
        Confirm-Continue "Press ENTER once MongoDB is running"

        if (-not (Test-MongoAlive)) {
            Write-Warn "MongoDB still does not appear to be running."
            Write-Info "The API server will keep retrying its connection on startup."
        } else {
            Write-Ok "MongoDB is accepting connections"
        }
    }
}

# ─── STEP 7: Start Ollama (only when .env requests it) ───────────────────────
if ($llmProvider -eq "ollama") {
    Write-Step "Checking Ollama (LLM_PROVIDER=ollama)..."

    if (-not $ollamaCmd) {
        Write-Warn "LLM_PROVIDER=ollama but Ollama is not installed."
        Write-Info "Download from https://ollama.com/download"
        Write-Info "The chatbot will fail until Ollama is running with the correct model."
    } else {
        # Probe the Ollama REST API
        $ollamaRunning = $false
        try {
            $r = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop
            $ollamaRunning = ($r.StatusCode -eq 200)
        } catch { }

        if ($ollamaRunning) {
            Write-Ok "Ollama is already running on port 11434"
        } else {
            Write-Info "Starting Ollama in a new window..."
            $ollamaBlock = @"
try { `$host.UI.RawUI.WindowTitle = 'Samagama - Ollama' } catch {}
Write-Host ('=' * 50) -ForegroundColor DarkMagenta
Write-Host '  Ollama LLM Server  --  port 11434' -ForegroundColor DarkMagenta
Write-Host ('=' * 50) -ForegroundColor DarkMagenta
Write-Host ''
ollama serve
Read-Host 'Ollama exited. Press ENTER to close this window.'
"@
            $ollamaEncoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($ollamaBlock))
            Start-Process powershell -ArgumentList "-NoExit", "-EncodedCommand", $ollamaEncoded -WindowStyle Normal

            Write-Info "Waiting 10 seconds for Ollama to start..."
            Start-Sleep -Seconds 10
            Write-Ok "Ollama window opened (check it for errors if chatbot fails)"
        }

        # Verify the model is pulled
        $ollamaModel = "gemma3:4b"
        if ($envContent -match "(?m)^OLLAMA_MODEL=(\S+)") { $ollamaModel = $Matches[1] }
        try {
            $tags = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            if ($tags.Content -notmatch [regex]::Escape($ollamaModel)) {
                Write-Warn "Model '$ollamaModel' does not appear to be pulled yet."
                Write-Info "Run in a separate terminal:  ollama pull $ollamaModel"
            } else {
                Write-Ok "Model '$ollamaModel' is available"
            }
        } catch {
            Write-Info "Could not verify model list (Ollama may still be initialising)."
        }
    }
}

# ─── STEP 8: Launch API server ────────────────────────────────────────────────
Write-Step "Launching API server in a new window (port 4000)..."

Start-ServiceWindow `
    -Title       "Samagama — API Server (port 4000)" `
    -WorkDir     $ProjectRoot `
    -NpmScript   "dev:server" `
    -HeaderColor "Cyan"

# ─── STEP 9: Wait for the server to be healthy ───────────────────────────────
Write-Step "Waiting for API server health check..."
Write-Info "Polling http://localhost:4000/health (timeout: ${ServerHealthTimeout}s)..."

$serverReady = Wait-ForUrl -Url "http://localhost:4000/health" -TimeoutSeconds $ServerHealthTimeout -PollInterval 3

if ($serverReady) {
    Write-Ok "API server is healthy — http://localhost:4000"
} else {
    Write-Fail "API server did not become healthy within ${ServerHealthTimeout} seconds."
    Write-Info ""
    Write-Info "Common causes and fixes:"
    Write-Info "  MongoServerError / ECONNREFUSED 27017"
    Write-Info "    => MongoDB is not running. Start it first."
    Write-Info "  JWT_ACCESS_SECRET must be at least 32 characters"
    Write-Info "    => Open apps\server\.env and regenerate the JWT secrets."
    Write-Info "  Cannot find module '@samagama/shared'"
    Write-Info "    => Run:  npm run build:shared"
    Write-Info ""
    Write-Info "Check the API Server window for the full error output."
    Write-Info ""
    $ans = Read-Host "    Launch the React client anyway? (y/N)"
    if ($ans -ne 'y' -and $ans -ne 'Y') {
        Write-Info "Exiting. Fix the server issue and re-run start-dev.ps1."
        exit 1
    }
}

# ─── STEP 10: Launch React client ────────────────────────────────────────────
Write-Step "Launching React client in a new window (port 5173)..."

Start-ServiceWindow `
    -Title       "Samagama — React Client (port 5173)" `
    -WorkDir     $ProjectRoot `
    -NpmScript   "dev:client" `
    -HeaderColor "Green"

# ─── STEP 11: Wait for client ────────────────────────────────────────────────
Write-Step "Waiting for React dev server to be ready..."
Write-Info "Polling http://localhost:5173 (timeout: 60s)..."

$clientReady = Wait-ForUrl -Url "http://localhost:5173" -TimeoutSeconds 60 -PollInterval 2

if ($clientReady) {
    Write-Ok "React client is ready — http://localhost:5173"
} else {
    Write-Warn "React client did not respond within 60 seconds."
    Write-Info "Check the React Client window for Vite output — it may need more time."
}

# ─── STEP 12: Open browser ───────────────────────────────────────────────────
if (-not $NoBrowser) {
    Write-Step "Opening browser..."
    try {
        Start-Process "http://localhost:5173"
        Write-Ok "Browser opened at http://localhost:5173"
    } catch {
        Write-Warn "Could not open the browser automatically."
        Write-Info "Navigate to http://localhost:5173 manually."
    }
}

# ─── STEP 13: Final summary ──────────────────────────────────────────────────

$serverStatus = if ($serverReady) { "[RUNNING]" } else { "[UNKNOWN]" }
$clientStatus = if ($clientReady) { "[RUNNING]" } else { "[STARTING]" }
$serverColor  = if ($serverReady) { "Green" } else { "Yellow" }
$clientColor  = if ($clientReady) { "Green" } else { "Yellow" }

Write-Banner "All services launched"

Write-Host "  Service         URL                           Status" -ForegroundColor White
Write-Host "  ─────────────── ───────────────────────────── ────────────" -ForegroundColor DarkGray
Write-Host ("  API Server      http://localhost:4000          {0}" -f $serverStatus) -ForegroundColor $serverColor
Write-Host ("  React Client    http://localhost:5173          {0}" -f $clientStatus) -ForegroundColor $clientColor
Write-Host "  API Health      http://localhost:4000/health   GET" -ForegroundColor DarkGray
if ($llmProvider -eq "ollama") {
    Write-Host "  Ollama          http://localhost:11434         (chatbot LLM)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  Dev accounts:" -ForegroundColor White
Write-Host "    student@samagama.test      StudentDev!2024" -ForegroundColor DarkGray
Write-Host "    moderator@samagama.test    ModDev!2024" -ForegroundColor DarkGray
Write-Host "    admin@samagama.test        AdminDev!2024" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To stop all services:" -ForegroundColor White
Write-Host "    Close each service window, or run:" -ForegroundColor DarkGray
Write-Host "    Stop-Process -Id (Get-NetTCPConnection -LocalPort 4000,5173 ``" -ForegroundColor DarkGray
Write-Host "      -ErrorAction SilentlyContinue).OwningProcess -Force" -ForegroundColor DarkGray
Write-Host ""
