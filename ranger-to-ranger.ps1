# Interactive Name Replacement Script (Ranger -> Ranger)
# Converts Ranger branding to Ranger branding
# Source: https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat
# Target: https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat
# Domain: ranger.tcbinternal.net

# Configuration: illuma-agents package version
$IllumaAgentsVersion = "1.0.8"

$DefaultReplacementPairs = @(
    # STEP 1: Domain replacements (Ranger domains -> Ranger domain) - FIRST
    @{ From = "https://ranger.tcbinternal.net"; To = "https://ranger.tcbinternal.net" },
    @{ From = "https://ranger.tcbinternal.net"; To = "https://ranger.tcbinternal.net" },
    @{ From = "ranger.tcbinternal.net"; To = "ranger.tcbinternal.net" },
    @{ From = "https://docs.ranger.tcbinternal.net"; To = "https://docs.ranger.tcbinternal.net" },
    @{ From = "docs.ranger.tcbinternal.net"; To = "docs.ranger.tcbinternal.net" },
    @{ From = "noreply@ranger.tcbinternal.net"; To = "noreply@ranger.tcbinternal.net" },
    @{ From = "contact@ranger.tcbinternal.net"; To = "contact@ranger.tcbinternal.net" },
    @{ From = "support@ranger.tcbinternal.net"; To = "support@ranger.tcbinternal.net" },
    
    # STEP 1.5: Environment variables and config
    @{ From = "APP_TITLE='Ranger'"; To = "APP_TITLE='Ranger'" },
    @{ From = 'APP_TITLE="Ranger"'; To = 'APP_TITLE="Ranger"' },
    @{ From = "APP_TITLE=Ranger"; To = "APP_TITLE=Ranger" },
    @{ From = "appTitle: 'Ranger'"; To = "appTitle: 'Ranger'" },
    @{ From = 'appTitle: "Ranger"'; To = 'appTitle: "Ranger"' },
    
    # STEP 2: GitHub URLs (TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat -> TexasCapitalDevelopment/coretex...)
    @{ From = "git+https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat.git"; To = "git+https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat.git" },
    @{ From = "https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat.git"; To = "https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat.git" },
    @{ From = "https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat"; To = "https://github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat" },
    @{ From = "github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat"; To = "github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat" },
    @{ From = "TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat"; To = "TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat" },
    @{ From = "https://github.com/TexasCapitalDevelopment/"; To = "https://github.com/TexasCapitalDevelopment/" },
    @{ From = "TexasCapitalDevelopment"; To = "TexasCapitalDevelopment" },
    
    # STEP 3: Remove GitHub issues and discussions links (delete completely)
    @{ From = ""; To = "" },
    @{ From = ""; To = "" },
    @{ From = ""; To = "" },
    @{ From = ""; To = "" },
    
    # STEP 4: Docker registry (ghcr.io TexasCapitalDevelopment -> TexasCapitalDevelopment, ranger -> ranger)
    @{ From = "ghcr.io/TexasCapitalDevelopment/ranger-dev-api"; To = "ghcr.io/TexasCapitalDevelopment/ranger-dev-api" },
    @{ From = "ghcr.io/TexasCapitalDevelopment/ranger-dev"; To = "ghcr.io/TexasCapitalDevelopment/ranger-dev" },
    @{ From = "ghcr.io/TexasCapitalDevelopment/ranger-rag-api-dev-lite"; To = "ghcr.io/TexasCapitalDevelopment/ranger-rag-api-dev-lite" },
    @{ From = "ghcr.io/TexasCapitalDevelopment/ranger-rag-api-dev"; To = "ghcr.io/TexasCapitalDevelopment/ranger-rag-api-dev" },
    @{ From = "ghcr.io/TexasCapitalDevelopment/ranger"; To = "ghcr.io/TexasCapitalDevelopment/ranger" },
    @{ From = "ghcr.io/TexasCapitalDevelopment/"; To = "ghcr.io/TexasCapitalDevelopment/" },
    
    # STEP 5: NPM package names
    @{ From = '"name": "ranger"'; To = '"name": "ranger"' },
    @{ From = '"name": "@ranger/'; To = '"name": "@ranger/' },
    @{ From = "@ranger/"; To = "@ranger/" },
    
    # STEP 5.5: Agents package renaming (except package.json and package-lock.json)
    @{ From = "illuma-agents"; To = "illuma-agents"; ExcludeFiles = @("package.json", "package-lock.json") },
    @{ From = "illuma-agents"; To = "illuma-agents"; ExcludeFiles = @("package.json", "package-lock.json") },
    @{ From = "illuma-agents"; To = "illuma-agents"; ExcludeFiles = @("package.json", "package-lock.json") },
    
    # STEP 6: Remove Ranger documentation links completely
    @{ From = "https://docs.ranger.tcbinternal.net/install"; To = "" },
    @{ From = "https://docs.ranger.tcbinternal.net/features"; To = "" },
    @{ From = "https://docs.ranger.tcbinternal.net/config"; To = "" },
    @{ From = "https://docs.ranger.tcbinternal.net/deployment"; To = "" },
    @{ From = "https://docs.ranger.tcbinternal.net"; To = "" },
    @{ From = "docs.ranger.tcbinternal.net"; To = "" },
    
    # STEP 6.5: PWA Manifest (vite.config.ts)
    @{ From = "name: 'Ranger'"; To = "name: 'Ranger'" },
    @{ From = "short_name: 'Ranger'"; To = "short_name: 'Ranger'" },
    
    # STEP 6.6: Toolkit and credential generator URLs
    @{ From = "https://ranger.tcbinternal.net/toolkit/creds_generator"; To = "" },
    @{ From = "https://ranger.tcbinternal.net/changelog"; To = "" },
    @{ From = "ranger.tcbinternal.net/toolkit"; To = "" },
    @{ From = "www.ranger.tcbinternal.net"; To = "" },
    
    # STEP 6.7: HTML meta tags and title (client/index.html)
    @{ From = '<meta name="description" content="Ranger - Enterprise AI Chat Application" />'; To = '<meta name="description" content="Ranger - Enterprise AI Chat Application" />' },
    @{ From = '<title>Ranger</title>'; To = '<title>Ranger</title>' },
    
    # STEP 7: Name replacements (MUST be last to not interfere with URLs above)
    @{ From = "RANGER"; To = "RANGER" },
    @{ From = "Ranger"; To = "Ranger" },
    @{ From = "Ranger"; To = "Ranger" },
    @{ From = "ranger"; To = "ranger" },
    @{ From = "Ranger"; To = "Ranger" },
    @{ From = "ranger"; To = "ranger" },
    
    # STEP 8: License removal (remove MIT license attribution to Ranger if present)
    @{ From = ''; To = "" },
    @{ From = ''; To = "" },
    @{ From = ''; To = "" },
    @{ From = 'Copyright (c) 2025 Ranger'; To = "" },
    @{ From = 'Copyright (c) 2023 Ranger'; To = "" },
    @{ From = 'Copyright (c) 2024 Ranger'; To = "" }
)

