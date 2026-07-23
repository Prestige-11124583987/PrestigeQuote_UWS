import assert from "node:assert/strict";
import {
  normalizeDoorRowHeight,
  paginateIndivisibleRows,
  STANDARD_DOOR_ROW_HEIGHT
} from "../client/src/invoiceLayout.js";

function rows(...heights) {
  return heights.map((rowHeight, index) => ({ id: index + 1, rowHeight }));
}


assert.equal(STANDARD_DOOR_ROW_HEIGHT, 60);
assert.equal(normalizeDoorRowHeight(38), 60);
assert.equal(normalizeDoorRowHeight(58), 60);
assert.equal(normalizeDoorRowHeight(59.2), 60);
assert.equal(normalizeDoorRowHeight(60), 60);
assert.equal(normalizeDoorRowHeight(60.1), 61);
assert.equal(normalizeDoorRowHeight(96.2), 97);

const fiveOrdinary = rows(60, 60, 60, 60, 60);
let pages = paginateIndivisibleRows(fiveOrdinary);
assert.equal(pages.length, 1);
assert.deepEqual(pages[0].rows.map((row) => row.id), [1, 2, 3, 4, 5]);

const sixOrdinary = rows(60, 60, 60, 60, 60, 60);
pages = paginateIndivisibleRows(sixOrdinary);
assert.equal(pages.length, 2);
assert.deepEqual(pages[0].rows.map((row) => row.id), [1, 2, 3, 4, 5]);
assert.deepEqual(pages[1].rows.map((row) => row.id), [6]);
assert.equal(pages[1].startIndex, 5);

const verboseDoors = rows(210, 210, 120, 300, 260);
pages = paginateIndivisibleRows(verboseDoors);
assert.deepEqual(pages[0].rows.map((row) => row.id), [1]);
assert.deepEqual(pages[1].rows.map((row) => row.id), [2, 3]);
assert.deepEqual(pages[2].rows.map((row) => row.id), [4]);
assert.deepEqual(pages[3].rows.map((row) => row.id), [5]);

const oversizedDoor = rows(600, 60);
pages = paginateIndivisibleRows(oversizedDoor);
assert.equal(pages[0].rows.length, 0);
assert.deepEqual(pages[1].rows.map((row) => row.id), [1]);
assert.deepEqual(pages[2].rows.map((row) => row.id), [2]);

const flattened = pages.flatMap((page) => page.rows.map((row) => row.id));
assert.deepEqual(flattened, [1, 2]);

console.log("Invoice layout test passed.");
