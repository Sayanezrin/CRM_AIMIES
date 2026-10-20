export const LITRE_TO_KG = 0.91;

export function calculateInclusiveInvoice(grossAmount, taxPercent, applyRoundOff = false) {
  const gross = Math.max(0, Number(grossAmount || 0));
  const rate = Math.max(0, Number(taxPercent || 0));
  const taxableAmount = rate ? gross / (1 + rate / 100) : gross;
  const taxAmount = gross - taxableAmount;
  const roundOff = applyRoundOff ? Math.round(gross) - gross : 0;
  return { grossAmount: gross, taxableAmount, taxAmount, roundOff, total: gross + roundOff };
}

export function calculateGstBreakdown(state, taxAmount) {
  const tax = Math.max(0, Number(taxAmount || 0));
  if (String(state || "").trim().toLowerCase() === "kerala") {
    return { taxType: "INTRASTATE", cgst: tax / 2, sgst: tax / 2, igst: 0 };
  }
  return { taxType: "INTERSTATE", cgst: 0, sgst: 0, igst: tax };
}

export function oilQuantityConversion(pack, quantity, unit) {
  const numericQuantity = Math.max(0, Number(quantity || 0));
  if (!pack) return { pieces: 0, kg: unit === "litre" ? numericQuantity * LITRE_TO_KG : unit === "kg" ? numericQuantity : 0 };
  if (unit === "box") return { pieces: numericQuantity * pack.piecesPerBox, kg: numericQuantity * pack.kgPerBox };
  if (unit === "litre") return { pieces: numericQuantity * LITRE_TO_KG / pack.kgPerPiece, kg: numericQuantity * LITRE_TO_KG };
  if (unit === "kg") return { pieces: numericQuantity / pack.kgPerPiece, kg: numericQuantity };
  return { pieces: numericQuantity, kg: numericQuantity * pack.kgPerPiece };
}

export function billedMaterialDraw(pack, quantityPieces, quantityBoxes, quantityKg) {
  const draw = { oil: Number(quantityKg || 0) };
  if (!pack) return draw;
  for (const [materialId, amount] of Object.entries(pack.drawPerPiece || {})) {
    draw[materialId] = Number(draw[materialId] || 0) + amount * Number(quantityPieces || 0);
  }
  for (const [materialId, amount] of Object.entries(pack.drawPerBox || {})) {
    draw[materialId] = Number(draw[materialId] || 0) + amount * Number(quantityBoxes || 0);
  }
  return draw;
}

export function applyMaterialDraw(levels, draw, direction = -1) {
  const next = { ...(levels || {}) };
  for (const [materialId, amount] of Object.entries(draw || {})) {
    next[materialId] = Number(next[materialId] || 0) + direction * Number(amount || 0);
  }
  return next;
}
