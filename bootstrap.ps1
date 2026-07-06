<#
  Thin wrapper: verify Node >= 18 is available, then run bootstrap.js with all args passed through.
  Usage: .\bootstrap.ps1 --vault "C:\path\to\vault" [--update] [--dry-run] [--force-settings]
#>
$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "Node.js is required but was not found on PATH. Install Node 18+ from https://nodejs.org, then re-run."
  exit 1
}

$major = [int](& node -e 'process.stdout.write(process.versions.node.split(".")[0])')
if ($major -lt 18) {
  Write-Error "Node 18+ required (found $(& node -v))."
  exit 1
}

& node (Join-Path $dir "bootstrap.js") @args
exit $LASTEXITCODE
