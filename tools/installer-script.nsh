; Custom NSIS script for license parameter handling
; This script processes --license-key and --license-email parameters
; and creates a temporary license file for auto-activation

!include "LogicLib.nsh"
!include "FileFunc.nsh"

; Variables for license parameters
Var LicenseKey
Var LicenseEmail
Var HasLicenseParams

; Function to parse command line parameters
Function .onInit
  ; Initialize variables
  StrCpy $LicenseKey ""
  StrCpy $LicenseEmail ""
  StrCpy $HasLicenseParams "false"
  
  ; Get command line parameters
  ${GetParameters} $R0
  
  ; Check for --license-key parameter
  ${GetOptions} $R0 "--license-key=" $R1
  ${If} $R1 != ""
    StrCpy $LicenseKey $R1
    StrCpy $HasLicenseParams "true"
  ${EndIf}
  
  ; Check for --license-email parameter  
  ${GetOptions} $R0 "--license-email=" $R2
  ${If} $R2 != ""
    StrCpy $LicenseEmail $R2
    StrCpy $HasLicenseParams "true"
  ${EndIf}
FunctionEnd

; Function to create license activation file after installation
Function .onInstSuccess
  ; Only create license file if both parameters are provided
  ${If} $HasLicenseParams == "true"
  ${AndIf} $LicenseKey != ""
  ${AndIf} $LicenseEmail != ""
    ; Create temporary license activation file
    FileOpen $0 "$INSTDIR\license-activation.tmp" w
    FileWrite $0 '{"key":"$LicenseKey","email":"$LicenseEmail","timestamp":"${__TIMESTAMP__}"}'
    FileClose $0
    
    ; Set file attributes to hidden
    SetFileAttributes "$INSTDIR\license-activation.tmp" HIDDEN
  ${EndIf}
FunctionEnd