import { Injectable } from '@angular/core';
import {
  SbcEntry,
  Corte250Info,
  ART167_TABLE,
  EDAD_FACTORES,
  FACTOR_FOX,
  MIN_SEMANAS,
  DIAS_PROMEDIO,
  PensionResult,
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
      } else if (i === 0) {
        entry.fechaFin = new Date(fechaFinal);
        entry.dias = this.calcularDiasEntreFechas(entry.fechaInicio, entry.fechaFin);
      } else {
        const prevInicio = sorted[i - 1].fechaInicio;
        if (prevInicio) {
          const fin = new Date(prevInicio);
          fin.setDate(fin.getDate() - 1);
          entry.fechaFin = fin;
        }
        entry.dias = this.calcularDiasEntreFechas(entry.fechaInicio, entry.fechaFin);
      }
      result.push(entry);
    }

    return result;
  }

  calcularCorte250(entries: SbcEntry[]): Corte250Info {
    const sorted = [...entries].filter(e => e.sbc > 0 && e.fechaInicio && e.fechaFin)
      .sort((a, b) => (b.fechaInicio?.getTime() ?? 0) - (a.fechaInicio?.getTime() ?? 0));

    if (sorted.length === 0) {
      return {
        fechaInicioConsiderada: null,
        fechaFinConsiderada: null,
        totalDiasOriginales: 0,
        totalDiasEfectivos: 0,
        excede1750: false,
        mensaje: 'No hay períodos válidos',
      };
    }

    const totalDiasOriginales = sorted.reduce((sum, e) => sum + e.dias, 0);
    const fechaFinConsiderada = sorted[0].fechaFin;

    if (totalDiasOriginales <= DIAS_PROMEDIO) {
      const fechaInicioConsiderada = sorted[sorted.length - 1].fechaInicio;
      return {
        fechaInicioConsiderada,
        fechaFinConsiderada,
        totalDiasOriginales,
        totalDiasEfectivos: totalDiasOriginales,
        excede1750: false,
        mensaje: totalDiasOriginales < DIAS_PROMEDIO
          ? `Total: ${totalDiasOriginales} días. Faltan ${DIAS_PROMEDIO - totalDiasOriginales} días para completar los 1,750 requeridos.`
          : `Total: ${totalDiasOriginales} días (= 250 semanas). Se alcanzan los 1,750 días.`,
      };
    }

    const fechaCorte = new Date(fechaFinConsiderada!);
    fechaCorte.setDate(fechaCorte.getDate() - DIAS_PROMEDIO + 1);

    return {
      fechaInicioConsiderada: fechaCorte,
      fechaFinConsiderada,
      totalDiasOriginales,
      totalDiasEfectivos: DIAS_PROMEDIO,
      excede1750: true,
      mensaje: `Se exceden los 1,750 días (${totalDiasOriginales}). Se consideran los últimos 1,750 días a partir del ${fechaCorte.toLocaleDateString('es-MX')}.`,
    };
  }

  calcularEffectiveEntries(entries: SbcEntry[], corteInfo: Corte250Info): SbcEntry[] {
    if (!corteInfo.excede1750) {
      return entries.map(e => ({ ...e, efectivo: true, diasEfectivos: e.dias }));
    }

    const sorted = [...entries].filter(e => e.sbc > 0 && e.fechaInicio && e.fechaFin)
      .sort((a, b) => (b.fechaInicio?.getTime() ?? 0) - (a.fechaInicio?.getTime() ?? 0));

    const fechaCorteMs = corteInfo.fechaInicioConsiderada!.getTime();
    let diasRestantes = DIAS_PROMEDIO;

    return sorted.map(entry => {
      const effective = { ...entry, efectivo: true, diasEfectivos: 0 };

      if (diasRestantes <= 0) {
        effective.efectivo = false;
        effective.diasEfectivos = 0;
        return effective;
      }

      if (entry.fechaInicio!.getTime() >= fechaCorteMs) {
        effective.efectivo = true;
        effective.diasEfectivos = Math.min(entry.dias, diasRestantes);
        diasRestantes -= entry.dias;
      } else if (entry.fechaFin!.getTime() >= fechaCorteMs) {
        const effectiveInicio = new Date(corteInfo.fechaInicioConsiderada!);
        const effectiveDias = this.calcularDiasEntreFechas(effectiveInicio, entry.fechaFin);
        effective.efectivo = true;
        effective.diasEfectivos = Math.min(effectiveDias, diasRestantes);
        diasRestantes -= effective.diasEfectivos;
      } else {
        effective.efectivo = false;
        effective.diasEfectivos = 0;
      }

      if (diasRestantes < 0) diasRestantes = 0;
      return effective;
    });
  }

  calcularSalarioPromedioFromEffective(entries: SbcEntry[]): { promedio: number; totalDias: number } {
    let totalProducto = 0;
    let totalDias = 0;

    for (const entry of entries) {
      const dias = entry.diasEfectivos ?? 0;
      if (entry.sbc > 0 && dias > 0 && entry.efectivo !== false) {
        totalProducto += entry.sbc * dias;
        totalDias += dias;
      }
    }

    const promedio = totalDias > 0 ? totalProducto / totalDias : 0;
    return { promedio, totalDias };
  }

  calcularDiasEntreFechas(inicio: Date | null, fin: Date | null): number {
    if (!inicio || !fin) return 0;
    const startUtc = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const endUtc = Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate());
    const diffDays = Math.round((endUtc - startUtc) / 86400000);
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

  buscarPorcentajesTabla(factor: number): { cuantiaBasica: number; incrementoAnual: number; grupo: string } {
    for (const row of ART167_TABLE) {
      if (factor >= row.desde && factor <= row.hasta) {
        return {
          cuantiaBasica: row.porcentajeCuantiaBasica,
          incrementoAnual: row.porcentajeIncrementoAnual,
          grupo: row.hasta === Infinity
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

  calcularReglaRedondeo(semanasExcedentes: number): { anos: number; divisionExacta: number; parteDecimal: number; regla: string; anosEfectivos: number } {
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

  calcularAsignaciones(estadoCivil: EstadoCivil, hijosCount: number, padresCount: number): AsignacionFamiliar[] {
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
        porcentaje: 0.10,
      });
    }

    for (let i = 0; i < padresCount; i++) {
      asignaciones.push({
        tipo: 'padre',
        descripcion: `Padre/Madre dependiente ${i + 1} (10%)`,
        porcentaje: 0.10,
      });
    }

    return asignaciones;
  }

  buscarFactorEdad(edad: number): { factor: number; label: string } {
    const found = EDAD_FACTORES.find(e => e.edad === edad);
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

    const { promedio: spd, totalDias } = this.calcularSalarioPromedioFromEffective(effectiveEntries);

    const sbcTopado = Math.min(spd, UMA_2026 * 25);

    const periodoStr = corteInfo.fechaInicioConsiderada && corteInfo.fechaFinConsiderada
      ? `del ${corteInfo.fechaInicioConsiderada.toLocaleDateString('es-MX')} al ${corteInfo.fechaFinConsiderada.toLocaleDateString('es-MX')}`
      : '';

    const paso1: CalculationStep = {
      paso: 1,
      titulo: 'Salario Promedio Diario (SPD)',
      descripcion: corteInfo.excede1750
        ? `Se calcula el promedio ponderado con los últimos 1,750 días cotizados (${DIAS_PROMEDIO} días = 250 semanas) ${periodoStr}`
        : `Se calcula el promedio ponderado de los SBC con los ${totalDias} días disponibles ${periodoStr}`,
      valores: [
        { label: 'Días efectivos considerados', value: totalDias.toLocaleString() },
        { label: 'Días requeridos (250 semanas)', value: DIAS_PROMEDIO.toLocaleString() },
        { label: 'SPD calculado', value: this.formatCurrency(spd) },
        { label: 'Tope (25 UMAs)', value: this.formatCurrency(UMA_2026 * 25) },
        { label: 'SPD topado', value: this.formatCurrency(sbcTopado) },
      ],
      resultado: sbcTopado,
      resultadoLabel: 'SPD utilizado para el cálculo',
    };
    steps.push(paso1);

    const factorRelacion = salarioMinimoGeneral > 0 ? sbcTopado / salarioMinimoGeneral : 0;
    const { cuantiaBasica: pctCuantiaBasica, incrementoAnual: pctIncremento, grupo } =
      this.buscarPorcentajesTabla(factorRelacion);

    const paso2: CalculationStep = {
      paso: 2,
      titulo: 'Factor de Relación con el SMG',
      descripcion: 'Se divide el SPD topado entre el Salario Mínimo General para ubicar el renglón en la tabla del Art. 167',
      valores: [
        { label: 'SPD topado', value: this.formatCurrency(sbcTopado) },
        { label: 'SMG vigente', value: this.formatCurrency(salarioMinimoGeneral) },
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
        { label: 'SPD topado', value: this.formatCurrency(sbcTopado) },
        { label: '% Cuantía Básica', value: `${pctCuantiaBasica}%` },
        { label: 'Factor diario', value: this.formatCurrency(sbcTopado * (pctCuantiaBasica / 100)) },
        { label: '× 365 días', value: '365' },
      ],
      resultado: cuantiaBasicaAnual,
      resultadoLabel: 'Cuantía Básica Anual (Resultado A)',
    };
    steps.push(paso3);

    const semanasExcedentes = Math.max(0, semanasCotizadas - MIN_SEMANAS);
    const { anos, divisionExacta, parteDecimal, regla, anosEfectivos } = this.calcularReglaRedondeo(semanasExcedentes);
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
        { label: 'Incremento anual unitario', value: this.formatCurrency(incrementoAnualUnitario) },
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
        { label: 'Cuantía Básica Anual (A)', value: this.formatCurrency(cuantiaBasicaAnual) },
        { label: 'Incremento Anual Total (B)', value: this.formatCurrency(incrementoAnualTotal) },
        { label: 'Suma Base (A + B)', value: this.formatCurrency(sumaBase) },
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
      descripcion: 'Se añaden los porcentajes correspondientes por cónyuge/soledad (15%), hijos (10% c/u) y padres dependientes (10% c/u)',
      valores: [
        ...asignaciones.map(a => ({
          label: a.descripcion,
          value: this.formatCurrency(montoConFactorFox * a.porcentaje),
        })),
        { label: 'Total asignaciones', value: `${(totalPorcentajeAsignaciones * 100).toFixed(0)}%` },
        { label: 'Monto de asignaciones', value: this.formatCurrency(montoAsignaciones) },
        { label: 'Subtotal con Factor Fox', value: this.formatCurrency(montoConFactorFox) },
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
        { label: 'Monto antes de factor de edad', value: this.formatCurrency(montoConAsignaciones) },
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

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);
  }
}