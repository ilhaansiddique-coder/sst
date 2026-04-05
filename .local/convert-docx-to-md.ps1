param(
    [string]$InputPath = ".local/SST_Development_Guide_Updated.docx",
    [string]$OutputPath = ".local/SST_Development_Guide_Updated.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$WordNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
$Utf8 = [System.Text.Encoding]::UTF8
$CodePage1252 = [System.Text.Encoding]::GetEncoding(1252)

function Get-NamespaceManager {
    param([xml]$XmlDocument)

    $ns = [System.Xml.XmlNamespaceManager]::new($XmlDocument.NameTable)
    $ns.AddNamespace("w", $WordNs)
    return $ns
}

function Get-EntryXml {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DocxPath,
        [Parameter(Mandatory = $true)]
        [string]$EntryName
    )

    $resolvedPath = (Resolve-Path -LiteralPath $DocxPath).Path
    $fileStream = [System.IO.File]::Open(
        $resolvedPath,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite
    )

    try {
        $zip = [System.IO.Compression.ZipArchive]::new(
            $fileStream,
            [System.IO.Compression.ZipArchiveMode]::Read,
            $false
        )

        try {
            $entry = $zip.GetEntry($EntryName)
            if (-not $entry) {
                return $null
            }

            $entryStream = $entry.Open()
            try {
                $reader = [System.IO.StreamReader]::new($entryStream)
                try {
                    $text = $reader.ReadToEnd()
                }
                finally {
                    $reader.Dispose()
                }
            }
            finally {
                $entryStream.Dispose()
            }
        }
        finally {
            $zip.Dispose()
        }
    }
    finally {
        $fileStream.Dispose()
    }

    $xml = [xml]$text
    return $xml
}

function Get-ParagraphStyle {
    param(
        [System.Xml.XmlNode]$Paragraph,
        [System.Xml.XmlNamespaceManager]$Ns
    )

    $styleNode = $Paragraph.SelectSingleNode("./w:pPr/w:pStyle", $Ns)
    if (-not $styleNode) {
        return ""
    }

    return $styleNode.GetAttribute("val", $WordNs)
}

function Get-ListMetadata {
    param(
        [System.Xml.XmlNode]$Paragraph,
        [System.Xml.XmlNamespaceManager]$Ns
    )

    $numIdNode = $Paragraph.SelectSingleNode("./w:pPr/w:numPr/w:numId", $Ns)
    $ilvlNode = $Paragraph.SelectSingleNode("./w:pPr/w:numPr/w:ilvl", $Ns)

    if (-not $numIdNode) {
        return $null
    }

    return [pscustomobject]@{
        NumId = $numIdNode.GetAttribute("val", $WordNs)
        Level = if ($ilvlNode) { [int]$ilvlNode.GetAttribute("val", $WordNs) } else { 0 }
    }
}

function Get-RunText {
    param([System.Xml.XmlNode]$Run)

    $parts = [System.Collections.Generic.List[string]]::new()

    foreach ($child in $Run.ChildNodes) {
        switch ($child.LocalName) {
            "t" {
                $parts.Add($child.InnerText)
            }
            "br" {
                $parts.Add("`n")
            }
            "cr" {
                $parts.Add("`n")
            }
            "tab" {
                $parts.Add("`t")
            }
            "noBreakHyphen" {
                $parts.Add("-")
            }
            "softHyphen" {
            }
            "lastRenderedPageBreak" {
            }
            default {
            }
        }
    }

    return ($parts -join "")
}

function Get-NodeText {
    param([System.Xml.XmlNode]$Node)

    $parts = [System.Collections.Generic.List[string]]::new()

    foreach ($child in $Node.ChildNodes) {
        switch ($child.LocalName) {
            "r" {
                $parts.Add((Get-RunText -Run $child))
            }
            "hyperlink" {
                $parts.Add((Get-NodeText -Node $child))
            }
            "smartTag" {
                $parts.Add((Get-NodeText -Node $child))
            }
            "sdt" {
                $parts.Add((Get-NodeText -Node $child))
            }
            "proofErr" {
            }
            "bookmarkStart" {
            }
            "bookmarkEnd" {
            }
            default {
                if ($child.HasChildNodes) {
                    $parts.Add((Get-NodeText -Node $child))
                }
            }
        }
    }

    return ($parts -join "")
}

function Normalize-ParagraphText {
    param([string]$Text)

    $value = Repair-Mojibake -Text $Text
    $value = $value.Replace([char]0xA0, " ")
    $value = $value -replace "\r", ""
    $value = $value -replace "\n\s*", " "
    $value = $value.Trim()
    return $value
}

