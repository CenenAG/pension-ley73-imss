import { Component, input } from '@angular/core';
import { CalculationStep } from '../../models/pension.model';

@Component({
  selector: 'app-calculation-breakdown',
  standalone: true,
  imports: [],
  templateUrl: './calculation-breakdown.html',
  styleUrl: './calculation-breakdown.css',
})
export class CalculationBreakdownComponent {
  steps = input.required<CalculationStep[]>();

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);
  }
}