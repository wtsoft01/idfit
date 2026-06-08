$ErrorActionPreference = "Stop"

Write-Host "IDFIT Supabase migration apply" -ForegroundColor Cyan
Write-Host "This script asks for the Supabase DB password locally. The password is not printed or saved." -ForegroundColor Yellow
Write-Host "Project ref: gukjrwncthuiybgsktml" -ForegroundColor Gray

$securePassword = Read-Host "Enter Supabase DB password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

try {
  $env:SUPABASE_DB_PASSWORD = $plainPassword
  Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue

  Write-Host "Applying Supabase migrations..." -ForegroundColor Cyan
  npx supabase db push

  Write-Host "Verifying public.visible_products anon read..." -ForegroundColor Cyan
  node .\scripts\verify-visible-products.cjs
}
finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  $plainPassword = $null
}
