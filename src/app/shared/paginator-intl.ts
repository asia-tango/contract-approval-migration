import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Підписи пагінатора українською; діапазон — як у легасі: «1 / 2». */
@Injectable()
export class UkPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Рядків на сторінці:';
  override nextPageLabel = 'Наступна сторінка';
  override previousPageLabel = 'Попередня сторінка';
  override firstPageLabel = 'Перша сторінка';
  override lastPageLabel = 'Остання сторінка';

  override getRangeLabel = (page: number, pageSize: number, length: number): string =>
    `${page + 1} / ${Math.max(1, Math.ceil(length / pageSize))}`;
}
