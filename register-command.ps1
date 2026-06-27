# register-command.ps1
# Jalankan SEKALI SAJA buat mendaftarkan slash command "/tanya" ke Discord.
# Cara pakai: ganti 2 nilai di bawah, lalu jalankan di PowerShell: .\register-command.ps1

$ApplicationId = "GANTI_DENGAN_APPLICATION_ID_KAMU"
$BotToken = "GANTI_DENGAN_BOT_TOKEN_KAMU"

$headers = @{
    "Authorization" = "Bot $BotToken"
    "Content-Type"  = "application/json"
}

$body = @(
    @{
        name        = "tanya"
        description = "Tanya apa saja ke Sigap"
        options     = @(
            @{
                name        = "pertanyaan"
                description = "Pertanyaan kamu"
                type        = 3
                required    = $true
            }
        )
    }
) | ConvertTo-Json -Depth 10

$uri = "https://discord.com/api/v10/applications/$ApplicationId/commands"

$result = Invoke-RestMethod -Uri $uri -Method Put -Headers $headers -Body $body
Write-Host "Berhasil! Command yang terdaftar:"
$result | Format-List
