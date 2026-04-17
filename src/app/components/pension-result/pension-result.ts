import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { PensionResult } from '../../models/pension.model';
import { CurrencyMxnPipe } from '../../pipes/currency-mxn.pipe';

@Component({
  selector: 'app-pension-result',
  standalone: true,
  imports: [CurrencyMxnPipe],
  templateUrl: './pension-result.html',
  styleUrl: './pension-result.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PensionResultComponent {
  result = input.required<PensionResult | null>();
}