function Normalize-CodeText {
    param([string]$Text)

    $value = Repair-Mojibake -Text $Text
    $value = $value.Replace([char]0xA0, " ")
    $lines = @($value -split "\r?\n")

    while ($lines.Count -gt 0 -and $lines[0].Trim().Length -eq 0) {
        $lines = $lines[1..($lines.Count - 1)]
    }

    while ($lines.Count -gt 0 -and $lines[-1].Trim().Length -eq 0) {
        if ($lines.Count -eq 1) {
            $lines = @()
        }
        else {
            $lines = $lines[0..($lines.Count - 2)]
        }
    }

    if ($lines.Count -gt 0) {
        $allIndented = $true
        foreach ($line in $lines) {
            if ($line.Trim().Length -eq 0) {
                continue
            }

            if (-not $line.StartsWith("  ")) {
                $allIndented = $false
                break
            }
        }

        if ($allIndented) {
            $lines = $lines | ForEach-Object {
                if ($_.Length -ge 2) { $_.Substring(2) } else { $_ }
            }
        }
    }

    $lines = $lines | ForEach-Object { $_.TrimEnd() }
    return ($lines -join "`n")
}

function Repair-Mojibake {
    param([string]$Text)

    if ([string]::IsNullOrEmpty($Text)) {
        return $Text
    }

    $value = $Text
    for ($pass = 0; $pass -lt 2; $pass++) {
        $containsMarker =
            $value.IndexOf([char]0x00C3) -ge 0 -or
            $value.IndexOf([char]0x00C2) -ge 0 -or
            $value.IndexOf([char]0x00E2) -ge 0

        if (-not $containsMarker) {
            break
        }

        $candidate = $Utf8.GetString($CodePage1252.GetBytes($value))
        if ($candidate -eq $value) {
            break
        }

        $value = $candidate
    }

    return $value
}

function Test-IsCodeParagraph {
    param(
        [System.Xml.XmlNode]$Paragraph,
        [System.Xml.XmlNamespaceManager]$Ns
    )

    $style = Get-ParagraphStyle -Paragraph $Paragraph -Ns $Ns
    if ($style -eq "HTMLPreformatted") {
        return $true
    }

    $shadingNode = $Paragraph.SelectSingleNode("./w:pPr/w:shd", $Ns)
    if ($shadingNode -and $shadingNode.GetAttribute("fill", $WordNs) -eq "1A1A1A") {
        return $true
    }

    $fontNode = $Paragraph.SelectSingleNode(".//w:rPr/w:rFonts", $Ns)
    if ($fontNode) {
        $asciiFont = $fontNode.GetAttribute("ascii", $WordNs)
        $hAnsiFont = $fontNode.GetAttribute("hAnsi", $WordNs)
        if ($asciiFont -eq "Consolas" -or $hAnsiFont -eq "Consolas") {
            return $true
        }
    }

    return $false
}

function Escape-TableCell {
    param([string]$Text)

    $value = Normalize-ParagraphText -Text $Text
    $value = $value -replace "\|", "\|"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return " "
    }

    return $value
}

function Convert-TableToMarkdown {
    param(
        [System.Xml.XmlNode]$Table,
        [System.Xml.XmlNamespaceManager]$Ns
    )

    $rows = [System.Collections.Generic.List[object]]::new()

    foreach ($rowNode in $Table.SelectNodes("./w:tr", $Ns)) {
        $cells = [System.Collections.Generic.List[string]]::new()
        foreach ($cellNode in $rowNode.SelectNodes("./w:tc", $Ns)) {
            $cellText = Get-NodeText -Node $cellNode
            $cells.Add((Escape-TableCell -Text $cellText))
        }

        if ($cells.Count -gt 0) {
            $rows.Add($cells.ToArray())
        }
    }

    if ($rows.Count -eq 0) {
        return @()
    }

    $columnCount = 0
    foreach ($row in $rows) {
        if ($row.Count -gt $columnCount) {
            $columnCount = $row.Count
        }
    }

    for ($index = 0; $index -lt $rows.Count; $index++) {
        $row = [System.Collections.Generic.List[string]]::new()
        foreach ($cell in ([string[]]$rows[$index])) {
            $row.Add($cell)
        }

        while ($row.Count -lt $columnCount) {
            $row.Add(" ")
        }

        $rows[$index] = $row.ToArray()
    }

    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add("| " + ($rows[0] -join " | ") + " |")

    $separator = for ($column = 0; $column -lt $columnCount; $column++) { "---" }
    $lines.Add("| " + ($separator -join " | ") + " |")

    for ($index = 1; $index -lt $rows.Count; $index++) {
        $lines.Add("| " + ($rows[$index] -join " | ") + " |")
    }

    return $lines.ToArray()
}

