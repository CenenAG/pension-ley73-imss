# Pensiones Ley 73 IMSS — Calculadora Profesional

Calculadora profesional de pensión por vejez bajo la **Ley del Seguro Social de 1973** (México), diseñada para contadores y fiscalistas.

Aplicación web sin backend, construida con Angular 21 standalone.

---

## Objetivo

Proporcionar una herramienta precisa, transparente y profesional para calcular el monto de la pensión por vejez o cesantía en edad avanzada conforme al **Artículo 167 de la Ley del Seguro Social de 1973** del IMSS, eliminando errores manuales y permitiendo a los profesionales verificar escenarios antes de tramitar la pensión.

---

## Beneficios

- **Precisión garantizada**: Cada paso del cálculo se desglosa con los valores intermedios, permitiendo al profesional auditar y verificar cada resultado contra el contexto legal.
- **Ahorro de tiempo**: Automatiza el cálculo completo que manualmente requiere múltiples tablas y reglas (Factor Fox, asignaciones familiares, regla de redondeo IMSS para semanas y días).
- **Transparencia profesional**: El desglose paso a paso y el reporte PDF descargable sirven como documentación adjunta al expediente del cliente.
- **Simulación de escenarios**: Permite modificar salarios, semanas cotizadas, edad de retiro y estado civil para comparar escenarios y optimizar la fecha de retiro.
- **Sin dependencia de servidor**: No requiere backend, base de datos ni conexión a internet. Todo el cálculo se ejecuta en el navegador.

---

## De Qué Trata

### Algoritmo de Cálculo — 7 Pasos

La aplicación implementa fielmente el algoritmo de la Ley 73 del IMSS:

| Paso | Concepto | Descripción |
|------|----------|-------------|
| 1 | **Salario Promedio Diario (SPD)** | Promedio ponderado de los SBC de los últimos 1,750 días cotizados (250 semanas) |
| 2 | **Factor de Relación** | SPD ÷ Salario Mínimo General → ubica el renglón en la Tabla del Art. 167 |
| 3 | **Cuantía Básica Anual** | SPD × % Cuantía Básica × 365 |
| 4 | **Incrementos Anuales** | Por cada 52 semanas excedentes a 500, se aplica el % de incremento anual con regla de redondeo IMSS |
| 5 | **Factor Fox** | Suma Base × 1.11 (decreto del 11%) |
| 6 | **Asignaciones Familiares** | 15% siempre (cónyuge o soledad) + 10% por hijo + 10% por padre dependiente |
| 7 | **Factor por Edad** | 60 años = 75%, 61 = 80%, 62 = 85%, 63 = 90%, 64 = 95%, 65 = 100% |

### Reglas IMSS Implementadas

- **Corte de 1,750 días**: Si los períodos de SBC exceden los 1,750 días (250 semanas), se seleccionan los últimos 1,750 días a partir de la fecha final, excluyendo o parcializando los períodos más antiguos.
- **Redondeo de días a semanas**: `días ÷ 7`. Si el sobrante es mayor a 3 días, se cuenta una semana adicional.
- **Redondeo de semanas excedentes**: Después de las primeras 500 semanas:
  - Menos de 13 semanas sobrantes → no se cuentan
  - Entre 13 y 26 semanas → se reconocen 0.5 años
  - Más de 26 semanas → se reconoce 1 año completo
- **Tope de SBC**: El salario se topa a 25 UMAs ($2,889.25 MXN en 2026).
- **Conteo inclusivo de días**: Ambos extremos del período se cuentan (fecha inicio y fecha fin inclusive).

### Tabla del Artículo 167

La tabla completa con 22 rangos de salario es consultable dentro de la aplicación, con el renglón activo resaltado automáticamente según el factor de relación calculado.

---

## Captura de Pantalla

La interfaz presenta tres secciones principales:

1. **Grid de SBC**: Tabla editable con salarios base de cotización, fechas de inicio, y fechas fin calculadas automáticamente. Indica visualmente qué períodos están dentro, parcialmente dentro, o fuera de los 1,750 días.

2. **Datos del Cálculo**: Parámetros organizados en dos secciones — Parámetros Generales (SMG, edad, estado civil, dependientes) y Semanas Cotizadas (fecha de constancia, semanas en constancia, semanas adicionales automáticas, total).

3. **Resultado y Desglose**: Monto mensual destacado, detalle de cada paso del cálculo con fórmulas y valores intermedios, y tabla Art. 167.

---

## Entrada de Datos

### Grid de SBC (Salario Base de Cotización)

| Campo | Descripción |
|-------|-------------|
| SBC (Diario) | Salario base de cotización diario |
| Fecha Inicio | Fecha de inicio del período (editable) |
| Fecha Fin | Calculada automáticamente a partir de la Fecha Final del periodo y las fechas de inicio |
| Días | Días del período (calculado automáticamente, conteo inclusivo) |
| Días Efectivos | Solo visible cuando se exceden los 1,750 días. Muestra los días considerados para el promedio. |

### Semanas Cotizadas

| Campo | Descripción |
|-------|-------------|
| Fecha de Referencia (Constancia) | Fecha de la Constancia de Semanas Cotizadas del IMSS |
| Semanas en la Constancia | Semanas que indica la constancia del IMSS |
| Semanas adicionales | Calculadas automáticamente entre la fecha de constancia y la fecha final del periodo |
| Total de Semanas Cotizadas | Suma automática con regla IMSS de redondeo |

### Parámetros Generales

| Campo | Descripción |
|-------|-------------|
| Salario Mínimo General | Editable, default 2026: $315.04 |
| Edad de Retiro | 60–65 años |
| Estado Civil | Casado/a, Unión libre, Soltero/a (el 15% siempre se aplica) |
| Hijos | 10% por cada hijo menor de 16 (o hasta 25 si estudia) |
| Padres dependientes | 10% por cada padre/madre |

---

## Tecnologías

- **Angular 21** — Standalone components, signals, computed
- **TypeScript** — Tipado estricto, modelos fuertemente tipados
- **jsPDF** — Generación de reportes PDF
- **Sin backend** — Todo ejecuta en el navegador del cliente

---

## Instalación y Ejecución

```bash
# Clonar el repositorio
git clone https://github.com/CenenAG/pension-ley73-imss.git
cd pension-ley73-imss

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm start

# Construir para producción
npm run build
```

La aplicación se abre en `http://localhost:4200/`.

---

## Estructura del Proyecto

```
src/app/
├── models/
│   └── pension.model.ts          # Interfaces, tabla Art.167, constantes
├── services/
│   └── pension-calculator.service.ts  # Algoritmo completo Ley 73
├── components/
│   ├── sbc-grid/                 # Grid editable de SBC con auto-fechas
│   ├── pension-form/             # Formulario de parámetros
│   ├── calculation-breakdown/    # Desglose paso a paso
│   └── pension-result/          # Resultado y resumen
├── app.ts                        # Componente principal
├── app.html                      # Template principal
└── app.css                       # Estilos globales de la app
```

---

## Contexto Legal

Este proyecto implementa el cálculo previsto en el **Artículo 167 de la Ley del Seguro Social de 1973** (Diario Oficial de la Federación), vigente para los trabajadores que cotizaron bajo este régimen antes del 1 de julio de 1997 (generación de transición).

Los resultados son estimaciones y **no constituyen una resolución del IMSS**. Se recomienda verificar con la subdelegación correspondiente.

---

## Licencia

MIT