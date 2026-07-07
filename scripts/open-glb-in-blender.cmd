@echo off
setlocal

set "BLENDER=%LOCALAPPDATA%\Programs\blender-5.1.2-windows-x64\blender.exe"
set "IMPORTER=%~dp0import-glb-for-blender.py"
set "ASSET=%~1"

if "%ASSET%"=="" (
  echo No GLB or GLTF file was provided.
  pause
  exit /b 1
)

if not exist "%BLENDER%" (
  echo Blender was not found at:
  echo %BLENDER%
  pause
  exit /b 1
)

if not exist "%IMPORTER%" (
  echo Blender import script was not found at:
  echo %IMPORTER%
  pause
  exit /b 1
)

start "" "%BLENDER%" --factory-startup --python "%IMPORTER%" -- "%ASSET%"
exit /b 0
