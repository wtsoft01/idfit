Option Explicit

Dim shell, fso, projectDir, bundledNodeExe, nodeExe, scriptPath, logPath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = "C:\Users\Admin\AppData\Roaming\V-Claw\.openclaw\workspace\main\projects\dealfinder"
bundledNodeExe = "C:\Program Files\V-Claw\resources\node-runtime\win-x64\node.exe"
If fso.FileExists(bundledNodeExe) Then
  nodeExe = bundledNodeExe
Else
  nodeExe = "node"
End If

scriptPath = projectDir & "\scripts\ensure-live-sync-watcher.mjs"
logPath = projectDir & "\logs\idfit-live-sync-startup.log"

command = "cmd.exe /c cd /d """ & projectDir & """ && """ & nodeExe & """ """ & scriptPath & """ > """ & logPath & """ 2>&1"
shell.Run command, 0, False
