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
        return { ...entry, efectivo: eff.efectivo, diasEfectivos: eff.diasEfectivos };
      }
      return { ...entry };
    });
  });

  totalDias = computed(() =>
    this.entries().reduce((sum, e) => sum + (e.dias || 0), 0)
  );

  totalSemanas = computed(() =>
    this.calculator.diasASemanas(this.totalDias())
  );

  effectiveTotalDias = computed(() => {
    let total = 0;
    for (const e of this.effectiveEntries()) {
      if (e.efectivo !== false) {
        total += e.diasEfectivos ?? e.dias;
      }
    }
    return total;
  });

  effectiveTotalSemanas = computed(() =>
    this.calculator.diasASemanas(this.effectiveTotalDias())
  );

  promedioPonderado = computed(() => {
    const { promedio } = this.calculator.calcularSalarioPromedioFromEffective(this.effectiveEntries());
    return promedio;
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
    this.entriesChange.emit(updated);
  }

  onFechaInicioChange(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const date = PensionCalculatorService.parseDateInput(value);
    const updated = [...this.entries()];
    updated[index] = { ...updated[index], fechaInicio: date };
    this.recalculateDatesWithEntries(updated, date ?? undefined);
  }

  addRow(): void {
    const updated = [...this.entries()];
    updated.unshift({
      id: this.nextId(),
      sbc: 0,
      fechaInicio: null,
      fechaFin: null,
      dias: 0,
    });
    this.nextId.update(v => v + 1);
    this.entriesChange.emit(updated);
  }

  removeRow(index: number): void {
    if (!confirm('¿Eliminar este período?')) return;
    const updated = [...this.entries()];
    updated.splice(index, 1);
    this.entriesChange.emit(updated);
  }

  private recalculateDates(fechaFinal: Date | null): void {
    this.recalculateDatesWithEntries([...this.entries()], fechaFinal ?? undefined);
  }

  private recalculateDatesWithEntries(entries: SbcEntry[], fechaFinal?: Date | null): void {
    const ff = fechaFinal ?? this.fechaFinal();
    if (!ff) {
      this.entriesChange.emit(entries);
      return;
    }

    const sorted = [...entries].sort((a, b) => {
      const dateA = a.fechaInicio?.getTime() ?? 0;
      const dateB = b.fechaInicio?.getTime() ?? 0;
      return dateB - dateA;
    });

    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        sorted[i] = { ...sorted[i], fechaFin: new Date(ff) };
      } else {
        const prevInicio = sorted[i - 1].fechaInicio;
        if (prevInicio) {
          const fin = new Date(prevInicio);
          fin.setDate(fin.getDate() - 1);
          sorted[i] = { ...sorted[i], fechaFin: fin };
        }
      }
      sorted[i] = {
        ...sorted[i],
        dias: this.calculator.calcularDiasEntreFechas(sorted[i].fechaInicio, sorted[i].fechaFin),
      };
    }

    this.entriesChange.emit(sorted);
  }

  formatDate(date: Date | null): string {
    return PensionCalculatorService.formatDateISO(date);
  }

  isEntryExcluded(entry: SbcEntry): boolean {
    return entry.efectivo === false;
  }

  isEntryPartial(entry: SbcEntry): boolean {
    return entry.efectivo !== false && entry.diasEfectivos != null && entry.diasEfectivos !== undefined && entry.diasEfectivos < (entry.dias || 0);
  }

  getDiasEfectivos(entry: SbcEntry): number | null {
    if (entry.efectivo === false) return null;
    if (entry.diasEfectivos != null && entry.diasEfectivos !== undefined) return entry.diasEfectivos;
    return entry.dias;
  }
}