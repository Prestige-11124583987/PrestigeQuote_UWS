export const STANDARD_DOOR_ROW_HEIGHT = 60;

export function normalizeDoorRowHeight(
  contentHeight,
  { standardHeight = STANDARD_DOOR_ROW_HEIGHT } = {}
) {
  const measuredHeight = Math.max(0, Number(contentHeight || 0));
  const minimumHeight = Math.max(0, Number(standardHeight || 0));
  return Math.max(minimumHeight, Math.ceil(measuredHeight));
}

export function paginateIndivisibleRows(
  rows,
  {
    firstPageCapacity = 390,
    continuationCapacity = 556,
    maxFirstPageRows = 5
  } = {}
) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const pages = [];
  let cursor = 0;

  const firstRows = [];
  let firstHeight = 0;
  while (cursor < sourceRows.length && firstRows.length < maxFirstPageRows) {
    const row = sourceRows[cursor];
    const rowHeight = Math.max(0, Number(row?.rowHeight || 0));
    if (firstHeight + rowHeight > firstPageCapacity) break;
    firstRows.push(row);
    firstHeight += rowHeight;
    cursor += 1;
  }
  pages.push({ rows: firstRows, startIndex: 0, firstPage: true });

  while (cursor < sourceRows.length) {
    const pageRows = [];
    let pageHeight = 0;
    const startIndex = cursor;

    while (cursor < sourceRows.length) {
      const row = sourceRows[cursor];
      const rowHeight = Math.max(0, Number(row?.rowHeight || 0));
      if (pageRows.length && pageHeight + rowHeight > continuationCapacity) break;

      // An unusually detailed single door still gets its own intact page.
      // It is never divided between two pages.
      pageRows.push(row);
      pageHeight += rowHeight;
      cursor += 1;

      if (pageHeight >= continuationCapacity) break;
    }

    pages.push({ rows: pageRows, startIndex, firstPage: false });
  }

  return pages;
}