$ExcludeFolders = @(".git", "node_modules", ".vs", "bin", "obj", "dist", "build", ".next", ".vscode", "coverage", "target", ".nuxt", ".output")
$ExcludeExtensions = @(".exe", ".dll", ".pdb", ".zip", ".tar", ".gz", ".jpg", ".jpeg", ".png", ".gif", ".ico", ".pdf", ".mp4", ".mp3", ".wav", ".mov", ".avi", ".lock")
$ExcludeFileNames = @("package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb")

# Color coded output functions
function Write-Info { 
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan 
}

function Write-Success { 
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green 
}

function Write-Warning { 
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow 
}

function Write-Error { 
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red 
}

function Write-DryRun { 
    param([string]$Message)
    Write-Host "[PREVIEW] $Message" -ForegroundColor Magenta 
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Blue
    Write-Host $Message -ForegroundColor White
    Write-Host ("=" * 60) -ForegroundColor Blue
    Write-Host ""
}

# Clear screen for better presentation
Clear-Host

Write-Header "RANGER TO RANGER CONVERSION TOOL"

Write-Info "This script will convert Ranger to Ranger in:"
Write-Info "  - File contents"
Write-Info "  - File names"
Write-Info "  - Folder names"
Write-Host ""
Write-Warning "Source: Ranger (github.com/TexasCapitalDevelopment/coretex.ai.technology.enterprise-chat)"
Write-Warning "Target: Ranger (ranger.tcbinternal.net)"
Write-Host ""

