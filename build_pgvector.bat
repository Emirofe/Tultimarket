call "D:\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
cd /d "c:\Users\Emili\Downloads\TultiMarket_4\pgvector_src"
set "PGROOT=C:\Program Files\PostgreSQL\18"
nmake /F Makefile.win
nmake /F Makefile.win install
