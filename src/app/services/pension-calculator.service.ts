import { Injectable } from '@angular/core';
import {
  SbcEntry,
  Corte250Info,
  ART167_TABLE,
  EDAD_FACTORES,
  FACTOR_FOX,
  MIN_SEMANAS,
  SEMANAS_PROMEDIO,
  MS_PER_DAY,
  PensionResult,
  ProyeccionMensual,
  CalculationStep,
  AsignacionFamiliar,
  EstadoCivil,
  UMA_2026,
} from '../models/pension.model';

@Injectable({ providedIn: 'root' })
export class PensionCalculatorService {
  static parseDateInput(value: string | null | undefined): Date | null {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }

  static formatDateISO(date: Date | null): string {
    if (!date) return '';
    return date.toISOString().substring(0, 10);
  }

  private static readonly MXN_FORMATTER = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  });

  static formatCurrency(value: number): string {
    return PensionCalculatorService.MXN_FORMATTER.format(value);
  }

  calcularFechasFinAuto(entries: SbcEntry[], fechaFinal: Date | null): SbcEntry[] {
    if (!fechaFinal || entries.length === 0) return entries;

    const sorted = [...entries].sort((a, b) => {
      const dateA = a.fechaInicio?.getTime() ?? 0;
      const dateB = b.fechaInicio?.getTime() ?? 0;
      return dateB - dateA;
    });

    const result: SbcEntry[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const entry = { ...sorted[i] };
      if (entry.fechaFinManual && entry.fechaFin) {
        entry.dias = this.calcularDiasEntreFechas(entry.fechaInicio, entry.fechaFin);
        entry.semanas = this.diasASemanas(entry.dias);
      } else if (i === 0) {
        entry.fechaFin = new Date(fechaFinal);
        entry.dias = this.calcularDiasEntreFechas(entry.fechaInicio, entry.fechaFin);
        entry.semanas = this.diasASemanas(entry.dias);
      } else {
        const prevInicio = sorted[i - 1].fechaInicio;
        if (prevInicio) {
          const fin = new Date(prevInicio);
          fin.setDate(fin.getDate() - 1);
          entry.fechaFin = fin;
        }
        entry.dias = this.calcularDiasEntreFechas(entry.fechaInicio, entry.fechaFin);
        entry.semanas = this.diasASemanas(entry.dias);
      }
      result.push(entry);
    }

    return result;
  }

  calcularCorte250(entries: SbcEntry[]): Corte250Info {
    const sorted = [...entries]
      .filter((e) => e.sbc > 0 && e.fechaInicio && e.fechaFin)
      .sort((a, b) => (b.fechaInicio?.getTime() ?? 0) - (a.fechaInicio?.getTime() ?? 0));

    if (sorted.length === 0) {
      return {
        fechaInicioConsiderada: null,
        fechaFinConsiderada: null,
        totalSemanasOriginales: 0,
        totalSemanasEfectivas: 0,
        excede250: false,
        mensaje: 'No hay períodos válidos',
      };
    }

    const totalSemanasOriginales = sorted.reduce((sum, e) => sum + (e.semanas || 0), 0);
    const fechaFinConsiderada = sorted[0].fechaFin;

    if (totalSemanasOriginales <= SEMANAS_PROMEDIO) {
      const fechaInicioConsiderada = sorted[sorted.length - 1].fechaInicio;
      return {
        fechaInicioConsiderada,
        fechaFinConsiderada,
        totalSemanasOriginales,
        totalSemanasEfectivas: totalSemanasOriginales,
        excede250: false,
        mensaje:
          totalSemanasOriginales < SEMANAS_PROMEDIO
            ? `Total: ${totalSemanasOriginales} semanas. Faltan ${SEMANAS_PROMEDIO - totalSemanasOriginales} semanas para completar las ${SEMANAS_PROMEDIO} requeridas.`
            : `Total: ${totalSemanasOriginales} semanas (= ${SEMANAS_PROMEDIO} semanas). Se alcanzan las ${SEMANAS_PROMEDIO} semanas.`,
      };
    }

    let semanasRestantes = SEMANAS_PROMEDIO;
    let fechaInicioConsiderada: Date | null = null;

    for (const entry of sorted) {
      const sem = entry.semanas || 0;
      if (semanasRestantes > sem) {
        semanasRestantes -= sem;
      } else {
        const diasEfectivos = Math.round((semanasRestantes / sem) * (entry.dias || 0));
        const inicio = new Date(entry.fechaFin!);
        inicio.setDate(inicio.getDate() - diasEfectivos + 1);
        fechaInicioConsiderada = inicio;
        break;
      }
    }

    if (!fechaInicioConsiderada) {
      fechaInicioConsiderada = sorted[sorted.length - 1].fechaInicio;
    }

    return {
      fechaInicioConsiderada,
      fechaFinConsiderada,
      totalSemanasOriginales,
      totalSemanasEfectivas: SEMANAS_PROMEDIO,
      excede250: true,
      mensaje: `Se exceden las ${SEMANAS_PROMEDIO} semanas (${totalSemanasOriginales}). Se consideran las últimas ${SEMANAS_PROMEDIO} semanas a partir del ${fechaInicioConsiderada!.toLocaleDateString('es-MX')}.`,
    };
  }

  calcularEffectiveEntries(entries: SbcEntry[], corteInfo: Corte250Info): SbcEntry[] {
    if (!corteInfo.excede250) {
      return entries.map((e) => ({ ...e, efectivo: true, semanasEfectivas: e.semanas }));
    }

    const sorted = [...entries]
      .filter((e) => e.sbc > 0 && e.fechaInicio && e.fechaFin)
      .sort((a, b) => (b.fechaInicio?.getTime() ?? 0) - (a.fechaInicio?.getTime() ?? 0));

    let semanasRestantes = SEMANAS_PROMEDIO;

    return sorted.map((entry) => {
      const effective = { ...entry, efectivo: true, semanasEfectivas: 0 };
      const sem = entry.semanas || 0;

      if (semanasRestantes <= 0) {
        effective.efectivo = false;
        effective.semanasEfectivas = 0;
        return effective;
      }

      if (semanasRestantes >= sem) {
        effective.efectivo = true;
        effective.semanasEfectivas = sem;
        semanasRestantes -= sem;
      } else {
        effective.efectivo = true;
        effective.semanasEfectivas = Math.round(semanasRestantes);
        semanasRestantes = 0;
      }

      return effective;
    });
  }

  calcularSalarioPromedioFromEffective(entries: SbcEntry[]): {
    promedio: number;
    totalSemanas: number;
  } {
    let totalProducto = 0;
    let totalSemanas = 0;

    for (const entry of entries) {
      const sem = entry.semanasEfectivas ?? entry.semanas ?? 0;
      if (entry.sbc > 0 && sem > 0 && entry.efectivo !== false) {
        totalProducto += entry.sbc * sem;
        totalSemanas += sem;
      }
    }

    const promedio = totalSemanas > 0 ? totalProducto / totalSemanas : 0;
    return { promedio, totalSemanas };
  }

  calcularDiasEntreFechas(inicio: Date | null, fin: Date | null): number {
    if (!inicio || !fin) return 0;
    const startUtc = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const endUtc = Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate());
    const diffDays = Math.round((endUtc - startUtc) / MS_PER_DAY);
    return diffDays + 1;
  }

  diasASemanas(dias: number): number {
    const semanasCompletas = Math.floor(dias / 7);
    const sobrante = dias % 7;
    if (sobrante > 3) {
      return semanasCompletas + 1;
    }
    return semanasCompletas;
  }

  buscarPorcentajesTabla(factor: number): {
    cuantiaBasica: number;
    incrementoAnual: number;
    grupo: string;
  } {
    for (const row of ART167_TABLE) {
      if (factor >= row.desde && factor <= row.hasta) {
        return {
          cuantiaBasica: row.porcentajeCuantiaBasica,
          incrementoAnual: row.porcentajeIncrementoAnual,
          grupo:
            row.hasta === Infinity
              ? `Mayor a ${row.desde.toFixed(2)} veces SMG`
              : `De ${row.desde.toFixed(2)} a ${row.hasta.toFixed(2)} veces SMG`,
        };
      }
    }
    const lastRow = ART167_TABLE[ART167_TABLE.length - 1];
    return {
      cuantiaBasica: lastRow.porcentajeCuantiaBasica,
      incrementoAnual: lastRow.porcentajeIncrementoAnual,
      grupo: `Mayor a ${lastRow.desde.toFixed(2)} veces SMG`,
    };
  }

  calcularReglaRedondeo(semanasExcedentes: number): {
    anos: number;
    divisionExacta: number;
    parteDecimal: number;
    regla: string;
    anosEfectivos: number;
  } {
    const divisionExacta = semanasExcedentes / 52;
    const anos = Math.floor(divisionExacta);
    const parteDecimal = divisionExacta - anos;
    let anosEfectivos = anos;
    let regla = '';

    if (parteDecimal === 0) {
      regla = `${semanasExcedentes} ÷ 52 = ${divisionExacta.toFixed(4)}: residuo 0, sin incremento adicional`;
    } else if (parteDecimal >= 0.25 && parteDecimal < 0.5) {
      anosEfectivos = anos + 0.5;
      regla = `${semanasExcedentes} ÷ 52 = ${divisionExacta.toFixed(4)}: parte decimal ${parteDecimal.toFixed(4)} (≥ 0.25 y < 0.5) → se agregan 0.5 años`;
    } else if (parteDecimal >= 0.5) {
      anosEfectivos = anos + 1;
      regla = `${semanasExcedentes} ÷ 52 = ${divisionExacta.toFixed(4)}: parte decimal ${parteDecimal.toFixed(4)} (≥ 0.5) → se agrega 1 año completo`;
    } else {
      regla = `${semanasExcedentes} ÷ 52 = ${divisionExacta.toFixed(4)}: parte decimal ${parteDecimal.toFixed(4)} (< 0.25) → sin incremento adicional`;
    }

    return { anos, divisionExacta, parteDecimal, regla, anosEfectivos };
  }

  calcularAsignaciones(
    estadoCivil: EstadoCivil,
    hijosCount: number,
    padresCount: number,
  ): AsignacionFamiliar[] {
    const asignaciones: AsignacionFamiliar[] = [];

    if (estadoCivil === 'casado' || estadoCivil === 'concubina') {
      asignaciones.push({
        tipo: 'conyuge',
        descripcion: estadoCivil === 'casado' ? 'Esposa/o (15%)' : 'Concubina/o (15%)',
        porcentaje: 0.15,
      });
    } else {
      asignaciones.push({
        tipo: 'conyuge',
        descripcion: 'Asignación por soledad (15%)',
        porcentaje: 0.15,
      });
    }

    for (let i = 0; i < hijosCount; i++) {
      asignaciones.push({
        tipo: 'hijo',
        descripcion: `Hijo ${i + 1} menor de 16 años o hasta 25 si estudia (10%)`,
        porcentaje: 0.1,
      });
    }

    for (let i = 0; i < padresCount; i++) {
      asignaciones.push({
        tipo: 'padre',
        descripcion: `Padre/Madre dependiente ${i + 1} (10%)`,
        porcentaje: 0.1,
      });
    }

    return asignaciones;
  }

  buscarFactorEdad(edad: number): { factor: number; label: string } {
    const found = EDAD_FACTORES.find((e) => e.edad === edad);
    if (found) return found;
    if (edad < 60) return { factor: 0, label: 'Edad menor a 60 — No aplica' };
    if (edad > 65) return EDAD_FACTORES[EDAD_FACTORES.length - 1];
    return EDAD_FACTORES[0];
  }

  calcularPension(
    effectiveEntries: SbcEntry[],
    corteInfo: Corte250Info,
    salarioMinimoGeneral: number,
    semanasCotizadas: number,
    edad: number,
    estadoCivil: EstadoCivil,
    hijosCount: number,
    padresCount: number,
  ): PensionResult {
    const steps: CalculationStep[] = [];

    const { promedio: spd, totalSemanas } =
      this.calcularSalarioPromedioFromEffective(effectiveEntries);

    const sbcTopado = Math.min(spd, UMA_2026 * 25);

    const periodoStr =
      corteInfo.fechaInicioConsiderada && corteInfo.fechaFinConsiderada
        ? `del ${corteInfo.fechaInicioConsiderada.toLocaleDateString('es-MX')} al ${corteInfo.fechaFinConsiderada.toLocaleDateString('es-MX')}`
        : '';

    const paso1: CalculationStep = {
      paso: 1,
      titulo: 'Salario Promedio Diario (SPD)',
      descripcion: corteInfo.excede250
        ? `Se calcula el promedio ponderado con las últimas ${SEMANAS_PROMEDIO} semanas cotizadas ${periodoStr}`
        : `Se calcula el promedio ponderado de los SBC con las ${totalSemanas} semanas disponibles ${periodoStr}`,
      valores: [
        { label: 'Semanas efectivas consideradas', value: totalSemanas.toLocaleString() },
        { label: 'Semanas requeridas', value: SEMANAS_PROMEDIO.toLocaleString() },
        { label: 'SPD calculado', value: PensionCalculatorService.formatCurrency(spd) },
        { label: 'Tope (25 UMAs)', value: PensionCalculatorService.formatCurrency(UMA_2026 * 25) },
        { label: 'SPD topado', value: PensionCalculatorService.formatCurrency(sbcTopado) },
      ],
      resultado: sbcTopado,
      resultadoLabel: 'SPD utilizado para el cálculo',
    };
    steps.push(paso1);

    const factorRelacion = salarioMinimoGeneral > 0 ? sbcTopado / salarioMinimoGeneral : 0;
    const {
      cuantiaBasica: pctCuantiaBasica,
      incrementoAnual: pctIncremento,
      grupo,
    } = this.buscarPorcentajesTabla(factorRelacion);

    const paso2: CalculationStep = {
      paso: 2,
      titulo: 'Factor de Relación con el SMG',
      descripcion:
        'Se divide el SPD topado entre el Salario Mínimo General para ubicar el renglón en la tabla del Art. 167',
      valores: [
        { label: 'SPD topado', value: PensionCalculatorService.formatCurrency(sbcTopado) },
        {
          label: 'SMG vigente',
          value: PensionCalculatorService.formatCurrency(salarioMinimoGeneral),
        },
        { label: 'Factor de relación', value: factorRelacion.toFixed(4) },
        { label: 'Grupo en tabla Art. 167', value: grupo },
        { label: '% Cuantía Básica', value: `${pctCuantiaBasica}%` },
        { label: '% Incremento Anual', value: `${pctIncremento}%` },
      ],
      resultado: factorRelacion,
      resultadoLabel: 'Factor de relación',
    };
    steps.push(paso2);

    const cuantiaBasicaAnual = sbcTopado * (pctCuantiaBasica / 100) * 365;

    const paso3: CalculationStep = {
      paso: 3,
      titulo: 'Cuantía Básica Anual',
      descripcion: 'Se multiplica el SPD topado por el porcentaje de cuantía básica y por 365 días',
      valores: [
        { label: 'SPD topado', value: PensionCalculatorService.formatCurrency(sbcTopado) },
        { label: '% Cuantía Básica', value: `${pctCuantiaBasica}%` },
        {
          label: 'Factor diario',
          value: PensionCalculatorService.formatCurrency(sbcTopado * (pctCuantiaBasica / 100)),
        },
        { label: '× 365 días', value: '365' },
      ],
      resultado: cuantiaBasicaAnual,
      resultadoLabel: 'Cuantía Básica Anual (Resultado A)',
    };
    steps.push(paso3);

    const semanasExcedentes = Math.max(0, semanasCotizadas - MIN_SEMANAS);
    const { anos, divisionExacta, parteDecimal, regla, anosEfectivos } =
      this.calcularReglaRedondeo(semanasExcedentes);
    const incrementoAnualUnitario = sbcTopado * (pctIncremento / 100) * 365;
    const incrementoAnualTotal = incrementoAnualUnitario * anosEfectivos;

    const paso4: CalculationStep = {
      paso: 4,
      titulo: 'Incrementos Anuales',
      descripcion: `Se dividen las ${semanasExcedentes} semanas excedentes entre 52 para obtener los años de incremento. La parte decimal determina el incremento adicional según la regla de redondeo.`,
      valores: [
        { label: 'Semanas cotizadas totales', value: semanasCotizadas.toLocaleString() },
        { label: 'Semanas base (mínimo)', value: MIN_SEMANAS.toLocaleString() },
        { label: 'Semanas excedentes', value: semanasExcedentes.toLocaleString() },
        { label: 'División', value: `${semanasExcedentes} ÷ 52 = ${divisionExacta.toFixed(4)}` },
        { label: 'Años enteros', value: anos.toString() },
        { label: 'Parte decimal', value: parteDecimal.toFixed(4) },
        { label: 'Regla de redondeo', value: regla },
        { label: 'Años efectivos de incremento', value: anosEfectivos.toString() },
        {
          label: 'Incremento anual unitario',
          value: PensionCalculatorService.formatCurrency(incrementoAnualUnitario),
        },
      ],
      resultado: incrementoAnualTotal,
      resultadoLabel: 'Incremento Anual Total (Resultado B)',
    };
    steps.push(paso4);

    const sumaBase = cuantiaBasicaAnual + incrementoAnualTotal;
    const montoConFactorFox = sumaBase * FACTOR_FOX;

    const paso5: CalculationStep = {
      paso: 5,
      titulo: 'Suma Base y Factor Fox',
      descripcion: `Se suma la Cuantía Básica + los Incrementos Anuales y se aplica el Factor Fox (${FACTOR_FOX}) — incremento del 11% por decreto`,
      valores: [
        {
          label: 'Cuantía Básica Anual (A)',
          value: PensionCalculatorService.formatCurrency(cuantiaBasicaAnual),
        },
        {
          label: 'Incremento Anual Total (B)',
          value: PensionCalculatorService.formatCurrency(incrementoAnualTotal),
        },
        { label: 'Suma Base (A + B)', value: PensionCalculatorService.formatCurrency(sumaBase) },
        { label: 'Factor Fox', value: FACTOR_FOX.toString() },
      ],
      resultado: montoConFactorFox,
      resultadoLabel: 'Monto con Factor Fox',
    };
    steps.push(paso5);

    const asignaciones = this.calcularAsignaciones(estadoCivil, hijosCount, padresCount);
    const totalPorcentajeAsignaciones = asignaciones.reduce((sum, a) => sum + a.porcentaje, 0);
    const montoAsignaciones = montoConFactorFox * totalPorcentajeAsignaciones;
    const montoConAsignaciones = montoConFactorFox + montoAsignaciones;

    const paso6: CalculationStep = {
      paso: 6,
      titulo: 'Asignaciones Familiares',
      descripcion:
        'Se añaden los porcentajes correspondientes por cónyuge/soledad (15%), hijos (10% c/u) y padres dependientes (10% c/u)',
      valores: [
        ...asignaciones.map((a) => ({
          label: a.descripcion,
          value: PensionCalculatorService.formatCurrency(montoConFactorFox * a.porcentaje),
        })),
        {
          label: 'Total asignaciones',
          value: `${(totalPorcentajeAsignaciones * 100).toFixed(0)}%`,
        },
        {
          label: 'Monto de asignaciones',
          value: PensionCalculatorService.formatCurrency(montoAsignaciones),
        },
        {
          label: 'Subtotal con Factor Fox',
          value: PensionCalculatorService.formatCurrency(montoConFactorFox),
        },
      ],
      resultado: montoConAsignaciones,
      resultadoLabel: 'Monto con Asignaciones Familiares',
    };
    steps.push(paso6);

    const { factor: factorEdad, label: factorEdadLabel } = this.buscarFactorEdad(edad);
    const pensionAnual = montoConAsignaciones * factorEdad;
    const pensionMensual = pensionAnual / 12;

    const paso7: CalculationStep = {
      paso: 7,
      titulo: 'Aplicación por Edad de Retiro',
      descripcion: 'Se aplica el factor según la edad de retiro al monto total',
      valores: [
        { label: 'Edad de retiro', value: `${edad} años` },
        { label: 'Factor aplicado', value: factorEdadLabel },
        {
          label: 'Monto antes de factor de edad',
          value: PensionCalculatorService.formatCurrency(montoConAsignaciones),
        },
      ],
      resultado: pensionAnual,
      resultadoLabel: 'Pensión Anual',
    };
    steps.push(paso7);

    const aguinaldo = pensionMensual;

    return {
      salarioPromedioDiario: sbcTopado,
      factorRelacion,
      grupoTabla: grupo,
      porcentajeCuantiaBasica: pctCuantiaBasica,
      porcentajeIncrementoAnual: pctIncremento,
      cuantiaBasicaAnual,
      semanasExcedentes,
      anosIncremento: anosEfectivos,
      divisionExacta,
      parteDecimal,
      reglaRedondeo: regla,
      incrementoAnualTotal,
      sumaBase,
      montoConFactorFox,
      asignaciones,
      montoConAsignaciones,
      factorEdad,
      factorEdadLabel,
      pensionAnual,
      pensionMensual,
      aguinaldo,
      steps,
    };
  }

  calcularProyeccionAnual(
    rawEntries: SbcEntry[],
    fechaFinalBase: Date,
    fechaReferencia: Date | null,
    semanasReferencia: number,
    salarioMinimoGeneral: number,
    edad: number,
    estadoCivil: EstadoCivil,
    hijosCount: number,
    padresCount: number,
  ): ProyeccionMensual[] {
    const MESES = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const resultados: ProyeccionMensual[] = [];

    for (let i = 0; i < 12; i++) {
      const fechaFinal = new Date(
        Date.UTC(fechaFinalBase.getFullYear(), fechaFinalBase.getMonth() + i + 1, 0),
      );

      const computedEntries = this.calcularFechasFinAuto(rawEntries, fechaFinal);
      const corteInfo = this.calcularCorte250(computedEntries);
      const effectiveEntries = this.calcularEffectiveEntries(computedEntries, corteInfo);

      let semanasCotizadas = semanasReferencia;
      if (fechaReferencia) {
        const diasAdicionales = this.calcularDiasEntreFechas(fechaReferencia, fechaFinal) - 1;
        if (diasAdicionales > 0) {
          semanasCotizadas += this.diasASemanas(diasAdicionales);
        }
      }

      const result = this.calcularPension(
        effectiveEntries,
        corteInfo,
        salarioMinimoGeneral,
        semanasCotizadas,
        edad,
        estadoCivil,
        hijosCount,
        padresCount,
      );

      const label = `${MESES[fechaFinal.getMonth()]} ${fechaFinal.getFullYear()}`;

      resultados.push({
        fechaFinal,
        label,
        semanasCotizadas,
        pensionMensual: result.pensionMensual,
        pensionAnual: result.pensionAnual,
        aguinaldo: result.aguinaldo,
        factorRelacion: result.factorRelacion,
        sbcPromedio: result.salarioPromedioDiario,
      });
    }

    return resultados;
  }
}
