@echo off
setlocal EnableDelayedExpansion

echo ----------------------------------------------------
echo BUTCEM AI - YZ OTOMATIK GITHUB BOTU
echo ----------------------------------------------------
echo.
echo [ISLEM] Git ayarlari yapilandiriliyor...

if not exist ".git" (
    git init
    git branch -M main
)

:: Yanlis girilmis olma ihtimaline karsi eski linki silip dogrusunu ekliyoruz
git remote remove origin 2>nul
git remote add origin https://github.com/volkan356/butcem.git

echo [BILGI] Guncellemeler Github veritabanina gonderiliyor, lutfen bekleyin...
git add .
git commit -m "Auto Update: Yeni ozellikler"
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo [BASARILI] Tum degisiklikler telefonunuza aktarildi. Sayfanizi 1 dakika icinde yenileyebilirsiniz.
) else (
    echo [UYARI] Bir hata olustu. Internette kesinti olabilir veya Github sifreniz istenebilir.
)
echo.
pause
