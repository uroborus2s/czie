@echo off
REM 删除所有 node_modules 目录
for /d /r . %%d in (node_modules) do (
    if exist "%%d" (
        echo Deleting "%%d"
        rd /s /q "%%d"
    )
)

REM 删除所有 .turbo 目录
for /d /r . %%d in (.turbo) do (
    if exist "%%d" (
        echo Deleting "%%d"
        rd /s /q "%%d"
    )
)

REM 删除所有 dist 目录
for /d /r . %%d in (dist) do (
    if exist "%%d" (
        echo Deleting "%%d"
        rd /s /q "%%d"
    )
)

REM 删除所有 tsconfig.tsbuildinfo 文件
for /r . %%f in (tsconfig.tsbuildinfo) do (
    if exist "%%f" (
        echo Deleting "%%f"
        del /f /q "%%f"
    )
)

echo Cleanup completed.
pause