# Get workspace path interactively
do {
    Write-Host "Enter the workspace path (or drag and drop folder here):" -ForegroundColor Yellow
    $WorkspacePath = Read-Host
    
    # Remove quotes if present (from drag and drop)
    $WorkspacePath = $WorkspacePath.Trim('"')
    $WorkspacePath = $WorkspacePath.Trim("'")
    
    if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
        Write-Error "Path cannot be empty. Please try again."
        continue
    }
    
    if (-not (Test-Path $WorkspacePath)) {
        Write-Error "Path does not exist: $WorkspacePath"
        Write-Host "Please enter a valid path." -ForegroundColor Yellow
        continue
    }
    
    if (-not (Test-Path $WorkspacePath -PathType Container)) {
        Write-Error "Path is not a directory: $WorkspacePath"
        Write-Host "Please enter a directory path." -ForegroundColor Yellow
        continue
    }
    
    break
} while ($true)

$WorkspacePath = Resolve-Path $WorkspacePath
Write-Success "Workspace path validated: $WorkspacePath"
Write-Host ""

# Ask about replacements
Write-Host "Choose replacement option:" -ForegroundColor Yellow
Write-Host "1. Use default (Ranger->Ranger conversion)" -ForegroundColor White
Write-Host "2. Enter custom replacements" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Enter choice (1 or 2)"

$Replacements = $DefaultReplacementPairs

if ($choice -eq "2") {
    $Replacements = @()
    Write-Host ""
    Write-Info "Enter custom replacements (empty from to finish):"
    
    while ($true) {
        $from = Read-Host "Replace FROM"
        if ([string]::IsNullOrWhiteSpace($from)) { break }
        
        $to = Read-Host "Replace TO  "
        $Replacements += @{ From = $from; To = $to }
        Write-Success "Added: $from -> $to"
        Write-Host ""
    }
    
    if ($Replacements.Count -eq 0) {
        Write-Warning "No replacements defined. Using defaults."
        $Replacements = $DefaultReplacementPairs
    }
}

Write-Host ""
Write-Header "REPLACEMENTS TO BE APPLIED"

Write-Info "Total replacement patterns: $($Replacements.Count)"
Write-Host ""
foreach ($pair in $Replacements) {
    if ($pair.From -ne "" -or $pair.To -ne "") {
        Write-Info "  '$($pair.From)' -> '$($pair.To)'"
    }
}

Write-Host ""

# Ask for dry run
Write-Host "Do you want to preview changes first (recommended)? [Y/N]" -ForegroundColor Yellow
$dryRunChoice = Read-Host
$DryRun = $dryRunChoice -ne 'N' -and $dryRunChoice -ne 'n'

if ($DryRun) {
    Write-Warning "PREVIEW MODE - No actual changes will be made"
} else {
    Write-Warning "LIVE MODE - Changes will be applied immediately"
    Write-Host "Are you sure you want to proceed? [Y/N]" -ForegroundColor Red
    $confirm = Read-Host
    if ($confirm -ne 'Y' -and $confirm -ne 'y') {
        Write-Info "Operation cancelled."
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
        exit
    }
}

# Statistics
$stats = [ordered]@{
    FilesScanned = 0
    FilesModified = 0
    FoldersRenamed = 0
    FilesRenamed = 0
    FilesDeleted = 0
    ContentReplacements = 0
    Errors = 0
    StartTime = Get-Date
}

# Function to check if path should be excluded
function Should-Exclude {
    param([string]$Path)
    
    foreach ($excludeFolder in $ExcludeFolders) {
        $pattern1 = "*\$excludeFolder\*"
        $pattern2 = "*\$excludeFolder"
        $pattern3 = "*/$excludeFolder/*"
        $pattern4 = "*/$excludeFolder"
        
        if ($Path -like $pattern1 -or $Path -like $pattern2 -or $Path -like $pattern3 -or $Path -like $pattern4) {
            return $true
        }
    }
    return $false
}

# Function to check if file should be excluded by extension
function Should-ExcludeFile {
    param([string]$FilePath)
    
    $extension = [System.IO.Path]::GetExtension($FilePath)
    $fileName = [System.IO.Path]::GetFileName($FilePath)
    
    if ($ExcludeExtensions -contains $extension) {
        return $true
    }
    
    if ($ExcludeFileNames -contains $fileName) {
        return $true
    }
    
    return $false
}

