# Plan Premium - Implementación Completa

## Sistema de Control de Asistencia Escolar con QR (SCA-QR)

> **Documento técnico de implementación**
> Octubre 2026 · Versión 1.0

---

## ¿Qué incluye el Plan Premium?

| Feature | Estado | Archivo principal |
|---|---|---|
| Panel admin con login JWT | ✅ Implementado | `src/app/admin/*` + `src/lib/auth.ts` |
| Dashboard con stats en vivo | ✅ Implementado | `src/app/admin/dashboard/page.tsx` |
| Reportes PDF diarios | ✅ Implementado | `src/lib/pdf.ts` + `src/app/api/reports/daily/` |
| Notificaciones email | ✅ Implementado | `src/lib/email.ts` |
| Tests automatizados (Vitest) | ✅ Configurado | `tests/unit/*` |
| CI/CD con GitHub Actions | ✅ Configurado | `.github/workflows/deploy.yml` |
| Cache con Redis opcional | ✅ Implementado | `src/lib/cache.ts` |
| Multi-lector (3-4 por entrada) | ✅ Implementado | `src/components/MultiScannerInput.tsx` |
| Modo offline completo | ✅ Implementado | `src/lib/offlineQueue.ts` |
| Portal para padres | 📝 Documentado (futuro) | Próxima fase |
| Dashboard tiempo real WS | 📝 Documentado (futuro) | Próxima fase |

---

## 💰 Costos Detallados (3 años)

### Infraestructura

| Concepto | Proveedor | Costo mensual | Costo 3 años | Notas |
|---|---|---|---|---|
| **VPS** | DigitalOcean 4GB | S/ 45 | S/ 1,620 | Recomendado para Premium |
| **Dominio** | Porkbun .com | - | S/ 135 | 3 años prepagados |
| **Email** | Resend Free | S/ 0 | S/ 0 | Hasta 3,000/mes |
| **Storage** | Incluido en VPS | S/ 0 | S/ 0 | 80GB SSD |
| **Backups** | DigitalOcean | S/ 5 | S/ 180 | Semanales automáticos |
| **CDN/SSL** | Let's Encrypt | S/ 0 | S/ 0 | Gratis |
| **Total infra** | | **S/ 50/mes** | **S/ 1,935** | |

### Costos opcionales (cuando escale)

| Concepto | Costo | Cuándo |
|---|---|---|
| Upstash Redis | S/ 0 (free tier) | Cuando >50 req/s |
| Resend Pro | S/ 75/mes | Cuando >3,000 emails/mes |
| Sentry monitoring | S/ 0 (free) | Cuando tengas usuarios reales |
| UptimeRobot | S/ 0 (free) | Recomendado siempre |

### Tus honorarios (Opción C)

| Concepto | Monto |
|---|---|
| Implementación premium | S/ 4,500 |
| Mantenimiento mensual (después del mes 3) | S/ 200/mes × 33 meses = S/ 6,600 |
| **Total honorarios 3 años** | **S/ 11,100** |

### 💎 Inversión total 3 años

| Categoría | Monto |
|---|---|
| Infraestructura | S/ 1,935 |
| Tus honorarios | S/ 11,100 |
| **TOTAL** | **S/ 13,035** |

**Comparado con SaaS comercial (S/ 500-1,500/mes × 36):** S/ 18,000 - 54,000
**Ahorro:** S/ 5,000 - 41,000 en 3 años (30-75% más barato)

---

## 🚀 Pasos para Implementar en Producción

### 1. Comprar dominio

```bash
# Opción A: Porkbun (más barato)
ir a https://porkbun.com
comprar tudominio.com (S/ 45/año)

# Opción B: NIC.pe (dominio peruano)
ir a https://nic.pe
comprar tudominio.com.pe (S/ 100/año)
```

### 2. Contratar VPS

```bash
# Opción A: DigitalOcean
ir a https://digitalocean.com
- Crear cuenta
- Crear Droplet: Ubuntu 22.04, 4GB RAM, Singapore region
- Anotar IP del servidor (ej: 138.68.100.50)

# Opción B: Hetzner (más barato)
ir a https://hetzner.com/cloud
- Mismo proceso
- Ubicación: Alemania (más barato) o Finlandia
```

### 3. Configurar servidor (SSH)

```bash
# Conectarse
ssh root@TU_IP

# Crear usuario para la app
adduser scaqr
usermod -aG sudo scaqr

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PostgreSQL
apt install -y postgresql postgresql-contrib
sudo -u postgres psql
CREATE DATABASE sca_qr;
CREATE USER sca_user WITH PASSWORD 'tu-password-seguro';
GRANT ALL PRIVILEGES ON DATABASE sca_qr TO sca_user;
\q

# Instalar PM2 y Nginx
npm install -g pm2
apt install -y nginx

# Instalar certbot para HTTPS
apt install -y certbot python3-certbot-nginx
```

### 4. Desplegar la app

```bash
# Clonar repo
cd /var/www
git clone https://github.com/tu-usuario/sca-qr.git
cd sca-qr

# Configurar .env
cp .env.example .env
nano .env
# Completar con valores reales:
# - JWT_SECRET (generar uno aleatorio de 64 chars)
# - DATABASE_URL=postgresql://sca_user:password@localhost:5432/sca_qr
# - RESEND_API_KEY=re_xxxx
# - EMAIL_FROM=SCA-QR <noreply@tudominio.com>
# - NEXT_PUBLIC_APP_URL=https://tudominio.com
# - SCHOOL_NAME=Colegio X

# Instalar deps y compilar
npm ci
npm run build

# Iniciar con PM2
pm2 start npm --name "sca-qr" -- start
pm2 save
pm2 startup
```

