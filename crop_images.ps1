# 이미지 여백 crop — 중앙 영역 기준으로 상하좌우 trim
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$srcDir = Join-Path $base 'pptx_assets'
$outDir = Join-Path $srcDir 'cropped'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

function Is-Content($c, $t) {
    if ($c.A -lt 100) { return $false }
    return ($c.R -lt $t -or $c.G -lt $t -or $c.B -lt $t)
}

function Get-FocusBounds($bmp, $threshold, $rowMin, $colMin) {
    $w = $bmp.Width; $h = $bmp.Height
    $x0 = [int]($w * 0.05); $x1 = [int]($w * 0.95)
    $y0 = [int]($h * 0.05); $y1 = [int]($h * 0.95)

    $top = $y0
    for ($y = $y0; $y -lt $y1; $y += 2) {
        $n = 0; $t = 0
        for ($x = $x0; $x -lt $x1; $x += 4) {
            $t++
            if (Is-Content ($bmp.GetPixel($x, $y)) $threshold) { $n++ }
        }
        if ($t -gt 0 -and ($n / $t) -ge $rowMin) { $top = $y; break }
    }

    $bottom = $y1
    for ($y = $y1; $y -ge $top; $y -= 2) {
        $n = 0; $t = 0
        for ($x = $x0; $x -lt $x1; $x += 4) {
            $t++
            if (Is-Content ($bmp.GetPixel($x, $y)) $threshold) { $n++ }
        }
        if ($t -gt 0 -and ($n / $t) -ge $rowMin) { $bottom = $y; break }
    }

    $midY0 = [int]($h * 0.2); $midY1 = [int]($h * 0.8)
    $left = $x0
    for ($x = $x0; $x -lt $x1; $x += 2) {
        $n = 0; $t = 0
        for ($y = $midY0; $y -lt $midY1; $y += 4) {
            $t++
            if (Is-Content ($bmp.GetPixel($x, $y)) $threshold) { $n++ }
        }
        if ($t -gt 0 -and ($n / $t) -ge $colMin) { $left = $x; break }
    }

    $right = $x1
    for ($x = $x1; $x -ge $left; $x -= 2) {
        $n = 0; $t = 0
        for ($y = $midY0; $y -lt $midY1; $y += 4) {
            $t++
            if (Is-Content ($bmp.GetPixel($x, $y)) $threshold) { $n++ }
        }
        if ($t -gt 0 -and ($n / $t) -ge $colMin) { $right = $x; break }
    }

    $cw = $right - $left + 1
    $ch = $bottom - $top + 1
    if ($cw -lt 40 -or $ch -lt 40) { return $null }
    return @{ X = $left; Y = $top; W = $cw; H = $ch }
}

function Crop-File($path, $dest, $pad) {
    $ext = [IO.Path]::GetExtension($path).ToLower()
    if ($ext -eq '.gif') { Copy-Item $path $dest -Force; return }
    $img = [System.Drawing.Image]::FromFile($path)
    try {
        $bmp = New-Object System.Drawing.Bitmap $img
        $r = Get-FocusBounds $bmp 245 0.035 0.025
        if (-not $r) { Copy-Item $path $dest -Force; return }
        $x = [Math]::Max(0, $r.X - $pad)
        $y = [Math]::Max(0, $r.Y - $pad)
        $w = [Math]::Min($bmp.Width - $x, $r.W + 2 * $pad)
        $h = [Math]::Min($bmp.Height - $y, $r.H + 2 * $pad)
        $crop = New-Object System.Drawing.Bitmap $w, $h
        $g = [System.Drawing.Graphics]::FromImage($crop)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $src = New-Object System.Drawing.Rectangle $x, $y, $w, $h
        $g.DrawImage($bmp, 0, 0, $src, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Dispose()
        if ($ext -eq '.png') { $crop.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png) }
        else {
            $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
            $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, 92L)
            $crop.Save($dest, $enc, $ep)
        }
        $crop.Dispose()
    } finally { $img.Dispose() }
}

$n = 0
Get-ChildItem $srcDir -File | Where-Object { $_.Extension -match '\.(jpe?g|png)$' } | ForEach-Object {
    Crop-File $_.FullName (Join-Path $outDir $_.Name) 8
    $n++
}
Write-Host "Done $n images"