# Function to perform replacements in a string
function Replace-Names {
    param(
        [string]$Text,
        [string]$FilePath = ""
    )
    
    $modified = $Text
    $fileName = if ($FilePath) { [System.IO.Path]::GetFileName($FilePath) } else { "" }
    
    # Process each replacement pair
    foreach ($pair in $Replacements) {
        if ($pair.From -eq "") {
            continue
        }
        
        # Check if this file should be excluded for this replacement
        if ($pair.ContainsKey('ExcludeFiles') -and $fileName) {
            $shouldExclude = $false
            foreach ($excludeFile in $pair.ExcludeFiles) {
                if ($fileName -eq $excludeFile) {
                    $shouldExclude = $true
                    break
                }
            }
            if ($shouldExclude) {
                continue
            }
        }
        
        # Check if this is a regex pattern
        if ($pair.ContainsKey('IsRegex') -and $pair.IsRegex) {
            # Use regex directly
            $regex = [regex]::new($pair.From, [System.Text.RegularExpressions.RegexOptions]::None)
            $modified = $regex.Replace($modified, $pair.To)
        } else {
            # Build case-sensitive regex pattern from literal string
            $pattern = [regex]::Escape($pair.From)
            $regex = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::None)
            $modified = $regex.Replace($modified, $pair.To)
        }
    }
    
    return $modified
}

# Step 1: Replace content in files
Write-Header "STEP 1: REPLACING CONTENT IN FILES"

$files = Get-ChildItem -Path $WorkspacePath -File -Recurse -ErrorAction SilentlyContinue
$totalFiles = $files.Count
$currentFile = 0

foreach ($file in $files) {
    $currentFile++
    
    if (Should-Exclude $file.FullName) {
        continue
    }
    
    if (Should-ExcludeFile $file.FullName) {
        continue
    }
    
    $stats.FilesScanned++
    
    # Show progress
    if ($currentFile % 10 -eq 0 -or $currentFile -eq $totalFiles) {
        Write-Host "`rProcessing files: $currentFile/$totalFiles" -NoNewline -ForegroundColor Gray
    }
    
    try {
        # Read file content with proper encoding
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop
        
        if ($null -eq $content -or $content.Length -eq 0) {
            continue
        }
        
        $newContent = Replace-Names $content $file.FullName
        
        if ($content -ne $newContent) {
            if ($DryRun) {
                Write-Host "`r                                                    `r" -NoNewline
                Write-DryRun "Would modify: $($file.FullName)"
            } else {
                # Write with UTF8 encoding without BOM
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::WriteAllText($file.FullName, $newContent, $utf8NoBom)
                Write-Host "`r                                                    `r" -NoNewline
                Write-Success "Modified: $($file.FullName)"
            }
            $stats.FilesModified++
            
            # Count replacements
            foreach ($pair in $Replacements) {
                if ($pair.From -eq "") {
                    continue
                }
                $pattern = [regex]::Escape($pair.From)
                $regex = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::None)
                $matches = $regex.Matches($content)
                $stats.ContentReplacements += $matches.Count
            }
        }
    }
    catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg -notlike "*binary file*" -and $errorMsg -notlike "*used by another process*") {
            Write-Warning "Error processing $($file.Name): $errorMsg"
            $stats.Errors++
        }
    }
}

Write-Host "`r                                                    `r" -NoNewline
Write-Success "Content replacement complete. Modified $($stats.FilesModified) files."

# Step 2: Rename files
Write-Header "STEP 2: RENAMING FILES"

$filesToRename = Get-ChildItem -Path $WorkspacePath -File -Recurse -ErrorAction SilentlyContinue | Sort-Object { $_.FullName.Length } -Descending

foreach ($file in $filesToRename) {
    if (Should-Exclude $file.FullName) {
        continue
    }
    
    $newName = Replace-Names $file.Name
    
    if ($file.Name -ne $newName) {
        $newPath = Join-Path $file.DirectoryName $newName
        
        if ($DryRun) {
            Write-DryRun "Would rename file: $($file.Name) -> $newName"
            $stats.FilesRenamed++
        } else {
            try {
                if (Test-Path $newPath) {
                    Write-Warning "Target already exists, skipping: $newPath"
                } else {
                    Rename-Item -Path $file.FullName -NewName $newName -Force
                    Write-Success "Renamed file: $($file.Name) -> $newName"
                    $stats.FilesRenamed++
                }
            }
            catch {
                Write-Error "Failed to rename: $($file.FullName)"
                $stats.Errors++
            }
        }
    }
}

