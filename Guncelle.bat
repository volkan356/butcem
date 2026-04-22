@echo off
setlocal EnableDelayedExpansion

echo ----------------------------------------------------
echo BUTCEM AI - YZ OTOMATIK GITHUB BOTU
echo ----------------------------------------------------
echo.

if exist ".git" goto :HasGit

echo [BILGI] Bu klasor henuz GitHub sistemine dogrudan bagli degil. 
echo Otomatik botun calisabilmesi icin bir kereye mahsus 
echo GitHub deponuzun linkini girmeniz gerekiyor.
echo Ornek link: https://github.com/kullanici-adiniz/butcem.git
echo.
set /p REPO_URL="Linkinizi buraya yapistirin ve Enter tusuna basin: "

if "!REPO_URL!"=="" (
    echo [HATA] Link girmediginiz icin islem iptal edildi.
    pause
    exit /b
)

echo.
echo [ISLEM] Git altyapisi kuruluyor...
git init
git branch -M main
git remote add origin !REPO_URL!
echo [BASARILI] Klasor GitHub sistemine baglandi!
echo.

:HasGit
echo [BILGI] Guncellemeler Github veritabanina gonderiliyor, lutfen bekleyin...
git add .
git commit -m "Auto Update: Yeni ozellikler ve hatasiz bot"
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo [BASARILI] Tum degisiklikler telefonunuza aktarildi. Sayfanizi 1 dakika icinde yenileyebilirsiniz.
) else (
    echo [UYARI] Bir hata olustu. Github linki hatali veya internetiniz kesik olabilir. 
    echo Lutfen ekrandaki hatayi okuyun.
)
echo.
pause
