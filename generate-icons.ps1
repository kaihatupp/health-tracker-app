Add-Type -AssemblyName System.Drawing

function New-HealthIcon {
    param(
        [int]$Size,
        [string]$Path
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $bgColor = [System.Drawing.ColorTranslator]::FromHtml('#2f7d5e')
    $g.Clear($bgColor)

    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

    $armLength = $Size * 0.5
    $armThickness = $Size * 0.18

    # vertical bar
    $g.FillRectangle(
        $whiteBrush,
        [float]($Size / 2 - $armThickness / 2),
        [float]($Size / 2 - $armLength / 2),
        [float]$armThickness,
        [float]$armLength
    )
    # horizontal bar
    $g.FillRectangle(
        $whiteBrush,
        [float]($Size / 2 - $armLength / 2),
        [float]($Size / 2 - $armThickness / 2),
        [float]$armLength,
        [float]$armThickness
    )

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$iconsDir = Join-Path $PSScriptRoot 'icons'
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir | Out-Null
}

New-HealthIcon -Size 192 -Path (Join-Path $iconsDir 'icon-192.png')
New-HealthIcon -Size 512 -Path (Join-Path $iconsDir 'icon-512.png')
New-HealthIcon -Size 512 -Path (Join-Path $iconsDir 'icon-512-maskable.png')
New-HealthIcon -Size 180 -Path (Join-Path $iconsDir 'apple-touch-icon.png')

Write-Output "Icons generated in $iconsDir"