if ($stats.FilesRenamed -eq 0 -and -not $DryRun) {
    Write-Info "No files needed renaming."
}

# Step 3: Rename folders
Write-Header "STEP 3: RENAMING FOLDERS"

$folders = Get-ChildItem -Path $WorkspacePath -Directory -Recurse -ErrorAction SilentlyContinue | Sort-Object { $_.FullName.Length } -Descending

foreach ($folder in $folders) {
    if (Should-Exclude $folder.FullName) {
        continue
    }
    
    $newName = Replace-Names $folder.Name
    
    if ($folder.Name -ne $newName) {
        $newPath = Join-Path $folder.Parent.FullName $newName
        
        if ($DryRun) {
            Write-DryRun "Would rename folder: $($folder.Name) -> $newName"
            $stats.FoldersRenamed++
        } else {
            try {
                if (Test-Path $newPath) {
                    Write-Warning "Target already exists, skipping: $newPath"
                } else {
                    Rename-Item -Path $folder.FullName -NewName $newName -Force
                    Write-Success "Renamed folder: $($folder.Name) -> $newName"
                    $stats.FoldersRenamed++
                }
            }
            catch {
                Write-Error "Failed to rename: $($folder.FullName)"
                $stats.Errors++
            }
        }
    }
}

if ($stats.FoldersRenamed -eq 0 -and -not $DryRun) {
    Write-Info "No folders needed renaming."
}

# Step 4: Delete README.md, CHANGELOG.md, and documentation files from workspace root
Write-Header "STEP 4: DELETING README, CHANGELOG, AND .GITHUB FOLDER"

