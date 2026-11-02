Option Explicit

Dim shell, fso, projectDirectory, installCommand, exitCode, serverCommand, argument, logPath

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Named.Exists("validate") Then
    WScript.Quit 0
End If

projectDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDirectory
shell.Environment("PROCESS")("NODE_ENV") = "production"

' Match Start.bat's dependency setup, but keep its console hidden.
installCommand = "cmd.exe /d /s /c ""npm install --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev --ignore-scripts"""
exitCode = shell.Run(installCommand, 0, True)

If exitCode <> 0 Then
    MsgBox "EasierTavern bagimliliklari yuklenemedi. Start.bat dosyasini calistirarak ayrintilari gorebilirsiniz.", vbCritical, "EasierTavern"
    WScript.Quit exitCode
End If

logPath = projectDirectory & "\data\easiertavern-silent.log"
serverCommand = "node.exe server.js"

' Forward optional arguments and quote them safely.
For Each argument In WScript.Arguments
    serverCommand = serverCommand & " " & Chr(34) & Replace(CStr(argument), Chr(34), Chr(92) & Chr(34)) & Chr(34)
Next

' Keep diagnostics available even though the console window is hidden.
serverCommand = "cmd.exe /d /s /c """ & serverCommand & " >> """ & logPath & """ 2>&1"""

' Window style 0 starts Node hidden. False lets this launcher exit immediately.
shell.Run serverCommand, 0, False

