import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EstadoCivil, SMG_DEFAULT } from '../../models/pension.model';

@Component({
  selector: 'app-pension-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './pension-form.html',
  styleUrl: './pension-form.css',
})
export class PensionFormComponent {
  salarioMinimoGeneral = input(SMG_DEFAULT);
  fechaReferencia = input<Date | null>(null);
  semanasReferencia = input(0);
  semanasAdicionales = input(0);
  semanasCotizadas = input(500);
  edadRetiro = input(60);
  estadoCivil = input<EstadoCivil>('casado');
  hijosCount = input(0);
  padresCount = input(0);

  salarioMinimoGeneralChange = output<number>();
  fechaReferenciaChange = output<Date | null>();
  semanasReferenciaChange = output<number>();
  edadRetiroChange = output<number>();
  estadoCivilChange = output<EstadoCivil>();
  hijosCountChange = output<number>();
  padresCountChange = output<number>();

  estadoCivilOptions: { value: EstadoCivil; label: string }[] = [
    { value: 'casado', label: 'Casado/a' },
    { value: 'concubina', label: 'Unión libre (Concubinato)' },
    { value: 'soltero', label: 'Soltero/a' },
  ];

  edadOptions = [
    { value: 60, label: '60 años — 75% (Cesantía en edad avanzada)' },
    { value: 61, label: '61 años — 80%' },
    { value: 62, label: '62 años — 85%' },
    { value: 63, label: '63 años — 90%' },
    { value: 64, label: '64 años — 95%' },
    { value: 65, label: '65 años — 100% (Vejez)' },
  ];

  onSmgChange(value: string): void {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      this.salarioMinimoGeneralChange.emit(num);
    }
  }

  onFechaReferenciaChange(value: string): void {
    const date = value ? new Date(value + 'T00:00:00') : null;
    this.fechaReferenciaChange.emit(date);
  }

  onSemanasReferenciaChange(value: string): void {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      this.semanasReferenciaChange.emit(num);
    }
  }

  onEdadChange(value: string): void {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      this.edadRetiroChange.emit(num);
    }
  }

  onEstadoCivilChange(value: string): void {
    this.estadoCivilChange.emit(value as EstadoCivil);
  }

  onHijosChange(value: string): void {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      this.hijosCountChange.emit(num);
    }
  }

  onPadresChange(value: string): void {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      this.padresCountChange.emit(num);
    }
  }

  formatDate(date: Date | null): string {
    if (!date) return '';
    return new Date(date).toISOString().substring(0, 10);
  }
}