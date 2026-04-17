export interface SbcEntry {
  id: number;
  sbc: number;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  dias: number;
  efectivo?: boolean;
  diasEfectivos?: number;
}

export interface Corte250Info {
  fechaInicioConsiderada: Date | null;
  fechaFinConsiderada: Date | null;
  totalDiasOriginales: number;
  totalDiasEfectivos: number;
  excede1750: boolean;
  mensaje: string;
}

export interface Art167Row {
  desde: number;
  hasta: number;
  porcentajeCuantiaBasica: number;
  porcentajeIncrementoAnual: number;
}

export interface AsignacionFamiliar {
  tipo: 'conyuge' | 'hijo' | 'padre';
  descripcion: string;
  porcentaje: number;
}

export type EstadoCivil = 'casado' | 'concubina' | 'soltero';

export interface PensionInput {
  sbcEntries: SbcEntry[];
  salarioMinimoGeneral: number;
  semanasCotizadas: number;
  edadRetiro: number;
  estadoCivil: EstadoCivil;
  dependientes: AsignacionFamiliar[];
}

export interface CalculationStep {
  paso: number;
  titulo: string;
  descripcion: string;
  valores: CalculationValue[];
  resultado: number;
  resultadoLabel: string;
}

export interface CalculationValue {
  label: string;
  value: number | string;
}

export interface PensionResult {
  salarioPromedioDiario: number;
  factorRelacion: number;
  grupoTabla: string;
  porcentajeCuantiaBasica: number;
  porcentajeIncrementoAnual: number;
  cuantiaBasicaAnual: number;
  semanasExcedentes: number;
  anosIncremento: number;
  semanasResiduo: number;
  reglaRedondeo: string;
  incrementoAnualTotal: number;
  sumaBase: number;
  montoConFactorFox: number;
  asignaciones: AsignacionFamiliar[];
  montoConAsignaciones: number;
  factorEdad: number;
  factorEdadLabel: string;
  pensionAnual: number;
  pensionMensual: number;
  aguinaldo: number;
  steps: CalculationStep[];
}

export const ART167_TABLE: Art167Row[] = [
  { desde: 1.00, hasta: 1.00, porcentajeCuantiaBasica: 80.00, porcentajeIncrementoAnual: 0.563 },
  { desde: 1.01, hasta: 1.25, porcentajeCuantiaBasica: 77.11, porcentajeIncrementoAnual: 0.814 },
  { desde: 1.26, hasta: 1.50, porcentajeCuantiaBasica: 58.18, porcentajeIncrementoAnual: 1.178 },
  { desde: 1.51, hasta: 1.75, porcentajeCuantiaBasica: 49.23, porcentajeIncrementoAnual: 1.430 },
  { desde: 1.76, hasta: 2.00, porcentajeCuantiaBasica: 42.67, porcentajeIncrementoAnual: 1.615 },
  { desde: 2.01, hasta: 2.25, porcentajeCuantiaBasica: 37.65, porcentajeIncrementoAnual: 1.756 },
  { desde: 2.26, hasta: 2.50, porcentajeCuantiaBasica: 33.68, porcentajeIncrementoAnual: 1.868 },
  { desde: 2.51, hasta: 2.75, porcentajeCuantiaBasica: 30.48, porcentajeIncrementoAnual: 1.958 },
  { desde: 2.76, hasta: 3.00, porcentajeCuantiaBasica: 27.83, porcentajeIncrementoAnual: 2.033 },
  { desde: 3.01, hasta: 3.25, porcentajeCuantiaBasica: 25.60, porcentajeIncrementoAnual: 2.096 },
  { desde: 3.26, hasta: 3.50, porcentajeCuantiaBasica: 23.70, porcentajeIncrementoAnual: 2.149 },
  { desde: 3.51, hasta: 3.75, porcentajeCuantiaBasica: 22.07, porcentajeIncrementoAnual: 2.195 },
  { desde: 3.76, hasta: 4.00, porcentajeCuantiaBasica: 20.65, porcentajeIncrementoAnual: 2.235 },
  { desde: 4.01, hasta: 4.25, porcentajeCuantiaBasica: 19.39, porcentajeIncrementoAnual: 2.271 },
  { desde: 4.26, hasta: 4.50, porcentajeCuantiaBasica: 18.28, porcentajeIncrementoAnual: 2.302 },
  { desde: 4.51, hasta: 4.75, porcentajeCuantiaBasica: 17.30, porcentajeIncrementoAnual: 2.330 },
  { desde: 4.76, hasta: 5.00, porcentajeCuantiaBasica: 16.41, porcentajeIncrementoAnual: 2.355 },
  { desde: 5.01, hasta: 5.25, porcentajeCuantiaBasica: 15.61, porcentajeIncrementoAnual: 2.377 },
  { desde: 5.26, hasta: 5.50, porcentajeCuantiaBasica: 14.88, porcentajeIncrementoAnual: 2.398 },
  { desde: 5.51, hasta: 5.75, porcentajeCuantiaBasica: 14.22, porcentajeIncrementoAnual: 2.416 },
  { desde: 5.76, hasta: 6.00, porcentajeCuantiaBasica: 13.62, porcentajeIncrementoAnual: 2.433 },
  { desde: 6.01, hasta: Infinity, porcentajeCuantiaBasica: 13.00, porcentajeIncrementoAnual: 2.450 },
];

export const EDAD_FACTORES: { edad: number; factor: number; label: string }[] = [
  { edad: 60, factor: 0.75, label: '75% (Cesantía en edad avanzada)' },
  { edad: 61, factor: 0.80, label: '80%' },
  { edad: 62, factor: 0.85, label: '85%' },
  { edad: 63, factor: 0.90, label: '90%' },
  { edad: 64, factor: 0.95, label: '95%' },
  { edad: 65, factor: 1.00, label: '100% (Vejez)' },
];

export const UMA_2026 = 115.57;
export const SMG_DEFAULT = 315.04;
export const FACTOR_FOX = 1.11;
export const MIN_SEMANAS = 500;
export const DIAS_PROMEDIO = 1750;

export const DEFAULT_CONFIG = {
  fechaFinal: new Date(Date.UTC(2026, 8, 30)),
  fechaReferencia: new Date(Date.UTC(2023, 11, 31)),
  semanasReferencia: 1352,
  edadRetiro: 60,
  estadoCivil: 'casado' as EstadoCivil,
  hijosCount: 1,
  padresCount: 0,
  salarioMinimoGeneral: SMG_DEFAULT,
  sbcEntries: [
    { id: 1, sbc: 2828.50, fechaInicio: new Date(Date.UTC(2025, 5, 1)), fechaFin: null as Date | null, dias: 0 },
    { id: 2, sbc: 2714.25, fechaInicio: new Date(Date.UTC(2024, 1, 1)), fechaFin: null as Date | null, dias: 0 },
    { id: 3, sbc: 2405.50, fechaInicio: new Date(Date.UTC(2022, 1, 1)), fechaFin: null as Date | null, dias: 0 },
    { id: 4, sbc: 2240.50, fechaInicio: new Date(Date.UTC(2021, 11, 1)), fechaFin: null as Date | null, dias: 0 },
  ] as SbcEntry[],
};