$filesToDelete = @("README.md", "CHANGELOG.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "AUTHORS", "AUTHORS.md")
$foldersToDelete = @(".github", "helm")
$deletedFiles = 0
$deletedFolders = 0

foreach ($fileName in $filesToDelete) {
    $filePath = Join-Path $WorkspacePath $fileName
    
    if (Test-Path $filePath) {
        if ($DryRun) {
            Write-DryRun "Would delete: $fileName"
            $deletedFiles++
            $stats.FilesDeleted++
        } else {
            try {
                Remove-Item -Path $filePath -Force
                Write-Success "Deleted: $fileName"
                $deletedFiles++
                $stats.FilesDeleted++
            }
            catch {
                Write-Error "Failed to delete: $fileName"
                $stats.Errors++
            }
        }
    } else {
        Write-Info "File not found (skipping): $fileName"
    }
}

if ($deletedFiles -eq 0 -and -not $DryRun) {
    Write-Info "No files needed deletion."
}

# Delete folders
foreach ($folderName in $foldersToDelete) {
    $folderPath = Join-Path $WorkspacePath $folderName
    
    if (Test-Path $folderPath) {
        if ($DryRun) {
            Write-DryRun "Would delete folder: $folderName"
            $deletedFolders++
        } else {
            try {
                Remove-Item -Path $folderPath -Recurse -Force
                Write-Success "Deleted folder: $folderName"
                $deletedFolders++
            }
            catch {
                Write-Error "Failed to delete folder: $folderName"
                $stats.Errors++
            }
        }
    } else {
        Write-Info "Folder not found (skipping): $folderName"
    }
}

if ($deletedFolders -eq 0 -and -not $DryRun) {
    Write-Info "No folders needed deletion."
}

# Step 5: Update root package.json version to 1.0.0
Write-Header "STEP 5: UPDATING ROOT PACKAGE.JSON VERSION"

$rootPackageJson = Join-Path $WorkspacePath "package.json"

if (Test-Path $rootPackageJson) {
    try {
        $content = Get-Content -Path $rootPackageJson -Raw -Encoding UTF8
        $regex = [regex]::new('(?<="version":\s*")[^"]+(?=")', [System.Text.RegularExpressions.RegexOptions]::None)
        $newContent = $regex.Replace($content, '1.0.0', 1)  # Only replace first occurrence
        
        if ($content -ne $newContent) {
            if ($DryRun) {
                Write-DryRun "Would update version to 1.0.0 in root package.json"
            } else {
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::WriteAllText($rootPackageJson, $newContent, $utf8NoBom)
                Write-Success "Updated version to 1.0.0 in root package.json"
            }
        } else {
            Write-Info "Version already set to 1.0.0 or no version found in root package.json"
        }
    }
    catch {
        Write-Error "Failed to update root package.json version: $($_.Exception.Message)"
        $stats.Errors++
    }
} else {
    Write-Info "Root package.json not found (skipping version update)"
}

# Step 6: Update agents dependency in all package.json files
Write-Header "STEP 6: UPDATING AGENTS DEPENDENCY IN ALL PACKAGE.JSON FILES"

$allPackageJsonFiles = Get-ChildItem -Path $WorkspacePath -Filter "package.json" -Recurse -ErrorAction SilentlyContinue | Where-Object {
    -not (Should-Exclude $_.FullName) -and -not (Should-ExcludeFile $_.FullName)
}

$packagesUpdated = 0

foreach ($packageFile in $allPackageJsonFiles) {
    try {
        $content = Get-Content -Path $packageFile.FullName -Raw -Encoding UTF8
        
        # Check if any of the agents dependencies exist
        $patterns = @(
            '"illuma-agents":\s*"[^"]+"',
            '"illuma-agents":\s*"[^"]+"',
            '"illuma-agents":\s*"[^"]+"'
        )
        
        $modified = $content
        $hasChanges = $false
        
        foreach ($pattern in $patterns) {
            $regex = [regex]::new($pattern, [System.Text.RegularExpressions.RegexOptions]::None)
            if ($regex.IsMatch($modified)) {
                $modified = $regex.Replace($modified, """illuma-agents"": ""^$IllumaAgentsVersion""")
                $hasChanges = $true
            }
        }
        
        if ($hasChanges) {
            if ($DryRun) {
                Write-DryRun "Would update agents dependency to illuma-agents@^$IllumaAgentsVersion in $($packageFile.FullName)"
                $packagesUpdated++
            } else {
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::WriteAllText($packageFile.FullName, $modified, $utf8NoBom)
                Write-Success "Updated agents dependency to illuma-agents@^$IllumaAgentsVersion in $($packageFile.FullName)"
                $packagesUpdated++
            }
        }
    }
    catch {
        Write-Error "Failed to update $($packageFile.FullName): $($_.Exception.Message)"
        $stats.Errors++
    }
}

if ($packagesUpdated -eq 0) {
    Write-Info "No agents dependencies found in any package.json files"
} else {
    Write-Success "Updated agents dependency in $packagesUpdated package.json file(s)"
}

# Calculate duration
$duration = (Get-Date) - $stats.StartTime
$minutes = [int]$duration.TotalMinutes
$seconds = [int]$duration.Seconds

# Final Summary
Write-Header "OPERATION COMPLETE!"

Write-Host "SUMMARY STATISTICS" -ForegroundColor White
Write-Host ("-" * 40) -ForegroundColor Gray
Write-Host ""

Write-Info "Files scanned:        $($stats.FilesScanned)"
Write-Success "Files modified:       $($stats.FilesModified)"
Write-Success "Content replacements: $($stats.ContentReplacements)"
Write-Success "Files renamed:        $($stats.FilesRenamed)"
Write-Success "Folders renamed:      $($stats.FoldersRenamed)"
Write-Success "Files deleted:        $($stats.FilesDeleted)"

if ($stats.Errors -gt 0) {
    Write-Error "Errors encountered:   $($stats.Errors)"
}

Write-Host ""
Write-Info "Time taken: $minutes minutes $seconds seconds"
Write-Host ""

if ($DryRun) {
    Write-Host ("=" * 60) -ForegroundColor Yellow
    Write-Warning "This was a PREVIEW RUN. No actual changes were made."
    Write-Info "Run the script again and choose N for preview to apply changes."
    Write-Host ("=" * 60) -ForegroundColor Yellow
} else {
    Write-Host ("=" * 60) -ForegroundColor Green
    Write-Success "Ranger has been converted to Ranger successfully!"
    Write-Host ("=" * 60) -ForegroundColor Green
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
