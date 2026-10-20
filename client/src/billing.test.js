import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMaterialDraw,
  billedMaterialDraw,
  calculateGstBreakdown,
  calculateInclusiveInvoice,
  oilQuantityConversion
} from "./billing.js";

const bottle1L = {
  kgPerPiece: 0.91,
  piecesPerBox: 12,
  kgPerBox: 10.92,
  drawPerPiece: { bottle1l: 1, sticker1l: 1, bottleCap: 1, band: 1 },
  drawPerBox: { box1l: 1 }
};

test("extracts 5% GST from a GST-inclusive amount", () => {
  const result = calculateInclusiveInvoice(234, 5);
  assert.equal(result.grossAmount, 234);
  assert.equal(result.taxableAmount.toFixed(2), "222.86");
  assert.equal(result.taxAmount.toFixed(2), "11.14");
  assert.equal(result.total, 234);
});

test("supports 0% and 18% inclusive GST rates", () => {
  assert.deepEqual(calculateInclusiveInvoice(234, 0), { grossAmount: 234, taxableAmount: 234, taxAmount: 0, roundOff: 0, total: 234 });
  const result = calculateInclusiveInvoice(234, 18);
  assert.equal(result.taxableAmount.toFixed(2), "198.31");
  assert.equal(result.taxAmount.toFixed(2), "35.69");
});

test("round off changes only the final total, not the extracted tax", () => {
  const result = calculateInclusiveInvoice(234.49, 5, true);
  assert.equal(result.total, 234);
  assert.equal(result.roundOff.toFixed(2), "-0.49");
  assert.equal((result.taxableAmount + result.taxAmount).toFixed(2), "234.49");
});

test("splits Kerala GST into equal CGST and SGST", () => {
  const result = calculateGstBreakdown("Kerala", 11.1428571429);
  assert.equal(result.taxType, "INTRASTATE");
  assert.equal(result.cgst.toFixed(2), "5.57");
  assert.equal(result.sgst.toFixed(2), "5.57");
  assert.equal(result.igst, 0);
});

test("applies full IGST outside Kerala", () => {
  const result = calculateGstBreakdown("Karnataka", 11.1428571429);
  assert.equal(result.taxType, "INTERSTATE");
  assert.equal(result.cgst, 0);
  assert.equal(result.sgst, 0);
  assert.equal(result.igst.toFixed(2), "11.14");
});

test("converts one box of 1 L bottles to 12 pieces and 10.920 kg", () => {
  assert.deepEqual(oilQuantityConversion(bottle1L, 1, "box"), { pieces: 12, kg: 10.92 });
});

test("supports piece, litre, and kilogram quantity units", () => {
  assert.deepEqual(oilQuantityConversion(bottle1L, 2, "piece"), { pieces: 2, kg: 1.82 });
  assert.deepEqual(oilQuantityConversion(bottle1L, 1, "litre"), { pieces: 1, kg: 0.91 });
  assert.deepEqual(oilQuantityConversion(bottle1L, 0.91, "kg"), { pieces: 1, kg: 0.91 });
});

test("calculates every material required for one box of 1 L bottles", () => {
  assert.deepEqual(billedMaterialDraw(bottle1L, 12, 1, 10.92), {
    oil: 10.92,
    bottle1l: 12,
    sticker1l: 12,
    bottleCap: 12,
    band: 12,
    box1l: 1
  });
});

test("billing deductions are allowed to create visible negative stock", () => {
  const result = applyMaterialDraw({}, billedMaterialDraw(bottle1L, 12, 1, 10.92));
  assert.equal(result.oil, -10.92);
  assert.equal(result.bottle1l, -12);
  assert.equal(result.sticker1l, -12);
  assert.equal(result.box1l, -1);
});

test("reversing a bill restores the exact material quantities", () => {
  const draw = billedMaterialDraw(bottle1L, 12, 1, 10.92);
  const deducted = applyMaterialDraw({ oil: 100, bottle1l: 50, sticker1l: 50, bottleCap: 50, band: 50, box1l: 10 }, draw);
  const restored = applyMaterialDraw(deducted, draw, 1);
  assert.deepEqual(restored, { oil: 100, bottle1l: 50, sticker1l: 50, bottleCap: 50, band: 50, box1l: 10 });
});
