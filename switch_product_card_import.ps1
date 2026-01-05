Get-ChildItem -Path "src" -Recurse -Filter "*.tsx" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match "import\s+\{\s*ProductCard\s*\}\s+from\s+'@/components/products/ProductCard';") {
        $content = $content -replace "import\s+\{\s*ProductCard\s*\}\s+from\s+'@/components/products/ProductCard';", "import { ProductCard } from '@/features/orders/components/ProductCard';"
        Set-Content $_.FullName $content
        Write-Host "Updated $($_.Name)"
    }
}
