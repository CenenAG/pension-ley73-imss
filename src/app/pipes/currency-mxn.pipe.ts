import { Pipe, PipeTransform } from '@angular/core';

const formatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

@Pipe({
  name: 'currencyMXN',
  standalone: true,
})
export class CurrencyMxnPipe implements PipeTransform {
  transform(value: number): string {
    return formatter.format(value);
  }
}