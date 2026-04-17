import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { PensionResult, Corte250Info, SbcEntry } from '../models/pension.model';
import { PensionCalculatorService } from './pension-calculator.service';

@Injectable({ providedIn: 'root' })
export class PdfGeneratorService {
  private static readonly currency = PensionCalculatorService.formatCurrency;

  private readonly M = 18;

  private cw(doc: jsPDF): number {
    return doc.internal.pageSize.getWidth() - 2 * this.M;
  }

  generate(
    result: PensionResult,
    opts: {
      fechaReferencia: Date | null;
      fechaFinal: Date | null;
      semanasReferencia: number;
      semanasAdicionales: number;
      semanasCotizadas: number;
      effectiveEntries: SbcEntry[];
      corteInfo: Corte250Info;
      salarioMinimoGeneral: number;
      edadRetiro: number;
      estadoCivil: string;
    },
  ): void {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    let y = 0;

    y = this.drawHeader(doc, pw);
    y = this.drawContextBar(doc, y, opts, pw);
    y = this.drawSbcTable(doc, y, opts, pw, ph);
    y = this.drawResultSection(doc, y, result, pw);
    y = this.drawSummaryGrid(doc, y, result, pw);
    y = this.drawSeparator(doc, y, pw);
    y = this.drawSteps(doc, y, result, pw, ph);
    this.drawFooter(doc, pw, ph);

    doc.save('pension-ley73-imss.pdf');
  }

  private drawHeader(doc: jsPDF, pw: number): number {
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, pw, 38, 'F');

