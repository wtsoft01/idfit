@echo off
setlocal
cd /d "%~dp0.."
echo IDFIT Supabase migration apply
echo Project ref: gukjrwncthuiybgsktml
echo.
echo Paste/enter the Supabase DB password below. It will only live in this terminal session.
set /p SUPABASE_DB_PASSWORD=Supabase DB password: 
set SUPABASE_ACCESS_TOKEN=
echo.
echo Applying Supabase migrations...
call npx supabase db push
if errorlevel 1 goto failed
echo.
echo Verifying public.visible_products anon read...
call node .\scripts\verify-visible-products.cjs
if errorlevel 1 goto failed
echo.
echo Done. You can close this window.
goto end
:failed
echo.
echo Failed. Please copy the visible error message only, not the password.
:end
set SUPABASE_DB_PASSWORD=
pause
endlocal
