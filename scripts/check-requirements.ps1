# License Gateway Requirements Check
Write-Host "=== License Gateway Requirements Check ===" -ForegroundColor Green
Write-Host ""

# Check Docker
Write-Host "1. Checking Docker..." -ForegroundColor Yellow
$dockerCheck = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCheck) {
    try {
        $dockerVersion = docker --version
        Write-Host "✓ Docker installed: $dockerVersion" -ForegroundColor Green
    } catch {
        Write-Host "✗ Docker command failed" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Docker not found" -ForegroundColor Red
}

# Check Docker Compose
Write-Host ""
Write-Host "2. Checking Docker Compose..." -ForegroundColor Yellow
$composeCheck = Get-Command docker-compose -ErrorAction SilentlyContinue
if ($composeCheck) {
    try {
        $composeVersion = docker-compose --version
        Write-Host "✓ Docker Compose installed: $composeVersion" -ForegroundColor Green
    } catch {
        Write-Host "✗ Docker Compose command failed" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Docker Compose not found" -ForegroundColor Red
}

# Check environment file
Write-Host ""
Write-Host "3. Checking environment file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file exists" -ForegroundColor Green
    Write-Host "  Please verify GITHUB_OWNER and GITHUB_REPO are set correctly" -ForegroundColor Cyan
} else {
    Write-Host "✗ .env file not found" -ForegroundColor Red
    Write-Host "  Please create .env file with GITHUB_OWNER and GITHUB_REPO" -ForegroundColor Yellow
}

# Check required files
Write-Host ""
Write-Host "4. Checking required project files..." -ForegroundColor Yellow
$files = @("server/license-server.js", "server/Dockerfile", "server/docker-compose.yml", ".github/workflows/release.yml")
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "✓ $file exists" -ForegroundColor Green
    } else {
        Write-Host "✗ $file missing" -ForegroundColor Red
    }
}

# Check port 8088
Write-Host ""
Write-Host "5. Checking port 8088..." -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 8088)
    $tcpClient.Close()
    Write-Host "⚠ Port 8088 is in use" -ForegroundColor Yellow
} catch {
    Write-Host "✓ Port 8088 is available" -ForegroundColor Green
}

# Check internet
Write-Host ""
Write-Host "6. Checking GitHub connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://api.github.com" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ GitHub API accessible" -ForegroundColor Green
} catch {
    Write-Host "✗ Cannot reach GitHub API" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Check Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Update .env with your GitHub details" -ForegroundColor White
Write-Host "2. Run: cd server && docker-compose up -d --build" -ForegroundColor White
Write-Host "3. Test at: http://localhost:8088" -ForegroundColor White