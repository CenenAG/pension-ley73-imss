import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { ProyeccionMensual } from '../../models/pension.model';
import { CurrencyMxnPipe } from '../../pipes/currency-mxn.pipe';

@Component({
  selector: 'app-proyeccion-anual',
  standalone: true,
  imports: [CurrencyMxnPipe],
  templateUrl: './proyeccion-anual.html',
  styleUrl: './proyeccion-anual.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProyeccionAnualComponent {
  proyeccion = input.required<ProyeccionMensual[]>();

  maxPension = computed(() => {
    const items = this.proyeccion();
    if (items.length === 0) return 1;
    return Math.max(...items.map((p) => p.pensionMensual));
  });

  minPension = computed(() => {
    const items = this.proyeccion();
    if (items.length === 0) return 0;
    return Math.min(...items.map((p) => p.pensionMensual));
  });

  maxAbsDiff = computed(() => {
    const items = this.proyeccion();
    const diffs = items
      .filter((p) => p.diffMesAnterior !== null)
      .map((p) => Math.abs(p.diffMesAnterior!));
    if (diffs.length === 0) return 1;
    return Math.max(...diffs);
  });

  barHeight(barValue: number): string {
    const max = this.maxPension();
    if (max === 0) return '0%';
    return `${(barValue / max) * 100}%`;
  }

  diffBarHeight(diff: number | null): string {
    if (diff === null) return '0%';
    const max = this.maxAbsDiff();
    if (max === 0) return '50%';
    return `${(Math.abs(diff) / max) * 100}%`;
  }

  formatDiff(diff: number | null): string {
    if (diff === null) return '—';
    const sign = diff >= 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}`;
  }

  formatDiffPct(pct: number | null): string {
    if (pct === null) return '—';
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
  }

  diffClass(diff: number | null): string {
    if (diff === null) return '';
    return diff >= 0 ? 'diff-positive' : 'diff-negative';
  }
}
