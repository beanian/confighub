#!/bin/bash
set -e

# Configuration - change these as needed
RESOURCE_GROUP="confighub-demo-rg"
LOCATION="westeurope"  # Change to your preferred region
ACR_NAME="confighubacr$(date +%s | tail -c 6)"  # Unique name
APP_NAME="confighub-demo"
ENVIRONMENT_NAME="confighub-env"

echo "🚀 Deploying ConfigHub to Azure Container Apps..."
echo ""

# Check if logged in
if ! az account show &> /dev/null; then
    echo "Please log in to Azure first:"
    az login
fi

echo "📦 Step 1: Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION --output none

echo "🐳 Step 2: Creating container registry..."
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --output none
az acr update -n $ACR_NAME --admin-enabled true --output none

echo "🔨 Step 3: Building and pushing container image..."
az acr build --registry $ACR_NAME --image confighub:latest . --platform linux/amd64

echo "☁️  Step 4: Creating Container Apps environment..."
az containerapp env create \
    --name $ENVIRONMENT_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --output none

echo "🚢 Step 5: Deploying container app..."
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

az containerapp create \
    --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --environment $ENVIRONMENT_NAME \
    --image "$ACR_NAME.azurecr.io/confighub:latest" \
    --registry-server "$ACR_NAME.azurecr.io" \
    --registry-username $ACR_NAME \
    --registry-password "$ACR_PASSWORD" \
    --target-port 3000 \
    --ingress external \
    --min-replicas 1 \
    --max-replicas 1 \
    --cpu 0.5 \
    --memory 1Gi \
    --output none

echo ""
echo "✅ Deployment complete!"
echo ""

# Get the URL
APP_URL=$(az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
echo "🌐 Your app is live at: https://$APP_URL"
echo ""
echo "Demo accounts:"
echo "  admin@confighub.local / admin123"
echo "  sarah.murphy@insureco.ie / demo123"
echo ""
echo "⚠️  Note: Data won't persist across container restarts."
echo "    For persistent storage, add an Azure Files volume."
