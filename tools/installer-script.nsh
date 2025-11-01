; Custom NSIS script for license parameter handling
; Custom NSIS script for license parameter handling
; This script processes --license-key and --license-email parameters
; and creates a temporary license file for auto-activation

!include "LogicLib.nsh"
!include "FileFunc.nsh"

; Use NSIS general-purpose registers ($R1, $R2) to avoid unused-variable warnings

; Use electron-builder hook macros instead of overriding core functions
; This avoids conflicts like "Function named .onInit already exists"

!macro customInit
  ; Initialize registers
  StrCpy $R1 ""
  StrCpy $R2 ""

  ; Get command line parameters
  ${GetParameters} $R0

  ; Check for --license-key parameter
  ${GetOptions} $R0 "--license-key=" $R1

  ; Check for --license-email parameter
  ${GetOptions} $R0 "--license-email=" $R2
!macroend

!macro customInstall
  ; Create activation file only if both parameters are provided
  ${If} $R1 != ""
  ${AndIf} $R2 != ""
    ; Create temporary license activation file inside install dir
    FileOpen $0 "$INSTDIR\license-activation.tmp" w
    FileWrite $0 '{"key":"$R1","email":"$R2"}'
    FileClose $0
    ; Hide file from casual browsing
    SetFileAttributes "$INSTDIR\license-activation.tmp" HIDDEN
  ${EndIf}
!macroend
