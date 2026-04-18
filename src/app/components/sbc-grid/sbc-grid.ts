import { Component, input, output, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SbcEntry, Corte250Info } from '../../models/pension.model';
import { PensionCalculatorService } from '../../services/pension-calculator.service';
import { CurrencyMxnPipe } from '../../pipes/currency-mxn.pipe';

@Component({
  selector: 'app-sbc-grid',
  standalone: true,
  imports: [FormsModule, CurrencyMxnPipe],
  templateUrl: './sbc-grid.html',
  styleUrl: './sbc-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SbcGridComponent {
  entries = input.required<SbcEntry[]>();
  fechaFinal = input.required<Date | null>();
  corteInfo = input.required<Corte250Info>();
  effectiveEntries = input.required<SbcEntry[]>();
  entriesChange = output<SbcEntry[]>();
  fechaFinalChange = output<Date | null>();
  hasOverlaps = output<boolean>();

  private nextId = signal(10);
  private calculator = inject(PensionCalculatorService);

  displayEntries = computed(() => {
    const base = this.entries();
    const effective = this.effectiveEntries();
    const effectiveMap = new Map<number, SbcEntry>();
    for (const e of effective) {
      effectiveMap.set(e.id, e);
    }
    return base.map(entry => {
      const eff = effectiveMap.get(entry.id);
      if (eff) {
        return { ...entry, efectivo: eff.efectivo, semanasEfectivas: eff.semanasEfectivas };
      }
      return { ...entry };
    });
  });

  totalSemanas = computed(() =>
    this.entries().reduce((sum, e) => sum + (e.semanas || 0), 0)
  );

  effectiveTotalSemanas = computed(() => {
    let total = 0;
    for (const e of this.effectiveEntries()) {
      if (e.efectivo !== false) {
        total += e.semanasEfectivas ?? e.semanas ?? 0;
      }
    }
    return total;
  });

  entrySemanas(entry: SbcEntry): number {
    return entry.semanas || this.calculator.diasASemanas(entry.dias || 0);
  }

  entrySemanasEfectivas(entry: SbcEntry): number | null {
    if (entry.efectivo === false) return null;
    return entry.semanasEfectivas ?? entry.semanas ?? null;
  }

  promedioPonderado = computed(() => {
    const { promedio } = this.calculator.calcularSalarioPromedioFromEffective(this.effectiveEntries());
    return promedio;
  });

  overlappingIds = computed(() => {
    const entries = this.entries();
    const ids = new Set<number>();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.fechaInicio && a.fechaFin && b.fechaInicio && b.fechaFin) {
          const aStart = a.fechaInicio.getTime();
          const aEnd = a.fechaFin.getTime();
          const bStart = b.fechaInicio.getTime();
          const bEnd = b.fechaFin.getTime();
          if (aStart <= bEnd && bStart <= aEnd) {
            ids.add(a.id);
            ids.add(b.id);
          }
        }
      }
    }
    return ids;
  });

  onFechaFinalChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const date = PensionCalculatorService.parseDateInput(value);
    this.fechaFinalChange.emit(date);
    this.recalculateDates(date);
  }

  onSbcChange(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const numValue = parseFloat(value) || 0;
    const updated = [...this.entries()];
    updated[index] = { ...updated[index], sbc: numValue };
    this.emitOverlapState(updated);
    this.entriesChange.emit(updated);
  }

  onFechaInicioChange(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const date = PensionCalculatorService.parseDateInput(value);
    const updated = [...this.entries()];
    updated[index] = { ...updated[index], fechaInicio: date, fechaFinManual: undefined };
    this.recalculateDatesWithEntries(updated, date ?? undefined);
  }

  onFechaFinChange(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const date = PensionCalculatorService.parseDateInput(value);
    const updated = [...this.entries()];
    const dias = this.calculator.calcularDiasEntreFechas(updated[index].fechaInicio, date);
    updated[index] = {
      ...updated[index],
      fechaFin: date,
      fechaFinManual: true,
      dias,
      semanas: this.calculator.diasASemanas(dias),
    };
    this.emitOverlapState(updated);
    this.entriesChange.emit(updated);
  }

  private emitOverlapState(entries: SbcEntry[]): void {
    let hasOverlap = false;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.fechaInicio && a.fechaFin && b.fechaInicio && b.fechaFin) {
          if (a.fechaInicio.getTime() <= b.fechaFin.getTime() && b.fechaInicio.getTime() <= a.fechaFin.getTime()) {
            hasOverlap = true;
            break;
          }
        }
      }
      if (hasOverlap) break;
    }
    this.hasOverlaps.emit(hasOverlap);
  }

  addRow(): void {
    const updated = [...this.entries()];
    updated.unshift({
      id: this.nextId(),
      sbc: 0,
      fechaInicio: null,
      fechaFin: null,
      dias: 0,
      semanas: 0,
    });
    this.nextId.update(v => v + 1);
    this.emitOverlapState(updated);
    this.entriesChange.emit(updated);
  }

  pendingRemoveIndex = signal<number | null>(null);

  confirmRemove(index: number): void {
    this.pendingRemoveIndex.set(index);
  }

  executeRemove(): void {
    const index = this.pendingRemoveIndex();
    if (index === null) return;
    this.pendingRemoveIndex.set(null);
    const updated = [...this.entries()];
    updated.splice(index, 1);
    this.emitOverlapState(updated);
    this.entriesChange.emit(updated);
  }

  cancelRemove(): void {
    this.pendingRemoveIndex.set(null);
  }

  private recalculateDates(fechaFinal: Date | null): void {
    this.recalculateDatesWithEntries([...this.entries()], fechaFinal ?? undefined);
  }

  private recalculateDatesWithEntries(entries: SbcEntry[], fechaFinal?: Date | null): void {
    const ff = fechaFinal ?? this.fechaFinal();
    if (!ff) {
      this.entriesChange.emit(entries.map(e => ({ ...e, fechaFinManual: undefined })));
      this.emitOverlapState(entries);
      return;
    }

    const sorted = [...entries].sort((a, b) => {
      const dateA = a.fechaInicio?.getTime() ?? 0;
      const dateB = b.fechaInicio?.getTime() ?? 0;
      return dateB - dateA;
    });

    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        sorted[i] = { ...sorted[i], fechaFin: new Date(ff), fechaFinManual: undefined };
      } else {
        const prevInicio = sorted[i - 1].fechaInicio;
        if (prevInicio) {
          const fin = new Date(prevInicio);
          fin.setDate(fin.getDate() - 1);
          sorted[i] = { ...sorted[i], fechaFin: fin, fechaFinManual: undefined };
        }
      }
      sorted[i] = {
        ...sorted[i],
        dias: this.calculator.calcularDiasEntreFechas(sorted[i].fechaInicio, sorted[i].fechaFin),
      };
    }

    this.emitOverlapState(sorted);
    this.entriesChange.emit(sorted);
  }

  formatDate(date: Date | null): string {
    return PensionCalculatorService.formatDateISO(date);
  }

  isEntryExcluded(entry: SbcEntry): boolean {
    return entry.efectivo === false;
  }

  isEntryPartial(entry: SbcEntry): boolean {
    return entry.efectivo !== false && entry.semanasEfectivas != null && entry.semanasEfectivas !== undefined && entry.semanasEfectivas < (entry.semanas || 0);
  }

  isOverlapping(entry: SbcEntry): boolean {
    return this.overlappingIds().has(entry.id);
  }

  getSemanasEfectivas(entry: SbcEntry): number | null {
    if (entry.efectivo === false) return null;
    if (entry.semanasEfectivas != null && entry.semanasEfectivas !== undefined) return entry.semanasEfectivas;
    return entry.semanas ?? null;
  }
}