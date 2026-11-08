# UCVGO

Plataforma universitaria de asistencia académica con código QR dinámico.

## Descripción
UCVGO es una aplicación web para la gestión y registro de asistencia académica en tiempo real, diseñada con soporte para roles institucionales:
- **Administrador**: Gestión de cursos, profesores, alumnos y matrículas.
- **Profesor**: Horarios, sesiones de clase, marcador animado con QR dinámico por fases, QR simple de respaldo y registro manual de asistencia.
- **Alumno**: Consulta de asistencia y estado por curso.

## Tecnologías
- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite.
- **Base de Datos y Backend**: Supabase (PostgreSQL, Row Level Security, RPCs, Storage).
- **Código QR**: Rotación dinámica con payload estructurado.

## Ejecución en Desarrollo

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno (copiar `.env.example` a `.env`):
```bash
cp .env.example .env
```

3. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

4. Compilar para producción:
```bash
npm run build
```
