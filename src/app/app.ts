import { Component, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { SbcGridComponent } from './components/sbc-grid/sbc-grid';
import { PensionFormComponent } from './components/pension-form/pension-form';
import { CalculationBreakdownComponent } from './components/calculation-breakdown/calculation-breakdown';
import { PensionResultComponent } from './components/pension-result/pension-result';
import { ProyeccionAnualComponent } from './components/proyeccion-anual/proyeccion-anual';
import { PensionCalculatorService } from './services/pension-calculator.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import {
  SbcEntry,
  PensionResult,
  ProyeccionMensual,
  EstadoCivil,
  Corte250Info,
  ART167_TABLE,
  DEFAULT_CONFIG,
} from './models/pension.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    SbcGridComponent,
    PensionFormComponent,
    CalculationBreakdownComponent,
    PensionResultComponent,
    ProyeccionAnualComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private calculator = inject(PensionCalculatorService);
  private pdfGenerator = inject(PdfGeneratorService);

  fechaFinal = signal<Date | null>(new Date(DEFAULT_CONFIG.fechaFinal.getTime()));
  fechaReferencia = signal<Date | null>(new Date(DEFAULT_CONFIG.fechaReferencia.getTime()));

  sbcEntries = signal<SbcEntry[]>(
    DEFAULT_CONFIG.sbcEntries.map(({ id, sbc, fechaInicio, fechaFin, dias, semanas }) => ({
      id,
      sbc,
      fechaInicio: fechaInicio ? new Date(fechaInicio.getTime()) : null,
      fechaFin: fechaFin ? new Date(fechaFin.getTime()) : null,
      dias,
      semanas,
    })),
  );

  computedEntries = computed(() => {
    const raw = this.sbcEntries();
    const ff = this.fechaFinal();
    return this.calculator.calcularFechasFinAuto(raw, ff);
  });

  corteInfo = computed<Corte250Info>(() => {
    return this.calculator.calcularCorte250(this.computedEntries());
  });

  effectiveEntries = computed<SbcEntry[]>(() => {
    return this.calculator.calcularEffectiveEntries(this.computedEntries(), this.corteInfo());
  });

  salarioMinimoGeneral = signal(DEFAULT_CONFIG.salarioMinimoGeneral);
  semanasReferencia = signal(DEFAULT_CONFIG.semanasReferencia);
  edadRetiro = signal(DEFAULT_CONFIG.edadRetiro);
  estadoCivil = signal<EstadoCivil>(DEFAULT_CONFIG.estadoCivil);
  hijosCount = signal(DEFAULT_CONFIG.hijosCount);
  padresCount = signal(DEFAULT_CONFIG.padresCount);

  semanasAdicionales = computed(() => {
    const ff = this.fechaFinal();
    const fr = this.fechaReferencia();
    if (!ff || !fr) return 0;
    const dias = this.calculator.calcularDiasEntreFechas(fr, ff) - 1;
    if (dias <= 0) return 0;
    return this.calculator.diasASemanas(dias);
  });

  semanasCotizadas = computed(() => {
    return this.semanasReferencia() + this.semanasAdicionales();
  });

  canCalculate = computed(() => {
    const effective = this.effectiveEntries();
    return effective.length > 0 && effective.some((e) => e.sbc > 0) && !this.hasOverlaps();
  });

  showTable = signal(false);
  pensionResult = signal<PensionResult | null>(null);
  hasCalculated = signal(false);
  hasOverlaps = signal(false);
  proyeccionAnual = signal<ProyeccionMensual[] | null>(null);
  showProyeccion = signal(false);

  art167Table = ART167_TABLE;

  calcular(): void {
    if (!this.canCalculate()) {
      this.pensionResult.set(null);
      return;
    }

    const effective = this.effectiveEntries();
    const result = this.calculator.calcularPension(
      effective,
      this.corteInfo(),
      this.salarioMinimoGeneral(),
      this.semanasCotizadas(),
      this.edadRetiro(),
      this.estadoCivil(),
      this.hijosCount(),
      this.padresCount(),
    );

    this.pensionResult.set(result);
    this.hasCalculated.set(true);

    setTimeout(() => {
      document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  onEntriesChange(entries: SbcEntry[]): void {
    this.sbcEntries.set(entries);
  }

  onFechaFinalChange(date: Date | null): void {
    this.fechaFinal.set(date);
  }

  onSmgChange(value: number): void {
    this.salarioMinimoGeneral.set(value);
  }

  onFechaReferenciaChange(date: Date | null): void {
    this.fechaReferencia.set(date);
  }

  onSemanasReferenciaChange(value: number): void {
    this.semanasReferencia.set(value);
  }

  onEdadChange(value: number): void {
    this.edadRetiro.set(value);
  }

  onEstadoCivilChange(value: EstadoCivil): void {
    this.estadoCivil.set(value);
  }

  onHijosChange(value: number): void {
    this.hijosCount.set(value);
  }

  onPadresChange(value: number): void {
    this.padresCount.set(value);
  }

  onHasOverlaps(value: boolean): void {
    this.hasOverlaps.set(value);
  }

  toggleTable(): void {
    this.showTable.update((v) => !v);
  }

  toggleProyeccion(): void {
    this.showProyeccion.update((v) => !v);
    if (!this.showProyeccion() || this.proyeccionAnual()) return;
    this.calcularProyeccionAnual();
  }

  calcularProyeccionAnual(): void {
    const ff = this.fechaFinal();
    const fr = this.fechaReferencia();
    if (!ff) return;

    const rawEntries = this.sbcEntries();
    const resultados = this.calculator.calcularProyeccionAnual(
      rawEntries,
      ff,
      fr,
      this.semanasReferencia(),
      this.salarioMinimoGeneral(),
      this.edadRetiro(),
      this.estadoCivil(),
      this.hijosCount(),
      this.padresCount(),
    );

    this.proyeccionAnual.set(resultados);
  }

  formatHasta(hasta: number): string {
    return hasta === Infinity ? 'Más de 6.01' : hasta.toFixed(2);
  }

  isRowActive(row: { desde: number; hasta: number }, factor: number): boolean {
    return factor >= row.desde && (row.hasta === Infinity ? true : factor <= row.hasta);
  }

  generatePDF(): void {
    const result = this.pensionResult();
    if (!result) return;

    this.pdfGenerator.generate(result, {
      fechaReferencia: this.fechaReferencia(),
      fechaFinal: this.fechaFinal(),
      semanasReferencia: this.semanasReferencia(),
      semanasAdicionales: this.semanasAdicionales(),
      semanasCotizadas: this.semanasCotizadas(),
      effectiveEntries: this.effectiveEntries(),
      corteInfo: this.corteInfo(),
      salarioMinimoGeneral: this.salarioMinimoGeneral(),
      edadRetiro: this.edadRetiro(),
      estadoCivil: this.estadoCivil(),
    });
  }
}
