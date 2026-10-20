@echo off
rem Opens the Fact Find in Chrome from this folder, so that Chrome remembers the microphone permission.
rem (A page opened straight from a file makes Chrome ask again and again.) Nothing is installed and nothing leaves this computer.
rem The first time, answer the microphone question with "Allow on every visit" (or "Allow while visiting the site").
rem A small minimised window called "Fact Find" stays open while it runs: close it to stop.
title Fact Find
start "Fact Find (close this window to stop)" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FactFindServer.ps1"