### 5. Configurar Nginx y HTTPS

```bash
# Crear config de Nginx
nano /etc/nginx/sites-available/sca-qr
```

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Activar
ln -s /etc/nginx/sites-available/sca-qr /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Activar HTTPS con Let's Encrypt
certbot --nginx -d tudominio.com -d www.tudominio.com
```

### 6. Configurar GitHub Actions (CI/CD)

En GitHub, ir a Settings → Secrets and variables → Actions, agregar:

- `VPS_HOST`: la IP del servidor
- `VPS_USER`: `scaqr` (el usuario que creaste)
- `VPS_SSH_KEY`: la clave SSH privada

Listo. Cada `git push` a `main` desplegará automáticamente.

---

## 🔐 Credenciales por defecto (CAMBIAR EN PRODUCCIÓN)

### Panel admin

- **URL:** `https://tudominio.com/admin/login`
- **Usuarios demo:**
  - `admin` / `admin123`
  - `director` / `director123`

⚠️ **Cambiar inmediatamente** editando `src/app/api/admin/login/route.ts` y reemplazando los hashes con `bcrypt.hashSync('tu-password', 10)`.

---

## 🧪 Tests

```bash
# Correr tests unitarios
npm run test:run

# Modo watch (desarrollo)
npm test

# Con UI
npm run test:ui
```

Tests incluidos (14 pasando):
- `cache.test.ts` - 5 tests (memory cache, TTL, helper cached)
- `offlineQueue.test.ts` - 3 tests (guardar, listar, ráfagas)
- `qrValidator.test.ts` - 6 tests (parse, verify, generate)

Para tests E2E con Playwright (futuro):
```bash
npm run test:e2e
```

---

## 📧 Configurar Resend para emails

1. Crear cuenta en https://resend.com (gratis)
2. Verificar tu dominio
3. Crear API key
4. Agregar a `.env`:
   ```
   RESEND_API_KEY=re_xxxxx
   EMAIL_FROM=SCA-QR Colegio <noreply@tudominio.com>
   ```

Sin API key, los emails solo se loguean en consola (modo simulación).

---

## 🔄 Configurar Redis (Opcional, cuando lo necesites)

1. Crear cuenta en https://upstash.com
2. Crear database Redis (free: 10K comandos/día)
3. Copiar URL
4. Agregar a `.env`:
   ```
   REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379
   ```
5. Reiniciar: `pm2 restart sca-qr`

Verás en logs: `[Cache] Conectado a Redis`

---

## 📊 Cronograma de Implementación

| Semana | Actividad |
|---|---|
| 1 | Comprar dominio + contratar VPS |
| 2 | Configurar servidor (Ubuntu, Node, PostgreSQL, Nginx) |
| 3 | Desplegar la app + configurar HTTPS |
| 4 | Importar lista de alumnos real |
| 5 | Generar carnets QR |
| 6 | Configurar lectores en cada entrada |
| 7 | Capacitar al personal |
| 8 | Prueba piloto (solo 1 grado) |
| 9-10 | Ajustes + lanzamiento a todo el colegio |

**Tiempo total: 2.5 meses**

---

## 🎯 Roadmap Futuro

### Corto plazo (próximo mes)
- [ ] Portal para padres (login con DNI del hijo, ver historial)
- [ ] Notificaciones WhatsApp vía Twilio
- [ ] Tests E2E con Playwright
- [ ] Métricas con Sentry

### Mediano plazo (3-6 meses)
- [ ] Dashboard con actualizaciones en tiempo real (WebSockets)
- [ ] Reportes en Excel con gráficos
- [ ] Sistema de justificaciones de faltas (los padres suben foto del justificativo)
- [ ] Reconocimiento facial como capa extra de seguridad

### Largo plazo (6-12 meses)
- [ ] Multi-colegio (si decides ofrecer el SaaS a otros colegios)
- [ ] App móvil nativa (React Native / Capacitor)
- [ ] Integración con sistemas académicos existentes
- [ ] Machine learning para detectar patrones de inasistencia

---

## 💡 Tips para Vender este Plan

1. **El precio S/ 13,035 suena alto, pero:**
   - Pagado en 3 cuotas de S/ 4,345 cada año
   - O en mensualidades de S/ 1,086 (incluyendo mantenimiento)
   - Vs. S/ 1,500/mes de SaaS = S/ 18,000/año (3 años: S/ 54,000)

2. **Argumentos de venta:**
   - "Una inversión única, no licencia mensual"
   - "Funciona aunque se caiga el internet"
   - "El colegio es dueño de sus datos"
   - "Se puede personalizar a las necesidades del colegio"
   - "Soporte local en español, no call center en inglés"

3. **Demo en vivo:**
   - Mostrar la PWA funcionando en tu laptop
   - Login al admin
   - Generar PDF
   - Enviar email de prueba
   - "Esto es lo que vas a tener en producción en 2 meses"

---

## 📞 Soporte

- **GitHub Issues:** [tu-repo]/issues
- **Email:** [tu-email]
- **WhatsApp:** [tu-número]
- **Uptime:** [URL de UptimeRobot]

---

**Implementado por:** [Tu nombre]
**Fecha:** Octubre 2026
**Versión:** 1.0
