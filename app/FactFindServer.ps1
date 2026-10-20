# Serves this folder at http://localhost:8765/ so Chrome remembers "Allow microphone" (on a page opened from a file it asks again and again).
# Nothing is installed and nothing leaves this computer: the address works only on this computer, and the Fact Find still saves its files where you choose.
# Started by "Start Fact Find.bat". Close its window to stop it.
param([int]$Port = 8765, [switch]$NoBrowser)

$root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$url = "http://localhost:$Port/index.html"
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.wasm' = 'application/wasm'; '.txt' = 'text/plain; charset=utf-8'; '.map' = 'application/json'
  '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'; '.pdf' = 'application/pdf'
}

function Open-Browser([string]$address) {
  if ($NoBrowser) { return }
  try { Start-Process -FilePath 'chrome' -ArgumentList $address -ErrorAction Stop }
  catch {
    try { Start-Process -FilePath "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" -ArgumentList $address -ErrorAction Stop }
    catch {
      try { Start-Process -FilePath "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" -ArgumentList $address -ErrorAction Stop }
      catch { Start-Process $address }
    }
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch {
  # Already running (a second click on the shortcut), or the address cannot be used: open the Fact Find anyway.
  Write-Host "The Fact Find is already running at $url (or could not start: $($_.Exception.Message))."
  Open-Browser $url
  Start-Sleep -Seconds 3
  return
}

Write-Host "Fact Find is running at $url"
Write-Host "Leave this window open (you can minimise it). Close it to stop."
Open-Browser $url

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $rel))
    if (-not $file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
    }
    elseif (-not [System.IO.File]::Exists($file)) {
      $res.StatusCode = 404
    }
    else {
      $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
      $type = $types[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.StatusCode = 200
      $res.ContentType = $type
      $res.AddHeader('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
    }
  }
  catch { try { $res.StatusCode = 500 } catch { } }
  finally { try { $res.Close() } catch { } }
}
