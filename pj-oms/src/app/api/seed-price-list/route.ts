import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PRICE_DATA = [
  // Student Visa
  { category: "Student Visa", service_name: "Student Visa (Onshore)", service_fee: 1500, inz_fee: 395, inz_fee_note: null, currency: "NZD", display_order: 1 },
  { category: "Student Visa", service_name: "Student Visa (Offshore)", service_fee: 1500, inz_fee: 395, inz_fee_note: null, currency: "NZD", display_order: 2 },
  { category: "Student Visa", service_name: "Student Visa Variation of Conditions", service_fee: 500, inz_fee: 295, inz_fee_note: null, currency: "NZD", display_order: 3 },
  { category: "Student Visa", service_name: "Student Visa Transfer School", service_fee: 500, inz_fee: 0, inz_fee_note: null, currency: "NZD", display_order: 4 },
  // AEWV
  { category: "AEWV", service_name: "AEWV (Accredited Employer Work Visa)", service_fee: 2500, inz_fee: 750, inz_fee_note: null, currency: "NZD", display_order: 10 },
  { category: "AEWV", service_name: "AEWV Job Check", service_fee: 1000, inz_fee: 610, inz_fee_note: null, currency: "NZD", display_order: 11 },
  { category: "AEWV", service_name: "Accreditation (Standard)", service_fee: 1500, inz_fee: 740, inz_fee_note: null, currency: "NZD", display_order: 12 },
  { category: "AEWV", service_name: "Accreditation (High Volume)", service_fee: 2000, inz_fee: 1220, inz_fee_note: null, currency: "NZD", display_order: 13 },
  { category: "AEWV", service_name: "Accreditation (Triangular)", service_fee: 2000, inz_fee: 3420, inz_fee_note: null, currency: "NZD", display_order: 14 },
  { category: "AEWV", service_name: "Accreditation (Franchise)", service_fee: 2000, inz_fee: 4100, inz_fee_note: null, currency: "NZD", display_order: 15 },
  // Work Visa
  { category: "Work Visa", service_name: "Essential Skills Work Visa", service_fee: 2500, inz_fee: 750, inz_fee_note: null, currency: "NZD", display_order: 20 },
  { category: "Work Visa", service_name: "Work Visa (Other)", service_fee: 2000, inz_fee: 750, inz_fee_note: null, currency: "NZD", display_order: 21 },
  { category: "Work Visa", service_name: "Post Study Work Visa (Open)", service_fee: 1500, inz_fee: 700, inz_fee_note: null, currency: "NZD", display_order: 22 },
  { category: "Work Visa", service_name: "Post Study Work Visa (Employer)", service_fee: 1500, inz_fee: 700, inz_fee_note: null, currency: "NZD", display_order: 23 },
  { category: "Work Visa", service_name: "Working Holiday Visa", service_fee: 500, inz_fee: 455, inz_fee_note: null, currency: "NZD", display_order: 24 },
  // Visitor Visa
  { category: "Visitor Visa", service_name: "Visitor Visa (Onshore)", service_fee: 800, inz_fee: 295, inz_fee_note: null, currency: "NZD", display_order: 30 },
  { category: "Visitor Visa", service_name: "Visitor Visa (Offshore)", service_fee: 800, inz_fee: 295, inz_fee_note: null, currency: "NZD", display_order: 31 },
  { category: "Visitor Visa", service_name: "Visitor Visa (Guardian)", service_fee: 800, inz_fee: 295, inz_fee_note: null, currency: "NZD", display_order: 32 },
  // Partnership
  { category: "Partnership", service_name: "Partnership Work Visa", service_fee: 3000, inz_fee: 750, inz_fee_note: null, currency: "NZD", display_order: 40 },
  { category: "Partnership", service_name: "Partnership Visitor Visa", service_fee: 2000, inz_fee: 295, inz_fee_note: null, currency: "NZD", display_order: 41 },
  // Residence
  { category: "Residence", service_name: "Skilled Migrant Category (SMC)", service_fee: 5000, inz_fee: 4290, inz_fee_note: null, currency: "NZD", display_order: 50 },
  { category: "Residence", service_name: "Residence from Work", service_fee: 4000, inz_fee: 4290, inz_fee_note: null, currency: "NZD", display_order: 51 },
  { category: "Residence", service_name: "Parent Retirement Residence", service_fee: 5000, inz_fee: 4290, inz_fee_note: null, currency: "NZD", display_order: 52 },
  { category: "Residence", service_name: "Partner of NZ Citizen/Resident", service_fee: 4000, inz_fee: 2050, inz_fee_note: null, currency: "NZD", display_order: 53 },
  // Other
  { category: "Other", service_name: "Reconsideration / Appeal", service_fee: 2000, inz_fee: 0, inz_fee_note: "Varies", currency: "NZD", display_order: 60 },
  { category: "Other", service_name: "Section 61 Request", service_fee: 1500, inz_fee: 0, inz_fee_note: null, currency: "NZD", display_order: 61 },
  { category: "Other", service_name: "eVisa (ETA/NZeTA)", service_fee: 300, inz_fee: 23, inz_fee_note: null, currency: "NZD", display_order: 62 },
  { category: "Other", service_name: "Visa Consultation (30 min)", service_fee: 150, inz_fee: 0, inz_fee_note: null, currency: "NZD", display_order: 63 },
  { category: "Other", service_name: "Visa Consultation (60 min)", service_fee: 250, inz_fee: 0, inz_fee_note: null, currency: "NZD", display_order: 64 },
  { category: "Other", service_name: "Education Consultation", service_fee: 500, inz_fee: 0, inz_fee_note: null, currency: "NZD", display_order: 65 },
];

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const rows = PRICE_DATA.map(p => ({
    ...p,
    is_active: true,
  }));

  const { error } = await supabase.from("service_price_list").upsert(rows, {
    onConflict: "category,service_name",
    ignoreDuplicates: false,
  });

  if (error) {
    // Fallback: insert individually if upsert fails (no unique constraint)
    for (const row of rows) {
      // Check if exists
      const { data: existing } = await supabase
        .from("service_price_list")
        .select("id")
        .eq("category", row.category)
        .eq("service_name", row.service_name)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase.from("service_price_list").update(row).eq("id", existing[0].id);
      } else {
        await supabase.from("service_price_list").insert(row);
      }
    }
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
