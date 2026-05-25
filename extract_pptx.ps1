$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pptx = Get-ChildItem $base -Filter '*.pptx' | Select-Object -First 1
$zipCopy = Join-Path $base '_pptx.zip'
$tmp = Join-Path $base '_pptx_tmp'
$out = Join-Path $base 'pptx_assets'

if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
if (Test-Path $zipCopy) { Remove-Item $zipCopy -Force }
New-Item -ItemType Directory -Path $out -Force | Out-Null
Copy-Item $pptx.FullName $zipCopy
Expand-Archive -Path $zipCopy -DestinationPath $tmp -Force

$slidesDir = Join-Path $tmp 'ppt\slides'
$relsDir = Join-Path $tmp 'ppt\slides\_rels'
$mediaDir = Join-Path $tmp 'ppt\media'

$parser = New-Object System.Xml.XmlDocument
$ns = @{ a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
         r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' }

function Get-SlideTexts($xmlPath) {
    [xml]$doc = Get-Content $xmlPath -Encoding UTF8
    $texts = @()
    $nodes = $doc.SelectNodes('//*[local-name()="t"]')
    foreach ($n in $nodes) {
        $t = $n.InnerText.Trim()
        if ($t) { $texts += $t }
    }
    return $texts
}

function Get-SlideImages($slideNum, $xmlPath) {
    $relsPath = Join-Path $relsDir "slide${slideNum}.xml.rels"
    if (-not (Test-Path $relsPath)) { return @() }
    [xml]$rels = Get-Content $relsPath -Encoding UTF8
    $map = @{}
    foreach ($rel in $rels.Relationships.Relationship) {
        if ($rel.Type -like '*image*') {
            $map[$rel.Id] = $rel.Target -replace '^\.\./', 'ppt/'
        }
    }
    [xml]$doc = Get-Content $xmlPath -Encoding UTF8
    $imgs = @()
    $blips = $doc.SelectNodes('//*[local-name()="blip"]')
    foreach ($b in $blips) {
        $embed = $b.GetAttribute('embed', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        if ($embed -and $map.ContainsKey($embed)) { $imgs += $map[$embed] }
    }
    return $imgs
}

$results = @()
Get-ChildItem $slidesDir -Filter 'slide*.xml' | Sort-Object { [int]($_.BaseName -replace 'slide','') } | ForEach-Object {
    $num = [int]($_.BaseName -replace 'slide','')
    $texts = Get-SlideTexts $_.FullName
    $imgTargets = Get-SlideImages $num $_.FullName
    $saved = @()
    $j = 0
    foreach ($target in $imgTargets) {
        $src = Join-Path $tmp ($target -replace '/', '\')
        if (Test-Path $src) {
            $ext = [IO.Path]::GetExtension($src)
            $destName = ('slide{0:D2}_img{1}{2}' -f $num, $j, $ext)
            Copy-Item $src (Join-Path $out $destName) -Force
            $saved += $destName
            $j++
        }
    }
    $results += [PSCustomObject]@{ slide = $num; texts = $texts; images = $saved }
    $preview = ($texts | Select-Object -First 6) -join ' | '
    if ($preview.Length -gt 100) { $preview = $preview.Substring(0,100) + '...' }
    Write-Host ("Slide {0,2}: imgs={1} {2}" -f $num, $saved.Count, $preview)
}

$results | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $base 'pptx_extract.json') -Encoding UTF8
Write-Host "Done. $($results.Count) slides -> pptx_assets/"
