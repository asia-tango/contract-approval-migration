import { Pipe, PipeTransform } from '@angular/core';
import { STATUS_LABELS } from '../messages';
import { ContractStatus } from '../models';

@Pipe({ name: 'statusLabel' })
export class StatusLabelPipe implements PipeTransform {
  transform(status: ContractStatus): string {
    return STATUS_LABELS[status];
  }
}
