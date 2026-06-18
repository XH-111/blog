param(
  [string]$OutputRoot = "backups",
  [string]$Container = "blog-postgres",
  [string]$Database = "blog_dev",
  [string]$User = "blog",
  [string]$UploadsPath = "public\uploads"
)

$ErrorActionPreference = "Stop"

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $OutputRoot $stamp
$dbFile = Join-Path $backupDir "$Database.sql"
$uploadsFile = Join-Path $backupDir "uploads.zip"

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "Backing up PostgreSQL database '$Database' from container '$Container'..."
$dump = docker exec $Container pg_dump -U $User -d $Database
if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed with exit code $LASTEXITCODE"
}
$dump | Set-Content -Encoding UTF8 -Path $dbFile

if (Test-Path $UploadsPath) {
  Write-Host "Compressing uploads directory '$UploadsPath'..."
  $uploadItems = Get-ChildItem -Force -Path $UploadsPath -ErrorAction SilentlyContinue
  if ($uploadItems) {
    Compress-Archive -Path (Join-Path $UploadsPath "*") -DestinationPath $uploadsFile -Force
  } else {
    Write-Host "Uploads directory '$UploadsPath' is empty, skipped uploads archive."
  }
} else {
  Write-Host "Uploads directory '$UploadsPath' does not exist, skipped uploads archive."
}

Write-Host "Backup completed: $backupDir"
