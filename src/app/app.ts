import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SbcGridComponent } from './components/sbc-grid/sbc-grid';
import { PensionFormComponent } from './components/pension-form/pension-form';
import { CalculationBreakdownComponent } from './components/calculation-breakdown/calculation-breakdown';
import { PensionResultComponent } from './components/pension-result/pension-result';
import { PensionCalculatorService } from './services/pension-calculator.service';
import { SbcEntry, PensionResult, EstadoCivil, Corte250Info, SMG_DEFAULT, ART167_TABLE } from './models/pension.model';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    SbcGridComponent,
    PensionFormComponent,
    CalculationBreakdownComponent,
    PensionResultComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private calculator = new PensionCalculatorService();

  fechaFinal = signal<Date | null>(new Date('2026-09-30T00:00:00'));
  fechaReferencia = signal<Date | null>(new Date('2023-12-31T00:00:00'));

  sbcEntries = signal<SbcEntry[]>([
    { id: 1, sbc: 2828.50, fechaInicio: new Date('2025-06-01'), fechaFin: null, dias: 0 },
    { id: 2, sbc: 2714.25, fechaInicio: new Date('2024-02-01'), fechaFin: null, dias: 0 },
    { id: 3, sbc: 2405.50, fechaInicio: new Date('2022-02-01'), fechaFin: null, dias: 0 },
    { id: 4, sbc: 2240.50, fechaInicio: new Date('2021-12-01'), fechaFin: null, dias: 0 },
  ]);

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

  salarioMinimoGeneral = signal(SMG_DEFAULT);
  semanasReferencia = signal(1352);
  edadRetiro = signal(60);
  estadoCivil = signal<EstadoCivil>('casado');
  hijosCount = signal(1);
  padresCount = signal(0);

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

  showTable = signal(false);
  pensionResult = signal<PensionResult | null>(null);
  hasCalculated = signal(false);

  art167Table = ART167_TABLE;

  calcular(): void {
    const effective = this.effectiveEntries();
    if (effective.length === 0 || effective.every(e => e.sbc <= 0)) {
      this.pensionResult.set(null);
      return;
    }

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

  toggleTable(): void {
    this.showTable.update(v => !v);
  }

  formatHasta(hasta: number): string {
    return hasta === Infinity ? 'Más de 6.01' : hasta.toFixed(2);
  }

  isRowActive(row: { desde: number; hasta: number }, factor: number): boolean {
    return factor >= row.desde && (row.hasta === Infinity ? true : factor <= row.hasta);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);
  }

  generatePDF(): void {
    const result = this.pensionResult();
    if (!result) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Cálculo de Pensión — Ley 73 IMSS', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-MX')} — Auditex Pensiones`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setTextColor(80);
    doc.setFontSize(8);
    const fr = this.fechaReferencia();
    const ff = this.fechaFinal();
    const semanasRefStr = `${this.semanasReferencia()} semanas en constancia`;
    const semanasAdicStr = `${this.semanasAdicionales()} semanas adicionales`;
    const semanasTotStr = `Total: ${this.semanasCotizadas()} semanas cotizadas`;
    if (fr) {
      doc.text(`Constancia: ${fr.toLocaleDateString('es-MX')} — ${semanasRefStr}`, 15, y);
      y += 4;
    }
    if (ff) {
      doc.text(`Periodo SBC hasta: ${ff.toLocaleDateString('es-MX')} — ${semanasAdicStr}`, 15, y);
      y += 4;
    }
    doc.text(semanasTotStr, 15, y);
    y += 6;

    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 6;

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resultado', 15, y);
    y += 8;

    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text(this.formatCurrency(result.pensionMensual), 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Pensión mensual (MXN)', 15, y);
    y += 10;

    doc.setTextColor(0);
    doc.setFontSize(9);

    const dataRows = [
      ['Pensión Anual', this.formatCurrency(result.pensionAnual)],
      ['Aguinaldo Estimado', this.formatCurrency(result.aguinaldo)],
      ['SPD utilizado', this.formatCurrency(result.salarioPromedioDiario)],
      ['Factor de relación', result.factorRelacion.toFixed(4)],
      ['Grupo tabla Art. 167', result.grupoTabla],
      ['% Cuantía Básica', `${result.porcentajeCuantiaBasica}%`],
      ['% Incremento Anual', `${result.porcentajeIncrementoAnual}%`],
      ['Años de incremento', result.anosIncremento.toString()],
      ['Regla de redondeo', result.reglaRedondeo],
      ['Factor de edad', result.factorEdadLabel],
    ];

    for (const [label, value] of dataRows) {
      doc.setFont('helvetica', 'normal');
      doc.text(label, 15, y);
      doc.setFont('helvetica', 'bold');
      doc.text(value, pageWidth - 15, y, { align: 'right' });
      y += 5;
    }

    y += 5;
    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Desglose Paso a Paso', 15, y);
    y += 7;

    doc.setFontSize(9);
    for (const step of result.steps) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(`Paso ${step.paso}: ${step.titulo}`, 15, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(step.descripcion, 15, y, { maxWidth: pageWidth - 30 });
      y += 5;

      doc.setTextColor(0);
      for (const v of step.valores) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.setFont('helvetica', 'normal');
        doc.text(v.label, 20, y);
        doc.setFont('helvetica', 'bold');
        doc.text(String(v.value), pageWidth - 20, y, { align: 'right' });
        y += 4;
      }

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(240, 245, 255);
      doc.rect(15, y - 3, pageWidth - 30, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(step.resultadoLabel, 20, y + 1);
      doc.text(this.formatCurrency(step.resultado), pageWidth - 20, y + 1, { align: 'right' });
      doc.setTextColor(0);
      y += 12;
    }

    doc.save('pension-ley73-imss.pdf');
  }
}