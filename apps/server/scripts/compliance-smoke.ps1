$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3101'

function Invoke-Json($url, $body) {
  try { return Invoke-RestMethod $url -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 240 }
  catch {
    $response = $_.Exception.Response
    if ($response) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $bodyText = $reader.ReadToEnd()
      Write-Host "HTTP $([int]$response.StatusCode): $bodyText"
    }
    throw
  }
}

Write-Host '1) health'
Invoke-RestMethod "$base/api/health" | ConvertTo-Json -Compress

Write-Host '2) generate gateway image'
$single = '{"type":"\u767d\u5e95\u56fe","prompt":"\u8f7b\u91cf\u901a\u52e4\u6258\u7279\u5305\uff0c\u7eaf\u767d\u80cc\u666f\uff0c\u5546\u54c1\u5c45\u4e2d\uff0c\u7535\u5546\u5546\u54c1\u6444\u5f71","platform":"Amazon","model":"wan2.7-image-pro"}'
$generated = Invoke-Json "$base/api/images/single" $single
$image = $generated.image.url
Write-Host "Generated image URL received"

Write-Host '3) compliance-check'
$compliance = '{"imageUrl":"' + $image + '","imageType":"\u573a\u666f\u56fe","platform":"Amazon","market":"US"}'
Invoke-Json "$base/api/compliance-check" $compliance | ConvertTo-Json -Depth 8

foreach ($aspect in @('scene', 'text', 'model')) {
  Write-Host "4) localize $aspect"
  $localize = '{"sourceUrl":"' + $image + '","targetMarket":"US","instruction":"Keep the product unchanged","aspects":["' + $aspect + '"],"targetLanguage":"English","modelProfile":"Western face model"}'
  Invoke-Json "$base/api/images/localize" $localize | ConvertTo-Json -Depth 8
}

Write-Host 'Done'
