type InvoiceLineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

type InvoiceData = {
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  client_phone: string | null;
  deal_number: string | null;
  line_items: InvoiceLineItem[];
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NZD: "NZ$",
  CNY: "\u00A5",
  THB: "\u0E3F",
};

const BANK_INFO: Record<string, string> = {
  NZD: `<strong>Bank:</strong> ANZ Bank New Zealand<br>
<strong>Account Name:</strong> PJ Immigration Limited<br>
<strong>Account Number:</strong> 06-0158-0810537-00<br>
<strong>Swift Code:</strong> ANZBNZ22`,
  CNY: `<strong>Bank:</strong> ANZ Bank New Zealand<br>
<strong>Account Name:</strong> PJ Immigration Limited<br>
<strong>Account Number:</strong> 06-0158-0810537-00<br>
<strong>Swift Code:</strong> ANZBNZ22<br>
<em>Please include your invoice number as payment reference</em>`,
  THB: `<strong>Bank:</strong> ANZ Bank New Zealand<br>
<strong>Account Name:</strong> PJ Immigration Limited<br>
<strong>Account Number:</strong> 06-0158-0810537-00<br>
<strong>Swift Code:</strong> ANZBNZ22<br>
<em>Please include your invoice number as payment reference</em>`,
};

export function buildInvoiceHtml(data: InvoiceData): string {
  const sym = CURRENCY_SYMBOLS[data.currency] ?? "$";
  const fmt = (n: number) => sym + n.toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const bankInfo = BANK_INFO[data.currency] ?? BANK_INFO.NZD;

  const lineItemsHtml = data.line_items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(item.unit_price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(item.amount)}</td>
    </tr>
  `).join("");

  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:800px;margin:0 auto;color:#1e293b;">
  <!-- Header -->
  <div style="background:#1e3a5f;color:white;padding:30px 40px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h1 style="margin:0;font-size:28px;font-weight:700;">INVOICE</h1>
      <p style="margin:4px 0 0;font-size:14px;opacity:0.8;">${data.invoice_number}</p>
    </div>
    <div style="text-align:right;font-size:13px;line-height:1.6;">
      <strong>PJ Immigration Limited</strong><br>
      Level 2, 109 Queen Street<br>
      Auckland CBD, New Zealand<br>
      info@pjimmigration.co.nz
    </div>
  </div>

  <div style="padding:30px 40px;">
    <!-- Invoice meta + client -->
    <div style="display:flex;justify-content:space-between;margin-bottom:30px;">
      <div>
        <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Bill To</p>
        <p style="margin:0;font-size:15px;font-weight:600;">${data.client_name}</p>
        ${data.client_email ? `<p style="margin:2px 0 0;font-size:13px;color:#64748b;">${data.client_email}</p>` : ""}
        ${data.client_address ? `<p style="margin:2px 0 0;font-size:13px;color:#64748b;">${data.client_address}</p>` : ""}
        ${data.client_phone ? `<p style="margin:2px 0 0;font-size:13px;color:#64748b;">${data.client_phone}</p>` : ""}
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:13px;"><strong>Issue Date:</strong> ${data.issue_date}</p>
        ${data.due_date ? `<p style="margin:4px 0 0;font-size:13px;"><strong>Due Date:</strong> ${data.due_date}</p>` : ""}
        <p style="margin:4px 0 0;font-size:13px;"><strong>Currency:</strong> ${data.currency}</p>
        ${data.deal_number ? `<p style="margin:4px 0 0;font-size:13px;"><strong>Reference:</strong> ${data.deal_number}</p>` : ""}
      </div>
    </div>

    <!-- Line items table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #cbd5e1;">Description</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #cbd5e1;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #cbd5e1;">Unit Price</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #cbd5e1;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:30px;">
      <div style="width:250px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
          <span>Subtotal</span><span>${fmt(data.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
          <span>GST (15%)</span><span>${fmt(data.gst_amount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:700;border-top:2px solid #1e3a5f;margin-top:4px;">
          <span>Total</span><span>${fmt(data.total)}</span>
        </div>
      </div>
    </div>

    <!-- Bank details -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1e3a5f;">Payment Details</p>
      <p style="margin:0;font-size:13px;line-height:1.8;color:#475569;">${bankInfo}</p>
    </div>

    ${data.notes ? `
    <div style="margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1e3a5f;">Notes</p>
      <p style="margin:0;font-size:13px;color:#64748b;">${data.notes}</p>
    </div>
    ` : ""}

    <!-- Footer -->
    <div style="border-top:1px solid #e2e8f0;padding-top:16px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">Thank you for choosing PJ Immigration Limited</p>
    </div>
  </div>
</div>`;
}
