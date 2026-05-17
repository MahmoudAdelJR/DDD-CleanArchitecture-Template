import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'appDateFormat'
})
export class DateFormatPipe implements PipeTransform {
  private readonly datePipe = new DatePipe('en');

  transform(value: string | Date | null | undefined, format = 'mediumDate'): string {
    if (!value) {
      return '';
    }

    return this.datePipe.transform(value, format) ?? '';
  }
}