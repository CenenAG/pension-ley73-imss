import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CalculationStep } from '../../models/pension.model';
import { CurrencyMxnPipe } from '../../pipes/currency-mxn.pipe';

@Component({
  selector: 'app-calculation-breakdown',
  standalone: true,
  imports: [CurrencyMxnPipe],
  templateUrl: './calculation-breakdown.html',
  styleUrl: './calculation-breakdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculationBreakdownComponent {
  steps = input.required<CalculationStep[]>();
}