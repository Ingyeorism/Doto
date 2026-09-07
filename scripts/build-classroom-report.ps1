$ErrorActionPreference = 'Stop'
$reportRoot = Join-Path $PSScriptRoot '../reports'
$reportParts = @(
  @{ Id = 'report'; File = '도토_가상수업_검토보고서.md'; Label = '01 · 검토 보고서' },
  @{ Id = 'lessons'; File = '도토_가상수업_지도약안.md'; Label = '02 · 지도약안' },
  @{ Id = 'manuscripts'; File = '도토_가상학생_원고모음.md'; Label = '03 · 학생 원고' }
)
$reportTemp = Join-Path ([IO.Path]::GetTempPath()) ('doto-report-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $reportTemp | Out-Null
$reportSections = @()
try {
  foreach ($part in $reportParts) {
    $fragmentPath = Join-Path $reportTemp ($part.Id + '.html')
    & npx.cmd --yes --package=marked marked --gfm -i (Join-Path $reportRoot $part.File) -o $fragmentPath
    if ($LASTEXITCODE -ne 0) { throw '보고서 Markdown 변환에 실패했습니다.' }
    $fragment = [IO.File]::ReadAllText($fragmentPath)
    $reportSections += '<article id="' + $part.Id + '"><p class="section-label">' + $part.Label + '</p>' + $fragment + '</article>'
  }
  $reportTemplate = @'
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>도토 · 1차 UI와 가상 수업 보고서</title>
<style>
:root{--ink:#353a30;--muted:#777264;--paper:#fffdf8;--cream:#f2ede2;--green:#4e6541;--line:#dfdacd;--accent:#a75d38}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:86px}body{margin:0;background:var(--cream);color:var(--ink);font-family:"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;font-size:15px;line-height:1.85;word-break:keep-all;overflow-wrap:anywhere}a{color:var(--green);text-decoration-thickness:1px;text-underline-offset:3px}a:hover{color:var(--accent)}
.masthead{max-width:1220px;margin:auto;padding:58px 42px 34px}.eyebrow,.section-label{font-size:12px;letter-spacing:.13em;color:var(--green);font-weight:800}.masthead h1{font-size:clamp(30px,4vw,48px);line-height:1.35;letter-spacing:-.055em;margin:16px 0}.lede{max-width:820px;font-size:18px;margin:0;color:#676558}.meta{font-size:13px;color:var(--muted);margin:20px 0 0}.scope{padding:16px 20px;border-left:3px solid #b78653;background:#ebe2d1;max-width:920px;font-size:14px;margin:26px 0 0}.stats{display:grid;grid-template-columns:repeat(3,1fr);max-width:720px;gap:12px;margin-top:24px}.stat{border:1px solid var(--line);border-radius:12px;padding:14px 18px;background:#f8f5ec}.stat strong{display:block;font-size:26px;line-height:1.4;color:var(--green)}.stat span{font-size:12px;color:var(--muted)}
nav{position:sticky;top:0;background:#f2ede2f5;border-top:1px solid var(--line);border-bottom:1px solid var(--line);backdrop-filter:blur(12px);z-index:2}.nav-inner{max-width:1220px;margin:auto;display:flex;gap:8px;padding:10px 42px;align-items:center;flex-wrap:wrap}nav a,nav button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:7px 15px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;border:0;background:transparent;font-family:inherit;color:var(--green)}nav a:hover,nav button:hover{background:#e4e8dc}nav button{margin-left:auto;background:var(--green);color:white;cursor:pointer}nav button:hover{background:#384d2d;color:white}
main{max-width:1220px;margin:0 auto;padding:32px 42px 56px}article{background:var(--paper);padding:42px;margin-bottom:28px;border:1px solid var(--line);border-radius:16px;box-shadow:0 6px 28px #55472205}article h1{font-size:27px;letter-spacing:-.045em;line-height:1.5;margin:10px 0 16px}article h2{font-size:21px;letter-spacing:-.025em;margin:36px 0 16px;padding-top:12px;border-top:1px solid var(--line)}article h3{font-size:17px;margin:30px 0 10px;color:var(--green)}p{margin:12px 0}ul,ol{padding-left:23px}li{padding-left:4px;margin:6px 0}strong{font-weight:750}code{font-family:Consolas,monospace;background:#f0ece2;font-size:.9em;border-radius:4px;padding:2px 5px}table{width:100%;border-collapse:separate;border-spacing:0;margin:20px 0 26px;font-size:13px;line-height:1.8;border:1px solid var(--line);border-radius:9px;overflow:hidden}th{text-align:left;background:#e9eddf;color:#415336;font-weight:750}th,td{padding:12px 14px;vertical-align:top;border-bottom:1px solid var(--line)}tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#faf7ef}th:first-child{width:20%}blockquote{border-left:3px solid #c5a477;padding:2px 20px;background:#f8f1e4;margin:20px 0}footer{max-width:1220px;margin:auto;padding:0 42px 36px;font-size:13px;color:var(--muted)}:focus-visible{outline:3px solid #b87f48;outline-offset:3px}
@media(max-width:760px){body{font-size:14px}.masthead{padding:32px 18px 26px}.lede{font-size:16px}.nav-inner{padding:8px 12px;gap:0}nav a,nav button{padding:7px 10px;font-size:12px}.stats{gap:6px}.stat{padding:12px}.stat strong{font-size:24px}main{padding:20px 10px}article{padding:24px 16px;border-radius:12px}article h1{font-size:23px}article h2{font-size:19px}table{display:block;overflow-x:auto}th,td{min-width:110px;padding:10px}td:last-child{min-width:180px}footer{padding:0 20px 24px}}
@media print{@page{size:A4;margin:15mm}html{scroll-padding-top:0}body{background:white;color:#222;font-size:10pt;line-height:1.6}.masthead{padding:0 0 18px}.masthead h1{font-size:30pt}.lede{font-size:12pt}.scope{font-size:10pt}.stats{max-width:100%}nav{display:none}main{padding:0;max-width:none}article{border:0;border-radius:0;box-shadow:none;padding:0;margin:0;break-before:page}article h1{font-size:20pt}article h2{font-size:14pt}article h3{font-size:12pt}h1,h2,h3{break-after:avoid}table{font-size:8.5pt;display:table;overflow:visible;border-radius:0}th,td{padding:7px;min-width:0}tr{break-inside:avoid}thead{display:table-header-group}a{color:inherit}footer{padding:20px 0 0}.stat{background:white}.section-label{margin-top:0}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
<header class="masthead">
<div class="eyebrow">DOTO · CLASSROOM NOTES / 01</div>
<h1>작은 생각을 쓰고,<br>함께 읽는 수업</h1>
<p class="lede">도토 1차 UI 수정 결과와 서평·국가유산 조사 수업의 가상 사용성 검토를 한곳에 담았습니다.</p>
<p class="meta">2026.09.05 · 초등 5~6학년 기준 · 교사 PC / 학생 태블릿 화면 키보드 · 모두 프로그램 사용 초보</p>
<div class="scope"><strong>가상 수업 보고서입니다.</strong> 화면은 직접 조작했으며 학생 글과 예상 발언은 AI가 구성했습니다. 실제 아동 인터뷰·태블릿 동시 접속·Android 키보드 검증 결과가 아닙니다.</div>
<div class="stats"><div class="stat"><strong>2개 수업</strong><span>각 40분 × 2차시 지도약안</span></div><div class="stat"><strong>6명</strong><span>가상 학생의 순차 역할 시뮬레이션</span></div><div class="stat"><strong>12개 원고</strong><span>게시 8 · 미게시 4 / 의도한 시나리오</span></div></div>
</header>
<nav aria-label="보고서 목차"><div class="nav-inner"><a href="#report">검토 보고서</a><a href="#lessons">지도약안</a><a href="#manuscripts">학생 원고</a><button type="button" onclick="window.print()">인쇄 / PDF 저장</button></div></nav>
<main>__REPORT_SECTIONS__</main>
<footer>도토 프로젝트 · 이 문서는 브라우저에서 바로 읽거나 인쇄할 수 있습니다. 수업 게시판 링크는 도토 개발 서버가 실행 중일 때 열립니다.</footer>
</body>
</html>
'@
  $reportHtml = $reportTemplate.Replace('__REPORT_SECTIONS__', ($reportSections -join "`n"))
  [IO.File]::WriteAllText((Join-Path $reportRoot '도토_가상수업_보고서.html'), $reportHtml, [Text.UTF8Encoding]::new($false))
  Write-Output '완료: reports/도토_가상수업_보고서.html'
}
finally {
  foreach ($part in $reportParts) {
    $fragmentPath = Join-Path $reportTemp ($part.Id + '.html')
    if (Test-Path -LiteralPath $fragmentPath) { Remove-Item -LiteralPath $fragmentPath }
  }
  Remove-Item -LiteralPath $reportTemp
}
