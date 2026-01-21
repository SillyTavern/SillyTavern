# Guía de Despliegue en Vercel

## Requisitos previos

- Cuenta en [Vercel](https://vercel.com)
- Git configurado
- Repositorio en GitHub

## Pasos para desplegar

### 1. Preparar el repositorio

```bash
git init
git add .
git commit -m "Prepare for Vercel deployment"
git branch -M main
git remote add origin https://github.com/tu-usuario/koitavern.git
git push -u origin main
```

### 2. Configurar en Vercel

1. Ve a https://vercel.com/new
2. Importa tu repositorio de GitHub
3. Configura las siguientes variables de entorno:

**Environment Variables:**

- `NODE_ENV`: `production`
- `DATA_ROOT`: `/tmp/st-data`
- Cualquier otra variable que necesites (API keys, etc.)

### 3. Configuración de Build

- **Build Command**: `npm run build` (o vacío si no necesitas build especial)
- **Output Directory**: `dist` o `public`
- **Install Command**: `npm install`

### 4. Desplegar

Vercel automáticamente desplegará cuando hagas push a `main`

## Limitaciones de Vercel

⚠️ **Importante**: Vercel tiene ciertas limitaciones para esta aplicación:

1. **Almacenamiento temporal**: `/tmp` se limpia entre deploys
   - Los datos guardados NO serán persistentes
   - Solución: Usar base de datos externa (MongoDB, PostgreSQL, etc.)

2. **Timeout**: 60 segundos máximo
   - Operaciones largas pueden fallar
   - Considera usar colas o tareas asincrónicas

3. **Memoria**: 3GB máximo por función

## Soluciones recomendadas

### Para almacenamiento persistente:

- **Supabase** (PostgreSQL)
- **MongoDB Atlas**
- **Firebase Realtime Database**
- **AWS S3** para archivos

### Integración de base de datos

1. Instala el cliente:

```bash
npm install supabase  # o tu BD preferida
```

2. Actualiza las credenciales en variables de entorno

3. Modifica el código para usar la BD externa

## Monitoreo

- Dashboard de Vercel: https://vercel.com/dashboard
- Logs: En el panel de Vercel → Logs de tu proyecto

## Troubleshooting

### Error: "Function timed out"

- Reduce la complejidad de las operaciones
- Implementa procesamiento en background

### Error: "Out of memory"

- Optimiza el consumo de memoria
- Divide tareas grandes

### Datos perdidos

- Esto es normal en Vercel (almacenamiento efímero)
- Implementa persistencia con base de datos externa

## Alternativas a Vercel

Para mejor compatibilidad con esta aplicación, considera:

- **Railway.app** ⭐ (Recomendado)
- **Render.com**
- **Fly.io**
- **DigitalOcean App Platform**