$documentXml = Get-EntryXml -DocxPath $InputPath -EntryName "word/document.xml"
if (-not $documentXml) {
    throw "Could not read word/document.xml from $InputPath"
}

$ns = [System.Xml.XmlNamespaceManager]::new($documentXml.NameTable)
$ns.AddNamespace("w", $WordNs)
$bodyNode = $documentXml.DocumentElement.SelectSingleNode("./w:body", $ns)
if (-not $bodyNode) {
    throw "Could not find the document body in $InputPath"
}

$bodyNodes = $bodyNode.ChildNodes

$lines = [System.Collections.Generic.List[string]]::new()
$pendingCodeLines = [System.Collections.Generic.List[string]]::new()
$lastOutputWasListItem = $false

function Flush-CodeBlock {
    param(
        [System.Collections.Generic.List[string]]$OutputLines,
        [System.Collections.Generic.List[string]]$CodeLines
    )

    if ($CodeLines.Count -eq 0) {
        return
    }

    $OutputLines.Add('```text')
    foreach ($codeLine in $CodeLines) {
        $OutputLines.Add($codeLine)
    }
    $OutputLines.Add('```')
    $OutputLines.Add("")
    $CodeLines.Clear()
}

foreach ($node in $bodyNodes) {
    if ($node.LocalName -eq "tbl") {
        if ($lastOutputWasListItem -and ($lines.Count -eq 0 -or $lines[-1] -ne "")) {
            $lines.Add("")
        }
        $lastOutputWasListItem = $false
        Flush-CodeBlock -OutputLines $lines -CodeLines $pendingCodeLines

        $tableLines = Convert-TableToMarkdown -Table $node -Ns $ns
        foreach ($tableLine in $tableLines) {
            $lines.Add($tableLine)
        }
        $lines.Add("")
        continue
    }

    if ($node.LocalName -ne "p") {
        continue
    }

    $rawText = Get-NodeText -Node $node
    $style = Get-ParagraphStyle -Paragraph $node -Ns $ns

    if (Test-IsCodeParagraph -Paragraph $node -Ns $ns) {
        if ($lastOutputWasListItem -and ($lines.Count -eq 0 -or $lines[-1] -ne "")) {
            $lines.Add("")
        }
        $lastOutputWasListItem = $false
        $codeText = Normalize-CodeText -Text $rawText
        if ($codeText.Length -gt 0) {
            foreach ($codeLine in ($codeText -split "\r?\n")) {
                $pendingCodeLines.Add($codeLine)
            }
        }
        continue
    }

    Flush-CodeBlock -OutputLines $lines -CodeLines $pendingCodeLines

    $text = Normalize-ParagraphText -Text $rawText
    if ($text.Length -eq 0) {
        $lastOutputWasListItem = $false
        if ($lines.Count -eq 0 -or $lines[-1] -ne "") {
            $lines.Add("")
        }
        continue
    }

    if ($style -match "^Heading([1-6])$") {
        if ($lastOutputWasListItem -and ($lines.Count -eq 0 -or $lines[-1] -ne "")) {
            $lines.Add("")
        }
        $lastOutputWasListItem = $false
        $level = [int]$Matches[1]
        $lines.Add(("#" * $level) + " " + $text)
        $lines.Add("")
        continue
    }

    if ($style -match "^TOC([1-6])$") {
        if ($lastOutputWasListItem -and ($lines.Count -eq 0 -or $lines[-1] -ne "")) {
            $lines.Add("")
        }
        $lastOutputWasListItem = $false
        $level = [int]$Matches[1]
        $lines.Add(("#" * $level) + " " + $text)
        $lines.Add("")
        continue
    }

    $listMeta = Get-ListMetadata -Paragraph $node -Ns $ns
    if ($listMeta) {
        $indent = "  " * $listMeta.Level
        $lines.Add($indent + "- " + $text)
        $lastOutputWasListItem = $true
        continue
    }

    if ($lastOutputWasListItem -and ($lines.Count -eq 0 -or $lines[-1] -ne "")) {
        $lines.Add("")
    }
    $lastOutputWasListItem = $false
    $lines.Add($text)
    $lines.Add("")
}

Flush-CodeBlock -OutputLines $lines -CodeLines $pendingCodeLines

while ($lines.Count -gt 0 -and $lines[-1] -eq "") {
    $lines.RemoveAt($lines.Count - 1)
}

$markdown = ($lines -join "`n") + "`n"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $OutputPath), $markdown, [System.Text.UTF8Encoding]::new($false))
