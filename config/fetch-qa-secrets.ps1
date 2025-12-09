# Fetch QA secrets from AWS Secrets Manager for local development
# Usage: .\config\fetch-qa-secrets.ps1
# Requires: AWS CLI configured with appropriate permissions

Write-Host "Fetching QA secrets from AWS Secrets Manager..." -ForegroundColor Cyan

# Secret ARN bases (without the key part)
$secretArns = @{
    "database" = "qa/ranger/database-lUy449"
    "auth" = "qa/ranger/auth-TTXPZ8"
    "aws-credentials" = "qa/ranger/aws-credentials-XXXXXX"
    "api-keys" = "qa/ranger/api-keys-XXXXXX"
    "app-config" = "qa/ranger/app-config-gtS2h8"
}

$envContent = @"
# QA Environment Variables
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# WARNING: Contains sensitive data - DO NOT COMMIT

"@

foreach ($secretName in $secretArns.Keys) {
    Write-Host "Fetching $secretName..." -ForegroundColor Yellow
    try {
        $secretValue = aws secretsmanager get-secret-value --secret-id $secretArns[$secretName] --region us-east-1 --query SecretString --output text 2>$null
        if ($secretValue) {
            $secrets = $secretValue | ConvertFrom-Json
            $envContent += "`n# $secretName secrets`n"
            foreach ($property in $secrets.PSObject.Properties) {
                $envContent += "$($property.Name)=$($property.Value)`n"
            }
        }
    } catch {
        Write-Host "  Failed to fetch $secretName - check your AWS permissions" -ForegroundColor Red
    }
}

# Write to .env.qa file
$outputPath = Join-Path $PSScriptRoot ".." ".env.qa"
$envContent | Out-File -FilePath $outputPath -Encoding utf8

Write-Host "`nSecrets written to: $outputPath" -ForegroundColor Green
Write-Host "To use: Copy the values you need to your .env file" -ForegroundColor Cyan
