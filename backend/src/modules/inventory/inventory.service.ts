import { query, exec, Row } from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { round2 } from '../../utils/money';

interface Movement extends Row {
  entry_type: 'IN' | 'OUT'; quantity: number; rate: number; entry_date: string;
}

/**
 * Stock valuation engine. Movements are replayed in (entry_date, id) order:
 *  - FIFO keeps cost layers and consumes the oldest first.
 *  - Weighted Average keeps a running average cost re-computed on every IN.
 */
export function valueStock(movements: Movement[]) {
  // ---- FIFO ----
  const layers: { qty: number; rate: number }[] = [];
  // ---- Weighted average ----
  let waQty = 0, waValue = 0;

  for (const m of movements) {
    const qty = Number(m.quantity), rate = Number(m.rate);
    if (m.entry_type === 'IN') {
      layers.push({ qty, rate });
      waValue += qty * rate;
      waQty += qty;
    } else {
      // FIFO consume
      let remaining = qty;
      while (remaining > 0 && layers.length) {
        const layer = layers[0];
        const take = Math.min(layer.qty, remaining);
        layer.qty -= take;
        remaining -= take;
        if (layer.qty <= 0) layers.shift();
      }
      // Weighted average consume at current average cost
      const avg = waQty > 0 ? waValue / waQty : 0;
      waValue -= qty * avg;
      waQty -= qty;
      if (waQty < 0) { waQty = 0; waValue = 0; }
    }
  }
  const fifoQty = layers.reduce((s, l) => s + l.qty, 0);
  const fifoValue = layers.reduce((s, l) => s + l.qty * l.rate, 0);
  return {
    quantity: round2(fifoQty),
    fifo: { value: round2(fifoValue), layers: layers.map(l => ({ qty: round2(l.qty), rate: l.rate })) },
    weightedAverage: {
      value: round2(waValue),
      avgRate: waQty > 0 ? round2(waValue / waQty) : 0
    }
  };
}

export const inventoryService = {
  listItems: (companyId: number) =>
    query<Row[]>(
      `SELECT i.*, COALESCE(SUM(CASE WHEN se.entry_type='IN' THEN se.quantity ELSE -se.quantity END),0) AS stock_qty
         FROM items i LEFT JOIN stock_entries se ON se.item_id = i.id
        WHERE i.company_id = ?
        GROUP BY i.id ORDER BY i.name`, [companyId]),

  async createItem(companyId: number, input: {
    sku: string; name: string; category?: string; unit: string;
    purchasePrice: number; salePrice: number; reorderLevel: number;
  }) {
    const result = await exec(
      `INSERT INTO items (company_id, sku, name, category, unit, purchase_price, sale_price, reorder_level)
       VALUES (?,?,?,?,?,?,?,?)`,
      [companyId, input.sku, input.name, input.category ?? null, input.unit,
       input.purchasePrice, input.salePrice, input.reorderLevel]);
    return result.insertId;
  },

  listWarehouses: (companyId: number) =>
    query<Row[]>('SELECT * FROM warehouses WHERE company_id = ? ORDER BY name', [companyId]),

  async recordMovement(companyId: number, input: {
    itemId: number; warehouseId: number; type: 'IN' | 'OUT';
    quantity: number; rate: number; date: string; note?: string;
  }) {
    if (input.type === 'OUT') {
      const rows = await query<Row[]>(
        `SELECT COALESCE(SUM(CASE WHEN entry_type='IN' THEN quantity ELSE -quantity END),0) AS qty
           FROM stock_entries WHERE company_id = ? AND item_id = ?`, [companyId, input.itemId]);
      if (Number(rows[0].qty) < input.quantity)
        throw ApiError.badRequest(`Insufficient stock: only ${rows[0].qty} available`);
    }
    const result = await exec(
      `INSERT INTO stock_entries (company_id, item_id, warehouse_id, entry_type, quantity, rate, entry_date, note)
       VALUES (?,?,?,?,?,?,?,?)`,
      [companyId, input.itemId, input.warehouseId, input.type,
       input.quantity, input.rate, input.date, input.note ?? null]);
    return result.insertId;
  },

  movements: (companyId: number, itemId?: number) => {
    const where = itemId ? 'se.company_id = ? AND se.item_id = ?' : 'se.company_id = ?';
    const params = itemId ? [companyId, itemId] : [companyId];
    return query<Row[]>(
      `SELECT se.*, i.name AS item_name, i.sku, w.name AS warehouse_name
         FROM stock_entries se
         JOIN items i ON i.id = se.item_id
         JOIN warehouses w ON w.id = se.warehouse_id
        WHERE ${where} ORDER BY se.entry_date DESC, se.id DESC LIMIT 200`, params);
  },

  /** GET valuation for one item under both methods. */
  async valuation(companyId: number, itemId: number) {
    const movements = await query<Movement[]>(
      `SELECT entry_type, quantity, rate, entry_date FROM stock_entries
        WHERE company_id = ? AND item_id = ? ORDER BY entry_date, id`, [companyId, itemId]);
    return valueStock(movements);
  },

  /** Stock report across all items (both valuation methods per item). */
  async stockReport(companyId: number) {
    const items = await query<Row[]>('SELECT id, sku, name, unit, reorder_level FROM items WHERE company_id = ?', [companyId]);
    const report = [];
    for (const item of items) {
      const v = await this.valuation(companyId, Number(item.id));
      report.push({
        item_id: item.id, sku: item.sku, name: item.name, unit: item.unit,
        quantity: v.quantity, fifo_value: v.fifo.value,
        weighted_avg_value: v.weightedAverage.value, avg_rate: v.weightedAverage.avgRate,
        low_stock: v.quantity <= Number(item.reorder_level)
      });
    }
    return report;
  }
};
