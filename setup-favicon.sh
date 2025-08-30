#!/bin/bash
echo "🔧 Configurando ícono para tu sistema..."

# Rutas
PROJECT_DIR="/Users/lucasb/sistema-contable-nuevo"
ICONS_DIR="$PROJECT_DIR/public/icons"
ICON_SRC="$ICONS_DIR/Icono_de_la_app.png"
INDEX_FILE="$PROJECT_DIR/public/index.html"

# Verificar que el ícono exista
if [[ ! -f "$ICON_SRC" ]]; then
  echo "❌ Error: No se encuentra el ícono en $ICON_SRC"
  echo "Asegúrate de que el archivo 'Icono_de_la_app.png' esté en $ICONS_DIR"
  exit 1
fi

# Crear copias con nombres correctos
cp "$ICON_SRC" "$ICONS_DIR/favicon-16.png"
cp "$ICON_SRC" "$ICONS_DIR/favicon-32.png"
cp "$ICON_SRC" "$ICONS_DIR/favicon-48.png"
cp "$ICON_SRC" "$ICONS_DIR/favicon-64.png"
cp "$ICON_SRC" "$ICONS_DIR/favicon-128.png"
cp "$ICON_SRC" "$ICONS_DIR/favicon-256.png"
cp "$ICON_SRC" "$ICONS_DIR/apple-touch-icon.png"
cp "$ICON_SRC" "$ICONS_DIR/favicon.ico"

echo "✅ Íconos generados correctamente en $ICONS_DIR"

# Actualizar index.html
cat > "$INDEX_FILE" << 'HTML'
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sistema Contable</title>

    <!-- Favicon -->
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/icons/favicon-48.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="/icons/favicon-64.png" />
    <link rel="icon" type="image/png" sizes="128x128" href="/icons/favicon-128.png" />
    <link rel="icon" type="image/png" sizes="256x256" href="/icons/favicon-256.png" />
    <link rel="icon" href="/icons/favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
HTML

echo "✅ index.html actualizado con el ícono"
echo "🎉 Listo! Ejecutá: npm run dev"
