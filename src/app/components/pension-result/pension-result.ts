import { Component, input } from '@angular/core';
import { PensionResult } from '../../models/pension.model';

@Component({
  selector: 'app-pension-result',
  standalone: true,
  imports: [],
  templateUrl: './pension-result.html',
  styleUrl: './pension-result.css',
})
export class PensionResultComponent {
  result = input.required<PensionResult | null>();

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);
  }
}