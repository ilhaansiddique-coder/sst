param(
  [string]$SourcePath = "C:\Users\User\Downloads\SST_Development_Guide.docx",
  [string]$OutputPath = "D:\Development\SST\.local\SST_Development_Guide_Updated.docx"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ParagraphText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement]$Paragraph,
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlNamespaceManager]$NamespaceManager
  )

  $texts = $Paragraph.SelectNodes(".//w:t", $NamespaceManager)
  (($texts | ForEach-Object { $_.InnerText }) -join "")
}

function Find-ParagraphContaining {
  param(
    [Parameter(Mandatory = $true)]
    [xml]$DocumentXml,
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlNamespaceManager]$NamespaceManager,
    [Parameter(Mandatory = $true)]
    [string]$Fragment
  )

  $paragraphs = $DocumentXml.SelectNodes("//w:p", $NamespaceManager)

  foreach ($paragraph in $paragraphs) {
    $text = Get-ParagraphText -Paragraph $paragraph -NamespaceManager $NamespaceManager
    if ($text.Contains($Fragment)) {
      return $paragraph
    }
  }

  throw "Could not find paragraph containing: $Fragment"
}

function Set-ParagraphText {
  param(
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement]$Paragraph,
    [Parameter(Mandatory = $true)]
    [xml]$DocumentXml,
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlNamespaceManager]$NamespaceManager,
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $wordNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  $xmlNs = "http://www.w3.org/XML/1998/namespace"
  $firstRun = $Paragraph.SelectSingleNode("w:r", $NamespaceManager)
  $runProperties = $null

  if ($firstRun) {
    $runProperties = $firstRun.SelectSingleNode("w:rPr", $NamespaceManager)
  }

  foreach ($child in @($Paragraph.ChildNodes)) {
    if ($child.LocalName -ne "pPr") {
      [void]$Paragraph.RemoveChild($child)
    }
  }

  $run = $DocumentXml.CreateElement("w", "r", $wordNs)

  if ($runProperties) {
    [void]$run.AppendChild($runProperties.CloneNode($true))
  }

  $textNode = $DocumentXml.CreateElement("w", "t", $wordNs)
  if ($Text -match "^\s" -or $Text -match "\s$" -or $Text -match "\s{2,}") {
    $space = $DocumentXml.CreateAttribute("xml", "space", $xmlNs)
    $space.Value = "preserve"
    [void]$textNode.Attributes.Append($space)
  }

  $textNode.InnerText = $Text
  [void]$run.AppendChild($textNode)
  [void]$Paragraph.AppendChild($run)
}

function New-ParagraphLike {
  param(
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement]$TemplateParagraph,
    [Parameter(Mandatory = $true)]
    [xml]$DocumentXml,
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlNamespaceManager]$NamespaceManager,
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $clone = [System.Xml.XmlElement]$TemplateParagraph.CloneNode($true)
  Set-ParagraphText -Paragraph $clone -DocumentXml $DocumentXml -NamespaceManager $NamespaceManager -Text $Text
  $clone
}

