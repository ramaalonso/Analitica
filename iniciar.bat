@echo off
title Yerbazo Analytics - Plataforma de Inteligencia Comercial
color 0A
echo ========================================================
echo        YERBAZO - ANALISIS COMERCIAL Y PRODUCTOS
echo ========================================================
echo.
echo Iniciando servidor y sincronizacion con Google Sheets...
echo Abriendo aplicacion en http://localhost:3001 ...
echo.
start http://localhost:3001
node server.js
pause
