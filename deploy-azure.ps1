# ConfigHub Azure Deployment Script
$ErrorActionPreference = "Stop"

# Configuration
$RESOURCE_GROUP = "confighub-demo-rg"
$LOCATION = "westeurope"
$ACR_NAME = "confighubacr$((Get-Date).ToString('HHmmss'))"
$APP_NAME = "confighub-demo"
$ENVIRONMENT_NAME = "confighub-env"

Write-Host ""
Write-Host "Deploying ConfigHub to Azure Container Apps..." -ForegroundColor Cyan
Write-Host ""

# Check if logged in
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Please log in to Azure first:" -ForegroundColor Yellow
    az login
}

Write-Host "Step 1: Creating resource group..." -ForegroundColor Green
az group create --name $RESOURCE_GROUP --location $LOCATION --output none
if ($LASTEXITCODE -ne 0) { throw "Failed to create resource group" }

Write-Host "Step 2: Creating container registry '$ACR_NAME'..." -ForegroundColor Green
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --output none
if ($LASTEXITCODE -ne 0) { throw "Failed to create ACR" }

az acr update -n $ACR_NAME --admin-enabled true --output none
if ($LASTEXITCODE -ne 0) { throw "Failed to enable admin on ACR" }

Write-Host "Step 3: Building and pushing container image (this takes a few minutes)..." -ForegroundColor Green
az acr build --registry $ACR_NAME --image confighub:latest . --platform linux/amd64
if ($LASTEXITCODE -ne 0) { throw "Failed to build image" }

Write-Host "Step 4: Creating Container Apps environment..." -ForegroundColor Green
az containerapp env create `
    --name $ENVIRONMENT_NAME `
    --resource-group $RESOURCE_GROUP `
    --location $LOCATION `
    --output none
if ($LASTEXITCODE -ne 0) { throw "Failed to create Container Apps environment" }

Write-Host "Step 5: Deploying container app..." -ForegroundColor Green
$ACR_PASSWORD = az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv

az containerapp create `
    --name $APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --environment $ENVIRONMENT_NAME `
    --image "$ACR_NAME.azurecr.io/confighub:latest" `
    --registry-server "$ACR_NAME.azurecr.io" `
    --registry-username $ACR_NAME `
    --registry-password $ACR_PASSWORD `
    --target-port 3000 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 1 `
    --cpu 0.5 `
    --memory 1Gi `
    --output none
if ($LASTEXITCODE -ne 0) { throw "Failed to create container app" }

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""

# Get the URL
$APP_URL = az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv

Write-Host "Your app is live at: https://$APP_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "Demo accounts:"
Write-Host "  admin@confighub.local / admin123"
Write-Host "  sarah.murphy@insureco.ie / demo123"
Write-Host ""
Write-Host "Note: First load may take 30-60 seconds while demo data seeds." -ForegroundColor Yellow
Write-Host ""
Write-Host "To delete everything when done:" -ForegroundColor Gray
Write-Host "  az group delete --name $RESOURCE_GROUP --yes" -ForegroundColor Gray