function Insert-ParagraphsAfter {
  param(
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement]$ReferenceParagraph,
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement[]]$Paragraphs
  )

  $current = $ReferenceParagraph
  foreach ($paragraph in $Paragraphs) {
    $current = $current.ParentNode.InsertAfter($paragraph, $current)
  }
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Source document not found: $SourcePath"
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$tempDirectory = Join-Path $env:TEMP ("sst-guide-update-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDirectory | Out-Null

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory($SourcePath, $tempDirectory)

  $documentXmlPath = Join-Path $tempDirectory "word\document.xml"
  [xml]$documentXml = Get-Content -LiteralPath $documentXmlPath -Raw

  $namespaceManager = New-Object System.Xml.XmlNamespaceManager($documentXml.NameTable)
  $namespaceManager.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

  $tocRouter = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "3.4 The Router"
  $tocRouterInsert = New-ParagraphLike -TemplateParagraph $tocRouter -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "3.5 Delivery Retries, Failure Handling, and Replay20"
  Insert-ParagraphsAfter -ReferenceParagraph $tocRouter -Paragraphs @($tocRouterInsert)

  $tocLogs = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Real-Time Logs Page21"
  Set-ParagraphText -Paragraph $tocLogs -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Real-Time Logs / Log View System21"
  $tocRetry = New-ParagraphLike -TemplateParagraph $tocLogs -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Retry Monitoring and Failed Events21"
  Insert-ParagraphsAfter -ReferenceParagraph $tocLogs -Paragraphs @($tocRetry)

  $routeStepText = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Send to Meta CAPI, Google, TikTok in parallel"
  Set-ParagraphText -Paragraph $routeStepText -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Send to Meta CAPI, Google, TikTok in parallel with automatic retries"

  $logStepText = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Write to ClickHouse + increment Redis counter"
  Set-ParagraphText -Paragraph $logStepText -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Write the event plus every delivery attempt to ClickHouse + increment Redis counters"

  $logStepWhy = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Powers the dashboard (logs, analytics) and billing (usage metering)"
  $retryRequirement = New-ParagraphLike -TemplateParagraph $logStepWhy -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Important reliability requirement: if a destination call fails, the platform should retry it automatically 3-5 times with short exponential backoff before marking the delivery as failed. Every attempt must be logged so the dashboard can show the full delivery lifecycle."
  Insert-ParagraphsAfter -ReferenceParagraph $logStepWhy -Paragraphs @($retryRequirement)

  $routeSection = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "3.4 The Router"
  $routeBody = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "// This is step 6: send the enriched, hashed event to all configured destinations"
  $retryHeading = New-ParagraphLike -TemplateParagraph $routeSection -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "3.5 Delivery Retries, Failure Handling, and Replay"
  $retryBody1 = New-ParagraphLike -TemplateParagraph $logStepWhy -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "A destination should not be marked failed after a single transient error. For timeouts, 5xx responses, temporary rate limits, and network failures, the platform should automatically retry the delivery 3-5 times using exponential backoff, for example 5 seconds, 30 seconds, 2 minutes, 10 minutes, and 30 minutes."
  $retryBody2 = New-ParagraphLike -TemplateParagraph $logStepWhy -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Each retry attempt should create its own delivery-attempt log record with event_id, provider, attempt_number, request timestamp, response code, latency, error message, and final outcome. After the final allowed retry, mark that provider delivery as failed and move it into a replayable failed-events queue."
  $retryBody3 = New-ParagraphLike -TemplateParagraph $logStepWhy -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Why this matters: ad platform APIs fail temporarily in real life. Automatic retries recover a large share of deliveries without manual intervention, while the detailed attempt history makes debugging and customer support much easier."
  Insert-ParagraphsAfter -ReferenceParagraph $routeBody -Paragraphs @($retryHeading, $retryBody1, $retryBody2, $retryBody3)

  $logsHeading = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Real-Time Logs Page"
  Set-ParagraphText -Paragraph $logsHeading -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Real-Time Logs / Log View System"

  $logsIntro = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Shows a live stream of events as they flow through the platform."
  Set-ParagraphText -Paragraph $logsIntro -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Shows a live stream of every important lifecycle action in the platform, not just the final accepted event. The Log View System should display received, validated, deduplicated, enriched, hashed, queued, sent, retried, delivered, and failed states. Use Server-Sent Events (SSE) from the API for live updates and ClickHouse for historical search and filtering."

  $logsDetails = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Each log entry shows:"
  Set-ParagraphText -Paragraph $logsDetails -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Each log entry should show: timestamp, event ID, event name, page URL, pipeline stage, provider, attempt number, response code, latency, next retry time, final destination status (queued, retrying, delivered, failed), and total processing time."

  $analyticsHeading = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Analytics Page"
  $retryLogsHeading = New-ParagraphLike -TemplateParagraph $analyticsHeading -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Retry Monitoring and Failed Events"
  $retryLogsBody1 = New-ParagraphLike -TemplateParagraph $logStepWhy -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "If a destination call fails, the system should automatically retry it 3-5 times before classifying that provider delivery as failed. The Log View System must show the retry timeline, the last error message, the next retry time, and the final failure state."
  $retryLogsBody2 = New-ParagraphLike -TemplateParagraph $logStepWhy -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "The same Log View System should also expose important platform activity such as gateway credential updates, domain verification changes, replay actions, login and security events, subscription changes, and worker failures so operators can understand everything happening in the project from one place."
  Insert-ParagraphsAfter -ReferenceParagraph $logsDetails -Paragraphs @($retryLogsHeading, $retryLogsBody1, $retryLogsBody2)

  $week5Deliverable = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Real-time event log stream (SSE)"
  Set-ParagraphText -Paragraph $week5Deliverable -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Real-time Log View System (SSE), retry monitoring, failed-event explorer, and basic analytics charts (events/day, by platform, success rate)."

  $guideEnd = Find-ParagraphContaining -DocumentXml $documentXml -NamespaceManager $namespaceManager -Fragment "Start with Phase 2 (Event Pipeline)."
  $closingUpdate = New-ParagraphLike -TemplateParagraph $guideEnd -DocumentXml $documentXml -NamespaceManager $namespaceManager -Text "Updated requirement: the dashboard must include a Log View System that shows the full event lifecycle and platform activity history. Failed destination calls must retry automatically 3-5 times before being marked failed, and each attempt must be visible in the logs."
  Insert-ParagraphsAfter -ReferenceParagraph $guideEnd -Paragraphs @($closingUpdate)

  $writerSettings = New-Object System.Xml.XmlWriterSettings
  $writerSettings.Encoding = New-Object System.Text.UTF8Encoding($false)
  $writerSettings.Indent = $false

  $writer = [System.Xml.XmlWriter]::Create($documentXmlPath, $writerSettings)
  $documentXml.Save($writer)
  $writer.Close()

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }

  [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDirectory, $OutputPath)
  Write-Output "Updated document written to: $OutputPath"
}
finally {
  if (Test-Path -LiteralPath $tempDirectory) {
    Remove-Item -LiteralPath $tempDirectory -Recurse -Force
  }
}
