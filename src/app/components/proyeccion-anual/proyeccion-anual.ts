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

  barHeight(barValue: number): string {
    const max = this.maxPension();
    if (max === 0) return '0%';
    return `${(barValue / max) * 100}%`;
  }
}
