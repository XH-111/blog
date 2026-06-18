param(
  [Parameter(Mandatory = $true)]
  [string]$DbBackupPath,
  [string]$Container = "blog-postgres",
  [string]$Database = "blog_dev",
  [string]$User = "blog"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $DbBackupPath)) {
  throw "Database backup file not found: $DbBackupPath"
}

Write-Host "Restoring '$DbBackupPath' into database '$Database' in container '$Container'..."
Get-Content -Path $DbBackupPath | docker exec -i $Container psql -U $User -d $Database
if ($LASTEXITCODE -ne 0) {
  throw "psql restore failed with exit code $LASTEXITCODE"
}
Write-Host "Database restore completed."
