param (
    [string]$JsonPath = ".\version-history.json",
    [string]$ImageName = "telegram-multi-instance-manager"
)

# Inicializa o JSON caso não exista
if (-Not (Test-Path $JsonPath)) {
    $initialData = @{
        dockerAccount = ""
        latest = "0.1.0"
        history = @(
            @{ version = "0.1.0"; date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss"); type = "initial" }
        )
    }
    $initialData | ConvertTo-Json -Depth 5 | Out-File $JsonPath -Encoding utf8
    Write-Host "Arquivo de registro $JsonPath criado com sucesso com a versão inicial 0.1.0." -ForegroundColor Green
}

# Lê o JSON de versões
$versionData = Get-Content $JsonPath -Raw | ConvertFrom-Json

# Verifica/Pede a conta do Docker
$dockerAccount = $versionData.dockerAccount
if ([string]::IsNullOrWhiteSpace($dockerAccount)) {
    $dockerAccount = Read-Host "Digite o nome da sua conta do Docker Hub (ex: armandocastrodesousajunior)"
    $versionData.dockerAccount = $dockerAccount
} else {
    Write-Host "`nConta Docker armazenada anteriormente: $dockerAccount" -ForegroundColor Cyan
    $accountChoice = Read-Host "Deseja utilizar essa mesma conta? (S/N) [Padrão: S]"
    if ($accountChoice -eq "N" -or $accountChoice -eq "n") {
        $dockerAccount = Read-Host "Digite o novo nome da conta do Docker Hub"
        $versionData.dockerAccount = $dockerAccount
    }
}

$currentVersion = $versionData.latest
Write-Host "`n=== GERENCIADOR DE VERSÕES DO DOCKER ===" -ForegroundColor Cyan
Write-Host "Versão Atual: $currentVersion" -ForegroundColor Yellow
Write-Host "Conta Docker: $dockerAccount`n"

# Menu de opções
Write-Host "Escolha o tipo de atualização:"
Write-Host "1. Correção de Bug (Patch) - Ex: 1.0.0 -> 1.0.1"
Write-Host "2. Novos Recursos (Minor)  - Ex: 1.0.1 -> 1.1.0"
Write-Host "3. Nova Versão (Major)     - Ex: 1.1.0 -> 2.0.0"
Write-Host "4. Versão Personalizada    - Você digita a versão"
$choice = Read-Host "`nDigite a opção desejada (1-4)"

$newVersion = ""
$updateType = ""

# Lógica de Semantic Versioning
if ($choice -ne "4") {
    $versionParts = $currentVersion.Split('.')
    if ($versionParts.Length -ne 3) {
        Write-Host "Erro: A versão atual ($currentVersion) não está no formato X.Y.Z." -ForegroundColor Red
        Write-Host "Forçando opção 4 (Personalizada)." -ForegroundColor Yellow
        $choice = "4"
    } else {
        $major = [int]$versionParts[0]
        $minor = [int]$versionParts[1]
        $patch = [int]$versionParts[2]

        switch ($choice) {
            "1" {
                $patch++
                $updateType = "bugfix"
                $newVersion = "$major.$minor.$patch"
            }
            "2" {
                $minor++
                $patch = 0
                $updateType = "feature"
                $newVersion = "$major.$minor.$patch"
            }
            "3" {
                $major++
                $minor = 0
                $patch = 0
                $updateType = "major"
                $newVersion = "$major.$minor.$patch"
            }
        }
    }
}

if ($choice -eq "4") {
    $newVersion = Read-Host "Digite a nova versão (ex: 1.0.0-beta)"
    $updateType = "custom"
}

Write-Host "`nA nova versão será: $newVersion" -ForegroundColor Green
$confirm = Read-Host "Deseja continuar com o build e push para o Docker Hub? (S/N) [Padrão: S]"
if ($confirm -eq "N" -or $confirm -eq "n") {
    Write-Host "Operação cancelada pelo usuário." -ForegroundColor Yellow
    exit
}

# --- PROCESSAMENTO DO DOCKER ---

$fullImageName = "$dockerAccount/$ImageName"
Write-Host "`n[1/3] Iniciando o Build da imagem: ${fullImageName}:${newVersion}..." -ForegroundColor Cyan

# Executa o build da imagem nova
docker build -t "${fullImageName}:${newVersion}" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro no build da imagem." -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/3] Fazendo o push da imagem ${fullImageName}:${newVersion}..." -ForegroundColor Cyan
docker push "${fullImageName}:${newVersion}"

Write-Host "`n[3/3] Atualizando e enviando a tag 'latest'..." -ForegroundColor Cyan
docker tag "${fullImageName}:${newVersion}" "${fullImageName}:latest"
docker push "${fullImageName}:latest"


# --- ATUALIZANDO O JSON ---

$versionData.latest = $newVersion
$historyEntry = @{
    version = $newVersion
    date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    type = $updateType
}

# Converte o array de history que vem do JSON para List pra poder adicionar mais facilmente
$historyList = [System.Collections.ArrayList]@($versionData.history)
$historyList.Add($historyEntry) | Out-Null
$versionData.history = $historyList

# Salva de volta no arquivo
$versionData | ConvertTo-Json -Depth 5 | Out-File $JsonPath -Encoding utf8

Write-Host "`n=== SUCESSO! ===" -ForegroundColor Green
Write-Host "Imagem ${fullImageName}:${newVersion} (e latest) publicada com sucesso!" -ForegroundColor Green
Write-Host "Histórico de versão atualizado no arquivo $JsonPath." -ForegroundColor Green