    doc.setFillColor(15, 118, 110);
    doc.rect(0, 34, pw, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('C\u00e1lculo de Pensi\u00f3n', this.M, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 255, 250);
    doc.text('Ley del Seguro Social 1973 \u2014 Art\u00edculo 167', this.M, 23);

    doc.setFontSize(7);
    doc.setTextColor(180, 230, 225);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`, this.M, 30);
    doc.text('Auditex Pensiones', pw - this.M, 30, { align: 'right' });

    return 42;
  }

  private drawContextBar(doc: jsPDF, y: number, opts: any, pw: number): number {
    const cw = this.cw(doc);
    doc.setFillColor(248, 248, 245);
    doc.rect(this.M, y, cw, 20, 'F');

    doc.setDrawColor(210, 210, 205);
    doc.setLineWidth(0.3);
    doc.rect(this.M, y, cw, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(74, 74, 104);

    const c1 = this.M + 3;
    const c2 = this.M + cw / 3 + 3;
    const c3 = this.M + (2 * cw) / 3 + 3;

    doc.setFont('helvetica', 'bold');
    doc.text('Constancia:', c1, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(opts.fechaReferencia ? opts.fechaReferencia.toLocaleDateString('es-MX') : '\u2014', c1 + 18, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Periodo SBC:', c2, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(opts.fechaFinal ? opts.fechaFinal.toLocaleDateString('es-MX') : '\u2014', c2 + 22, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Semanas:', c3, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(`${opts.semanasCotizadas} (${opts.semanasReferencia} constancia + ${opts.semanasAdicionales} adicional)`, c3 + 16, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('Edad:', c1, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(`${opts.edadRetiro} a\u00f1os`, c1 + 12, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.text('SMG:', c2, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(PdfGeneratorService.currency(opts.salarioMinimoGeneral), c2 + 10, y + 15);

    doc.setFont('helvetica', 'bold');
    doc.text('Estado:', c3, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(this.capitalizeEstado(opts.estadoCivil), c3 + 15, y + 15);

    return y + 24;
  }

  private drawSbcTable(doc: jsPDF, startY: number, opts: any, pw: number, ph: number): number {
    const entries: SbcEntry[] = opts.effectiveEntries ?? [];
    const corteInfo: Corte250Info = opts.corteInfo;
    const showEffective = corteInfo.excede250;
    const cw = this.cw(doc);
    let y = startY;

    const headerHeight = 8;
    const rowHeight = 6.5;
    const bottomMargin = 20;
    const tableHeader = headerHeight + rowHeight * (entries.length + 1);

    if (y + tableHeader > ph - bottomMargin) {
      this.drawFooter(doc, pw, ph);
      doc.addPage();
      y = this.M;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(13, 148, 136);
    doc.text('BASE DE C\u00c1LCULO SBC', this.M, y + 5);
    y += 8;

    if (corteInfo.fechaInicioConsiderada && corteInfo.fechaFinConsiderada) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(74, 74, 104);
      const periodoStr = `Periodo: ${corteInfo.fechaInicioConsiderada.toLocaleDateString('es-MX')} al ${corteInfo.fechaFinConsiderada.toLocaleDateString('es-MX')}`;
      doc.text(periodoStr, this.M, y);
      y += 5;
    }

    const colSbc = 36;
    const colFechaIni = 30;
    const colFechaFin = 30;
    const colSemanas = 22;
    const colSemEfectivas = showEffective ? 26 : 0;
    const colTotal = cw;

    const cols: { label: string; width: number }[] = [
      { label: 'SBC (Diario)', width: colSbc },
      { label: 'Fecha Inicio', width: colFechaIni },
      { label: 'Fecha Fin', width: colFechaFin },
      { label: 'Semanas', width: colSemanas },
    ];
    if (showEffective) {
      cols.push({ label: 'Sem. Efect.', width: colSemEfectivas });
    }

    doc.setFillColor(13, 148, 136);
    doc.rect(this.M, y, cw, headerHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);

    let xPos = this.M;
    for (const col of cols) {
      doc.text(col.label, xPos + 2, y + 5.5);
      xPos += col.width;
    }
    y += headerHeight;

    for (const entry of entries) {
      if (y + rowHeight > ph - bottomMargin) {
        this.drawFooter(doc, pw, ph);
        doc.addPage();
        y = this.M;
      }

      const isExcluded = entry.efectivo === false;
      const isPartial = entry.semanasEfectivas != null && entry.semanasEfectivas < (entry.semanas || 0);

      if (isExcluded) {
        doc.setFillColor(245, 240, 240);
      } else if (isPartial) {
        doc.setFillColor(255, 250, 240);
      } else {
        doc.setFillColor(252, 252, 250);
      }
      doc.rect(this.M, y, cw, rowHeight, 'F');

      doc.setDrawColor(230, 230, 225);
      doc.setLineWidth(0.15);
      doc.line(this.M, y + rowHeight, this.M + cw, y + rowHeight);

      doc.setFont('courier', isExcluded ? 'normal' : 'bold');
      doc.setFontSize(7);
      doc.setTextColor(isExcluded ? 160 : 26, isExcluded ? 160 : 26, isExcluded ? 160 : 46);

      xPos = this.M;
      for (let ci = 0; ci < cols.length; ci++) {
        const col = cols[ci];
        let val = '';
        if (ci === 0) val = PdfGeneratorService.currency(entry.sbc);
        else if (ci === 1) val = entry.fechaInicio ? entry.fechaInicio.toLocaleDateString('es-MX') : '\u2014';
        else if (ci === 2) val = entry.fechaFin ? entry.fechaFin.toLocaleDateString('es-MX') : '\u2014';
        else if (ci === 3) val = (entry.semanas || 0).toString();
        else if (ci === 4 && showEffective) {
          val = isExcluded ? '\u2014' : (entry.semanasEfectivas?.toString() ?? (entry.semanas?.toString() ?? '\u2014'));
        }

        const align = (ci === 0) ? 'left' : (ci >= 3 ? 'right' : 'left');
        doc.text(val, xPos + (align === 'right' ? col.width - 3 : 2), y + 4.5, { align: align as 'left' | 'right' });
        xPos += col.width;
      }

      y += rowHeight;
    }

    if (entries.length > 0) {
      doc.setDrawColor(13, 148, 136);
      doc.setLineWidth(0.4);
      doc.line(this.M, y, this.M + cw, y);

      const totalSem = entries.reduce((s, e) => s + (e.semanas || 0), 0);
      const EffectiveSem = entries.reduce((s, e) => s + (e.semanasEfectivas ?? (e.efectivo !== false ? e.semanas ?? 0 : 0)), 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(13, 148, 136);

      let totalLabel = `Total: ${totalSem} semanas`;
      if (showEffective) {
        totalLabel += ` | Efectivas: ${EffectiveSem} de 250`;
      } else {
        totalLabel += ` de 250`;
      }

      const promedio = entries.length > 0
        ? entries.filter(e => e.efectivo !== false).reduce((acc, e) => acc + e.sbc * (e.semanasEfectivas ?? e.semanas ?? 0), 0) /
          entries.filter(e => e.efectivo !== false).reduce((acc, e) => acc + (e.semanasEfectivas ?? e.semanas ?? 0), 0)
        : 0;

      doc.text(totalLabel, this.M + 2, y + 5);

      if (promedio > 0) {
        doc.text(`Promedio ponderado: ${PdfGeneratorService.currency(promedio)}`, this.M + cw - 3, y + 5, { align: 'right' });
      }

      y += 8;
    }

    return y + 4;
  }

  private drawResultSection(doc: jsPDF, y: number, result: PensionResult, pw: number): number {
    const cw = this.cw(doc);
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(this.M, y, cw, 30, 3, 3, 'F');

    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.6);
    doc.roundedRect(this.M, y, cw, 30, 3, 3, 'S');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(74, 74, 104);
    doc.text('PENSI\u00d3N MENSUAL (MXN)', this.M + 10, y + 10);

    doc.setFont('courier', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(13, 148, 136);
    doc.text(PdfGeneratorService.currency(result.pensionMensual), this.M + 10, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(142, 142, 160);

    const rx = pw - this.M - 5;
    doc.text('Anual:', rx - 82, y + 12);
    doc.setFont('helvetica', 'bold');
    doc.text(PdfGeneratorService.currency(result.pensionAnual), rx, y + 12, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('Aguinaldo:', rx - 82, y + 20);
    doc.setFont('helvetica', 'bold');
    doc.text(PdfGeneratorService.currency(result.aguinaldo), rx, y + 20, { align: 'right' });

    return y + 36;
  }

  private drawSummaryGrid(doc: jsPDF, y: number, result: PensionResult, pw: number): number {
    const cw = this.cw(doc);
    const items: [string, string][] = [
      ['SPD utilizado', PdfGeneratorService.currency(result.salarioPromedioDiario)],
      ['Factor de relaci\u00f3n', result.factorRelacion.toFixed(4)],
      ['Grupo tabla Art. 167', result.grupoTabla],
      ['% Cuant\u00eda B\u00e1sica', `${result.porcentajeCuantiaBasica}%`],
      ['% Incremento Anual', `${result.porcentajeIncrementoAnual}%`],
      ['A\u00f1os de incremento', result.anosIncremento.toString()],
      ['Regla de redondeo', this.shortenRegla(result.reglaRedondeo)],
      ['Factor de edad', result.factorEdadLabel],
    ];

    const colWidth = cw / 2;
    const rowHeight = 9;

    doc.setFontSize(7.5);
    for (let i = 0; i < items.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = this.M + col * colWidth;
      const ry = y + row * rowHeight;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(74, 74, 104);
      doc.text(items[i][0], x + 2, ry + 5);

      doc.setFont('courier', 'bold');
      doc.setTextColor(26, 26, 46);
      doc.text(items[i][1], x + colWidth - 4, ry + 5, { align: 'right' });

      doc.setDrawColor(210, 210, 205);
      doc.setLineWidth(0.15);
      doc.line(x, ry + rowHeight - 1, x + colWidth, ry + rowHeight - 1);
    }

    return y + Math.ceil(items.length / 2) * rowHeight + 4;
  }

  private drawSeparator(doc: jsPDF, y: number, pw: number): number {
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.5);
    doc.line(this.M, y, pw - this.M, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(13, 148, 136);
    doc.text('DESGLOSE PASO A PASO', this.M, y + 6);

    return y + 12;
  }

  private drawSteps(doc: jsPDF, startY: number, result: PensionResult, pw: number, ph: number): number {
    let y = startY;
    const cw = this.cw(doc);
    const bottomMargin = 20;

    for (const step of result.steps) {
      const estimatedHeight = 20 + step.valores.length * 5.5 + 14;
      if (y + estimatedHeight > ph - bottomMargin) {
        this.drawFooter(doc, pw, ph);
        doc.addPage();
        y = this.M;
      }

      doc.setFillColor(13, 148, 136);
      doc.roundedRect(this.M, y, 16, 8, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(`${step.paso}`, this.M + 8, y + 5.5, { align: 'center' });

      doc.setTextColor(26, 26, 46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(step.titulo, this.M + 18, y + 5.5);

      y += 11;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(74, 74, 104);
      const descLines = doc.splitTextToSize(step.descripcion, cw - 4);
      doc.text(descLines, this.M + 2, y);
      y += descLines.length * 3.5 + 2;

      doc.setFillColor(248, 248, 245);
      doc.roundedRect(this.M, y - 2, cw, step.valores.length * 5.5 + 4, 2, 2, 'F');

      for (const v of step.valores) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(74, 74, 104);
        doc.text(v.label, this.M + 4, y + 2);

        doc.setFont('courier', 'bold');
        doc.setTextColor(26, 26, 46);
        doc.text(String(v.value), pw - this.M - 4, y + 2, { align: 'right' });

        y += 5.5;
      }

      y += 2;

      doc.setDrawColor(13, 148, 136);
      doc.setLineWidth(0.4);
      doc.line(this.M, y, this.M + 2.5, y);
      doc.line(pw - this.M - 2.5, y, pw - this.M, y);

      doc.setFillColor(240, 253, 250);
      doc.roundedRect(this.M, y - 0.5, cw, 9, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 118, 110);
      doc.text(step.resultadoLabel, this.M + 4, y + 5);

      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(13, 148, 136);
      doc.text(PdfGeneratorService.currency(step.resultado), pw - this.M - 4, y + 5.5, { align: 'right' });

      y += 18;
    }

    return y;
  }

  private drawFooter(doc: jsPDF, pw: number, ph: number): void {
    const fy = ph - 12;

    doc.setDrawColor(210, 210, 205);
    doc.setLineWidth(0.3);
    doc.line(this.M, fy, pw - this.M, fy);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(142, 142, 160);
    doc.text('Este documento es una estimaci\u00f3n y no constituye una resoluci\u00f3n del IMSS. Verifique con la subdelegaci\u00f3n correspondiente.', this.M, fy + 4);
    doc.text('Auditex Pensiones \u2014 Calculadora Ley 73 IMSS', pw - this.M, fy + 4, { align: 'right' });
    doc.text(`P\u00e1gina ${doc.getCurrentPageInfo().pageNumber}`, pw / 2, fy + 4, { align: 'center' });
  }

  private capitalizeEstado(estado: string): string {
    const map: Record<string, string> = {
      casado: 'Casado/a',
      concubina: 'Uni\u00f3n libre',
      soltero: 'Soltero/a',
    };
    return map[estado] || estado;
  }

  private shortenRegla(regla: string): string {
    if (regla.includes('residuo 0')) {
      return '0 sem. exced. \u2192 sin incremento';
    }
    if (regla.includes('sin incremento adicional')) {
      const match = regla.match(/^(\d+)\s/);
      return `${match ? match[1] : '?'} sem. \u00f7 52, decimal < 0.25 \u2192 +0`;
    }
    if (regla.includes('0.5 a\u00f1o')) {
      const match = regla.match(/^(\d+)\s/);
      return `${match ? match[1] : '?'} sem. \u00f7 52, decimal \u2265 0.25 \u2192 +0.5`;
    }
    if (regla.includes('1 a\u00f1o completo')) {
      const match = regla.match(/^(\d+)\s/);
      return `${match ? match[1] : '?'} sem. \u00f7 52, decimal \u2265 0.5 \u2192 +1`;
    }
    return regla.length > 30 ? regla.substring(0, 28) + '\u2026' : regla;
  }
}