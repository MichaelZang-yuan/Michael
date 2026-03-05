// Intake Form Templates Seed Data
// Call insertIntakeTemplates() via /api/seed-intake-templates (admin only)

export type MultiLang = { en: string; zh?: string; th?: string };

export type TemplateField = {
  id: string;
  type: string;
  label: MultiLang;
  required?: boolean;
  placeholder?: MultiLang;
  helpText?: MultiLang;
  options?: { value: string; label: MultiLang }[];
  condition?: { field: string; operator?: "eq" | "neq" | "in"; value: string | string[] };
  subfields?: string[];
  content?: MultiLang;
};

export type TemplateSection = {
  id: string;
  title: MultiLang;
  description?: MultiLang;
  fields: TemplateField[];
};

export type TemplateData = { sections: TemplateSection[] };

// ─── Shared sections ─────────────────────────────────────────────────────────

const GENERAL_INFO_SECTION: TemplateSection = {
  id: "general_info",
  title: { en: "General Information", zh: "基本信息", th: "ข้อมูลทั่วไป" },
  fields: [
    { id: "date_entered", type: "date", label: { en: "Date of filling this form", zh: "填写日期", th: "วันที่กรอกข้อมูล" }, required: true },
    { id: "visa_type", type: "radio", label: { en: "What visa are you applying for?", zh: "您申请的签证类型是？", th: "คุณกำลังยื่นขอวีซ่าประเภทใด" }, required: true, options: [{ value: "aewv_rv", label: { en: "Accredited Employer Work Visa (AEWV) / Resident Visa", zh: "雇主认证工签 (AEWV) / 居民签证", th: "วีซ่าทำงาน (AEWV) / วีซ่าถิ่นที่อยู่" } }, { value: "others", label: { en: "Others", zh: "其他", th: "อื่นๆ" } }] },
    { id: "visa_type_other", type: "text", label: { en: "Please specify visa type", zh: "请说明签证类型", th: "กรุณาระบุประเภทวีซ่า" }, condition: { field: "visa_type", value: "others" } },
    { id: "full_name", type: "name", label: { en: "Full Name (as shown on passport)", zh: "姓名（与护照一致）", th: "ชื่อ-นามสกุล (ตามหนังสือเดินทาง)" }, required: true, subfields: ["first_name", "middle_name", "last_name"] },
    { id: "email", type: "email", label: { en: "Email", zh: "电子邮箱", th: "อีเมล" }, required: true },
    { id: "contact_number", type: "phone", label: { en: "Contact Number", zh: "联系电话", th: "เบอร์โทรศัพท์ติดต่อ" }, required: true },
    { id: "dob", type: "date", label: { en: "Date of Birth", zh: "出生日期", th: "วันเดือนปีเกิด" }, required: true },
    { id: "used_name", type: "radio", label: { en: "Have you used any other names?", zh: "是否曾用其他名字？", th: "คุณเคยใช้ชื่ออื่นหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "used_name_details", type: "text", label: { en: "What other names have you used? (Full name)", zh: "请提供曾用全名", th: "กรุณาระบุชื่ออื่นที่เคยใช้ (ชื่อเต็ม)" }, condition: { field: "used_name", value: "yes" }, required: true },
    { id: "used_name_type", type: "select", label: { en: "What type is your other name?", zh: "曾用名类型", th: "ชื่อที่เคยใช้เป็นประเภทใด" }, condition: { field: "used_name", value: "yes" }, options: [{ value: "maiden", label: { en: "Maiden name", zh: "婚前姓", th: "นามสกุลเดิม" } }, { value: "previous_marriage", label: { en: "Previous marriage name", zh: "前婚姓名", th: "นามสกุลจากการสมรสก่อนหน้า" } }, { value: "alias", label: { en: "Alias", zh: "别名", th: "ชื่อเล่น" } }, { value: "other", label: { en: "Other", zh: "其他", th: "อื่นๆ" } }] },
    { id: "gender", type: "radio", label: { en: "Gender", zh: "性别", th: "เพศ" }, required: true, options: [{ value: "male", label: { en: "Male", zh: "男", th: "ชาย" } }, { value: "female", label: { en: "Female", zh: "女", th: "หญิง" } }] },
    { id: "marital_status", type: "select", label: { en: "Marital Status", zh: "婚姻状况", th: "สถานะภาพสมรส" }, required: true, options: [{ value: "single", label: { en: "Single/Never Married", zh: "未婚", th: "โสด" } }, { value: "married", label: { en: "Married", zh: "已婚", th: "แต่งงาน" } }, { value: "de_facto", label: { en: "De Facto / Partner", zh: "事实伴侣", th: "คู่ครอง" } }, { value: "separated", label: { en: "Separated", zh: "分居", th: "แยกกันอยู่" } }, { value: "divorced", label: { en: "Divorced", zh: "离异", th: "หย่าร้าง" } }, { value: "widowed", label: { en: "Widowed", zh: "丧偶", th: "หม้าย" } }] },
    { id: "nationality", type: "text", label: { en: "Nationality", zh: "国籍", th: "สัญชาติ" }, required: true },
    { id: "other_nationalities", type: "radio", label: { en: "Do you hold any other nationalities?", zh: "是否持有其他国籍？", th: "คุณถือสัญชาติอื่นอีกหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "other_nationalities_details", type: "text", label: { en: "Please specify other nationalities", zh: "请说明其他国籍", th: "กรุณาระบุสัญชาติอื่น" }, condition: { field: "other_nationalities", value: "yes" } },
    { id: "national_id", type: "text", label: { en: "National ID Number", zh: "身份证号码", th: "เลขประจำตัวประชาชน" }, required: true },
    { id: "outside_nz", type: "radio", label: { en: "Are you currently outside New Zealand?", zh: "您目前是否在新西兰境外？", th: "คุณอยู่นอกประเทศนิวซีแลนด์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "current_visa", type: "radio", label: { en: "Do you have a current visa?", zh: "您是否持有当前有效签证？", th: "คุณมีวีซ่าที่ยังไม่หมดอายุอยู่หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "country_when_applying", type: "text", label: { en: "In which country will you be when applying for the visa?", zh: "申请签证时您将在哪个国家？", th: "คุณจะอยู่ในประเทศใดขณะยื่นขอวีซ่า？" }, required: true },
    { id: "current_residence_country", type: "text", label: { en: "Which country are you currently living in?", zh: "您目前居住在哪个国家？", th: "คุณกำลังอาศัยอยู่ในประเทศใด？" }, required: true },
    { id: "overseas_address", type: "textarea", label: { en: "Overseas residential address (if applicable)", zh: "海外居住地址（如适用）", th: "ที่อยู่ต่างประเทศ (ถ้ามี)" } },
    { id: "previous_nz_visa", type: "radio", label: { en: "Have you ever applied for a New Zealand visa?", zh: "是否曾申请过新西兰签证？", th: "คุณเคยยื่นขอวีซ่านิวซีแลนด์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "inz_client_number", type: "text", label: { en: "INZ Client Number", zh: "INZ客户号", th: "หมายเลขลูกค้า INZ" }, condition: { field: "previous_nz_visa", value: "yes" } },
    { id: "bring_family", type: "radio", label: { en: "Do you intend to bring or sponsor your spouse and/or children?", zh: "是否计划携带或担保配偶和/或子女？", th: "คุณต้องการพาหรือสปอนเซอร์คู่สมรสและ/หรือบุตรหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "passport_number", type: "text", label: { en: "Passport Number", zh: "护照号码", th: "หมายเลขหนังสือเดินทาง" }, required: true },
    { id: "passport_issue_country", type: "text", label: { en: "Passport Issue Country", zh: "护照签发国", th: "ประเทศที่ออกหนังสือเดินทาง" }, required: true },
    { id: "passport_issue_date", type: "date", label: { en: "Passport Issue Date", zh: "护照签发日期", th: "วันที่ออกหนังสือเดินทาง" }, required: true },
    { id: "passport_expiry_date", type: "date", label: { en: "Passport Expiry Date", zh: "护照到期日期", th: "วันหมดอายุหนังสือเดินทาง" }, required: true },
    { id: "nz_address", type: "textarea", label: { en: "Current New Zealand address (if applicable)", zh: "新西兰地址（如适用）", th: "ที่อยู่ในนิวซีแลนด์ (ถ้ามี)" } },
    { id: "countries_visited", type: "textarea", label: { en: "Countries visited or lived in for more than 3 months in the last 5 years", zh: "过去5年内居住或访问超过3个月的国家", th: "ประเทศที่เคยไปหรืออาศัยอยู่มากกว่า 3 เดือนในช่วง 5 ปีที่ผ่านมา" }, required: true },
  ],
};

const HEALTH_INFO_SECTION: TemplateSection = {
  id: "health_info",
  title: { en: "Health Information", zh: "健康信息", th: "ข้อมูลสุขภาพ" },
  fields: [
    { id: "previous_medical_cert", type: "radio", label: { en: "Have you previously provided a General Medical Certificate (INZ 1007) or Limited Medical Certificate (INZ 1201)?", zh: "是否曾提供过体检证明 (INZ 1007) 或有限体检证明 (INZ 1201)?", th: "คุณเคยยื่นใบรับรองแพทย์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "medical_cert_36months", type: "radio", label: { en: "Was your medical certificate issued in the last 36 months?", zh: "体检证明是否在过去36个月内签发？", th: "ใบรับรองแพทย์ออกภายใน 36 เดือนที่ผ่านมาหรือไม่？" }, condition: { field: "previous_medical_cert", value: "yes" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "health_deteriorated", type: "radio", label: { en: "Did your health deteriorate after this medical examination?", zh: "体检后健康状况是否恶化？", th: "สุขภาพแย่ลงหลังตรวจร่างกายหรือไม่？" }, condition: { field: "previous_medical_cert", value: "yes" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "previous_xray", type: "radio", label: { en: "Have you ever submitted a chest X-ray to Immigration?", zh: "是否曾提交过胸部X光片？", th: "เคยยื่นภาพเอ็กซ์เรย์ทรวงอกให้สำนักงานตรวจคนเข้าเมืองหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "xray_36months", type: "radio", label: { en: "Was your chest X-ray taken within the last 36 months?", zh: "胸部X光是否在过去36个月内拍摄？", th: "เอ็กซ์เรย์ถ่ายภายใน 36 เดือนหรือไม่？" }, condition: { field: "previous_xray", value: "yes" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "is_pregnant", type: "radio", label: { en: "Are you pregnant?", zh: "是否怀孕？", th: "คุณตั้งครรภ์หรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }, { value: "na", label: { en: "N/A", zh: "不适用", th: "ไม่เกี่ยวข้อง" } }] },
    { id: "due_date", type: "date", label: { en: "Due date", zh: "预产期", th: "วันกำหนดคลอด" }, condition: { field: "is_pregnant", value: "yes" } },
    { id: "has_tb", type: "radio", label: { en: "Do you have tuberculosis (TB)?", zh: "是否患有肺结核？", th: "คุณเป็นวัณโรคหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "renal_dialysis", type: "radio", label: { en: "Do you require renal dialysis?", zh: "是否需要肾透析？", th: "คุณต้องการการฟอกไตหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "hospital_care", type: "radio", label: { en: "Do you require hospital care?", zh: "是否需要住院治疗？", th: "คุณต้องการการรักษาในโรงพยาบาลหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "residential_care", type: "radio", label: { en: "Do you require residential care?", zh: "是否需要住院护理？", th: "คุณต้องการการดูแลในสถานดูแลหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "health_details", type: "textarea", label: { en: "If you answered Yes to any health question, please provide details", zh: "如以上健康问题有【是】，请提供详情", th: "หากตอบ ใช่ ในข้อใด กรุณาให้รายละเอียด" } },
  ],
};

const CHARACTER_INFO_SECTION: TemplateSection = {
  id: "character_info",
  title: { en: "Character Information", zh: "品格信息", th: "ข้อมูลเกี่ยวกับประวัติอาชญากรรม" },
  fields: [
    { id: "convicted", type: "radio", label: { en: "Have you ever been convicted of any offence, including driving offences?", zh: "是否曾被定罪（包括驾驶违规）？", th: "คุณเคยถูกตัดสินว่ามีความผิดหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "under_investigation", type: "radio", label: { en: "Are you currently under investigation, wanted for questioning, or facing charges?", zh: "是否正在接受调查、被通缉或面临指控？", th: "คุณกำลังถูกสอบสวนหรือถูกตั้งข้อหาอยู่หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "deported", type: "radio", label: { en: "Have you ever been expelled, deported, excluded, removed from or refused entry to any country?", zh: "是否曾被任何国家驱逐、遣返、拒绝入境？", th: "คุณเคยถูกเนรเทศหรือถูกปฏิเสธไม่ให้เข้าประเทศใดหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "terrorist_support", type: "radio", label: { en: "Have you ever supported or belonged to a terrorist group, or promoted racial superiority/inferiority?", zh: "是否曾支持或加入恐怖组织，或宣扬种族优越/低劣？", th: "คุณเคยสนับสนุนกลุ่มก่อการร้ายหรือส่งเสริมความเหนือกว่าทางเชื้อชาติหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "mental_disorder", type: "radio", label: { en: "Do you have a mental disorder that may pose a threat to public safety?", zh: "是否有可能威胁公共安全的精神疾病？", th: "คุณมีความผิดปกติทางจิตที่อาจเป็นภัยคุกคามหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "overstay", type: "radio", label: { en: "Have you ever overstayed a visa in any country?", zh: "是否曾在任何国家逾期停留？", th: "คุณเคยอยู่เกินวีซ่าในประเทศใดหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "false_info", type: "radio", label: { en: "Have you ever provided false or misleading information in a previous application?", zh: "是否曾在之前的申请中提供虚假或误导性信息？", th: "คุณเคยให้ข้อมูลเท็จในคำร้องก่อนหน้านี้หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "character_details", type: "textarea", label: { en: "If you answered Yes to any above, please provide details", zh: "如以上任何问题回答了【是】，请提供详情", th: "หากตอบว่า เคย/ใช่ ในข้อใดข้างต้น กรุณาให้รายละเอียด" } },
  ],
};

const ACKNOWLEDGEMENT_SECTION: TemplateSection = {
  id: "acknowledgement",
  title: { en: "Acknowledgement", zh: "确认声明", th: "การรับทราบเงื่อนไขและข้อกำหนด" },
  fields: [
    { id: "terms_accepted", type: "checkbox", label: { en: "I confirm that all information provided is true and correct to the best of my knowledge.", zh: "我确认所提供的所有信息均真实准确。", th: "ข้าพเจ้าขอยืนยันว่าข้อมูลทั้งหมดที่ให้ไว้เป็นจริงและถูกต้อง" }, required: true },
    { id: "signature", type: "signature", label: { en: "Signature", zh: "签名", th: "ลายเซ็น" }, required: true },
  ],
};

const EDUCATION_INFO_SECTION: TemplateSection = {
  id: "education_info",
  title: { en: "Education Information", zh: "教育信息", th: "ข้อมูลการศึกษา" },
  fields: [
    { id: "highest_qualification", type: "text", label: { en: "Highest qualification", zh: "最高学历", th: "วุฒิการศึกษาสูงสุด" }, required: true },
    { id: "school_name", type: "text", label: { en: "School / University Name", zh: "学校/大学名称", th: "ชื่อโรงเรียน/มหาวิทยาลัย" }, required: true },
    { id: "school_country", type: "text", label: { en: "Country / Province / City of the graduation institution", zh: "毕业院校所在国家/省/市", th: "ประเทศ/จังหวัด/เมืองของสถาบันที่จบการศึกษา" }, required: true },
    { id: "study_start_date", type: "date", label: { en: "Start date of study", zh: "入学日期", th: "วันเริ่มต้นการศึกษา" } },
    { id: "graduation_year", type: "text", label: { en: "Graduation Year", zh: "毕业年份", th: "ปีที่จบการศึกษา" } },
    { id: "qualification_obtained", type: "radio", label: { en: "Did you obtain the qualification?", zh: "是否已获得该学历？", th: "คุณได้รับวุฒิการศึกษาหรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ได้" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่ได้" } }] },
    { id: "cert_serial", type: "text", label: { en: "Serial number of the qualification certificate", zh: "学历证书编号", th: "หมายเลขใบประกาศนียบัตร" } },
    { id: "other_qualifications", type: "radio", label: { en: "Do you have any other qualifications?", zh: "是否有其他学历？", th: "คุณมีวุฒิการศึกษาอื่นหรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "other_qual_name", type: "text", label: { en: "Other qualification name", zh: "其他学历名称", th: "ชื่อวุฒิการศึกษาอื่น" }, condition: { field: "other_qualifications", value: "yes" } },
    { id: "other_qual_school", type: "text", label: { en: "School / University", zh: "学校/大学", th: "โรงเรียน/มหาวิทยาลัย" }, condition: { field: "other_qualifications", value: "yes" } },
    { id: "other_qual_country", type: "text", label: { en: "Country / Province / City", zh: "国家/省/市", th: "ประเทศ/จังหวัด/เมือง" }, condition: { field: "other_qualifications", value: "yes" } },
    { id: "other_qual_graduation", type: "text", label: { en: "Graduation Year", zh: "毕业年份", th: "ปีที่จบ" }, condition: { field: "other_qualifications", value: "yes" } },
  ],
};

const EMPLOYMENT_INFO_SECTION: TemplateSection = {
  id: "employment_info",
  title: { en: "Employment Information", zh: "工作信息", th: "ข้อมูลการทำงาน" },
  fields: [
    { id: "currently_employed", type: "radio", label: { en: "Do you currently have a job?", zh: "目前是否在职？", th: "คุณทำงานอยู่ในปัจจุบันหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "employer_name", type: "text", label: { en: "Employer Name", zh: "雇主名称", th: "ชื่อนายจ้าง" }, condition: { field: "currently_employed", value: "yes" }, required: true },
    { id: "employment_start", type: "date", label: { en: "Start date of employment", zh: "入职日期", th: "วันเริ่มต้นทำงาน" }, condition: { field: "currently_employed", value: "yes" } },
    { id: "job_title", type: "text", label: { en: "Job Title", zh: "职位", th: "ตำแหน่งงาน" }, condition: { field: "currently_employed", value: "yes" }, required: true },
    { id: "employment_location", type: "text", label: { en: "Country / Province / City of employment", zh: "工作所在国家/省/市", th: "ประเทศ/จังหวัด/เมืองที่ทำงาน" }, condition: { field: "currently_employed", value: "yes" } },
    { id: "employer_phone", type: "phone", label: { en: "Employer Phone", zh: "雇主电话", th: "เบอร์โทรนายจ้าง" }, condition: { field: "currently_employed", value: "yes" } },
    { id: "employer_email", type: "email", label: { en: "Employer Email", zh: "雇主邮箱", th: "อีเมลนายจ้าง" }, condition: { field: "currently_employed", value: "yes" } },
    { id: "previous_employment", type: "radio", label: { en: "Have you had any previous employment?", zh: "是否有过之前的工作经历？", th: "คุณเคยทำงานมาก่อนหรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
    { id: "employment_history", type: "textarea", label: { en: "Please provide your full employment history (company, position, dates, country)", zh: "请提供完整工作历史（公司、职位、日期、国家）", th: "กรุณาให้ประวัติการทำงานทั้งหมด (บริษัท, ตำแหน่ง, วันที่, ประเทศ)" }, condition: { field: "previous_employment", value: "yes" } },
  ],
};

const PARTNER_INFO_SECTION: TemplateSection = {
  id: "partner_info",
  title: { en: "Partner / Spouse Information", zh: "配偶/伴侣信息", th: "ข้อมูลเกี่ยวกับคู่สมรส/พาร์ทเนอร์" },
  fields: [
    { id: "has_partner", type: "radio", label: { en: "Do you have a partner/spouse?", zh: "是否有配偶/伴侣？", th: "คุณมีคู่สมรส/พาร์ทเนอร์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "partner_nz_citizen", type: "radio", label: { en: "Is your partner a New Zealand citizen or resident?", zh: "配偶是否为新西兰公民或居民？", th: "คู่สมรสของคุณเป็นพลเมืองหรือผู้อยู่อาศัยในนิวซีแลนด์หรือไม่？" }, condition: { field: "has_partner", value: "yes" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "partner_name", type: "name", label: { en: "Partner's full name", zh: "配偶全名", th: "ชื่อ-นามสกุลของคู่สมรส" }, condition: { field: "has_partner", value: "yes" }, subfields: ["first_name", "middle_name", "last_name"] },
    { id: "partner_dob", type: "date", label: { en: "Partner's date of birth", zh: "配偶出生日期", th: "วันเกิดของคู่สมรส" }, condition: { field: "has_partner", value: "yes" } },
    { id: "partner_nationality", type: "text", label: { en: "Partner's nationality", zh: "配偶国籍", th: "สัญชาติของคู่สมรส" }, condition: { field: "has_partner", value: "yes" } },
    { id: "partner_passport", type: "text", label: { en: "Partner's passport number", zh: "配偶护照号码", th: "หมายเลขหนังสือเดินทางของคู่สมรส" }, condition: { field: "has_partner", value: "yes" } },
    { id: "partner_email", type: "email", label: { en: "Partner's email", zh: "配偶邮箱", th: "อีเมลของคู่สมรส" }, condition: { field: "has_partner", value: "yes" } },
    { id: "partner_phone", type: "phone", label: { en: "Partner's phone", zh: "配偶电话", th: "เบอร์โทรของคู่สมรส" }, condition: { field: "has_partner", value: "yes" } },
    { id: "living_together_12m", type: "radio", label: { en: "Have you been living together for at least 12 months?", zh: "是否已共同生活至少12个月？", th: "คุณอาศัยอยู่ด้วยกันอย่างน้อย 12 เดือนหรือไม่？" }, condition: { field: "has_partner", value: "yes" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
    { id: "previous_relationship", type: "radio", label: { en: "Do you have a previous relationship?", zh: "是否有过前段感情？", th: "คุณมีความสัมพันธ์ก่อนหน้านี้หรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "previous_partner_details", type: "textarea", label: { en: "Previous partner/spouse details (name, DOB, nationality)", zh: "前配偶/伴侣信息（姓名、出生日期、国籍）", th: "รายละเอียดคู่สมรส/พาร์ทเนอร์คนก่อน" }, condition: { field: "previous_relationship", value: "yes" } },
  ],
};

const FAMILY_INFO_SECTION: TemplateSection = {
  id: "family_info",
  title: { en: "Family Information", zh: "家庭信息", th: "ข้อมูลเกี่ยวกับครอบครัว" },
  description: { en: "Please provide details of your parents, siblings, and children.", zh: "请提供您的父母、兄弟姐妹和子女的信息。", th: "กรุณาให้รายละเอียดของบิดามารดา พี่น้อง และบุตรของคุณ" },
  fields: [
    { id: "parents_details", type: "textarea", label: { en: "Parents details (Father & Mother: name, DOB, nationality, occupation, contact)", zh: "父母信息（父亲和母亲：姓名、出生日期、国籍、职业、联系方式）", th: "รายละเอียดบิดามารดา" }, required: true, helpText: { en: "Include: full name, date of birth, nationality, occupation, phone, email for both parents. Also include step-parents or adoptive parents if applicable.", zh: "请包含：父母双方的全名、出生日期、国籍、职业、电话、邮箱。", th: "กรุณาระบุ: ชื่อเต็ม, วันเกิด, สัญชาติ, อาชีพ, เบอร์โทร, อีเมลของบิดามารดาทั้งสองฝ่าย" } },
    { id: "siblings_details", type: "textarea", label: { en: "Siblings details (name, DOB, nationality, relationship)", zh: "兄弟姐妹信息（姓名、出生日期、国籍、关系）", th: "รายละเอียดพี่น้อง" } },
    { id: "children_details", type: "textarea", label: { en: "Children details (name, DOB, nationality, gender)", zh: "子女信息（姓名、出生日期、国籍、性别）", th: "รายละเอียดบุตร" } },
  ],
};

const NZ_CONTACTS_SECTION: TemplateSection = {
  id: "nz_contacts",
  title: { en: "New Zealand Contacts", zh: "新西兰联系人", th: "ผู้ติดต่อในนิวซีแลนด์" },
  fields: [
    { id: "has_nz_contact", type: "radio", label: { en: "Do you have the contact details of anyone you know in New Zealand?", zh: "您是否有在新西兰认识的人的联系方式？", th: "คุณมีข้อมูลติดต่อของคนที่คุณรู้จักในนิวซีแลนด์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
    { id: "nz_contact_name", type: "name", label: { en: "Contact name", zh: "联系人姓名", th: "ชื่อผู้ติดต่อ" }, condition: { field: "has_nz_contact", value: "yes" }, subfields: ["first_name", "last_name"] },
    { id: "nz_contact_dob", type: "date", label: { en: "Date of birth", zh: "出生日期", th: "วันเกิด" }, condition: { field: "has_nz_contact", value: "yes" } },
    { id: "nz_contact_relationship", type: "text", label: { en: "Relationship to you", zh: "与您的关系", th: "ความสัมพันธ์กับคุณ" }, condition: { field: "has_nz_contact", value: "yes" } },
    { id: "nz_contact_phone", type: "phone", label: { en: "Phone", zh: "电话", th: "เบอร์โทร" }, condition: { field: "has_nz_contact", value: "yes" } },
    { id: "nz_contact_email", type: "email", label: { en: "Email", zh: "邮箱", th: "อีเมล" }, condition: { field: "has_nz_contact", value: "yes" } },
    { id: "nz_contact_address", type: "textarea", label: { en: "Address", zh: "地址", th: "ที่อยู่" }, condition: { field: "has_nz_contact", value: "yes" } },
  ],
};

// ─── 6 Templates ─────────────────────────────────────────────────────────────

export const INTAKE_TEMPLATES = [
  // Template 1: Client Visa Assessment
  {
    name: "Client Visa Assessment",
    category: "client_assessment",
    description: { en: "Initial visa assessment form for new clients", zh: "新客户签证初步评估表", th: "แบบฟอร์มประเมินวีซ่าเบื้องต้น" },
    language_options: ["en", "zh", "th"],
    is_active: true,
    version: 1,
    fields: {
      sections: [
        {
          id: "personal_info",
          title: { en: "Personal Information", zh: "个人信息", th: "ข้อมูลส่วนตัว" },
          fields: [
            { id: "full_name", type: "name", label: { en: "Full Name", zh: "姓名", th: "ชื่อ-นามสกุล" }, required: true, subfields: ["first_name", "middle_name", "last_name"] },
            { id: "dob", type: "date", label: { en: "Date of Birth", zh: "出生日期", th: "วันเดือนปีเกิด" }, required: true },
            { id: "email", type: "email", label: { en: "Email", zh: "电子邮箱", th: "อีเมล" }, required: true },
            { id: "passport_number", type: "text", label: { en: "Passport Number", zh: "护照号码", th: "หมายเลขหนังสือเดินทาง" }, required: true },
            { id: "national_id", type: "text", label: { en: "National ID Number", zh: "身份证号码", th: "เลขประจำตัวประชาชน" } },
            { id: "used_name", type: "radio", label: { en: "Have you used any other names?", zh: "是否曾用其他名字？", th: "คุณเคยใช้ชื่ออื่นหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
            { id: "used_name_details", type: "text", label: { en: "Please provide your other name(s)", zh: "请提供曾用名", th: "กรุณาระบุชื่ออื่น" }, condition: { field: "used_name", value: "yes" }, required: true },
            { id: "gender", type: "radio", label: { en: "Gender", zh: "性别", th: "เพศ" }, required: true, options: [{ value: "male", label: { en: "Male", zh: "男", th: "ชาย" } }, { value: "female", label: { en: "Female", zh: "女", th: "หญิง" } }] },
            { id: "birth_city_country", type: "text", label: { en: "City and country of birth", zh: "出生城市和国家", th: "เมืองและประเทศที่เกิด" }, required: true },
            { id: "partnership_status", type: "select", label: { en: "Partnership Status", zh: "婚姻状况", th: "สถานะภาพสมรส" }, required: true, options: [{ value: "single", label: { en: "Single", zh: "单身", th: "โสด" } }, { value: "married", label: { en: "Married", zh: "已婚", th: "แต่งงาน" } }, { value: "de_facto", label: { en: "De Facto", zh: "事实伴侣", th: "คู่ครองตามกฎหมาย" } }, { value: "divorced", label: { en: "Divorced", zh: "离异", th: "หย่าร้าง" } }, { value: "widowed", label: { en: "Widowed", zh: "丧偶", th: "หม้าย" } }] },
            { id: "previously_married", type: "radio", label: { en: "Have you been previously married?", zh: "是否有过婚史？", th: "เคยแต่งงานมาก่อนหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "mobile_number", type: "phone", label: { en: "Mobile Number", zh: "手机号码", th: "เบอร์โทรศัพท์มือถือ" }, required: true },
          ] as TemplateField[],
        },
        {
          id: "immigration_history",
          title: { en: "Immigration History", zh: "移民历史", th: "ประวัติการย้ายถิ่นฐาน" },
          fields: [
            { id: "previous_nz_visa", type: "radio", label: { en: "Have you previously applied for a New Zealand visa?", zh: "是否曾申请过新西兰签证？", th: "เคยยื่นขอวีซ่านิวซีแลนด์มาก่อนหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "current_address", type: "textarea", label: { en: "Current residential address", zh: "目前居住地址", th: "ที่อยู่ปัจจุบัน" }, required: true },
            { id: "bring_family", type: "radio", label: { en: "Do you plan to bring or sponsor your spouse and/or children to New Zealand?", zh: "是否计划携带或担保配偶和/或子女来新西兰？", th: "คุณวางแผนจะพาหรือสปอนเซอร์คู่สมรสและ/หรือบุตรมานิวซีแลนด์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
          ] as TemplateField[],
        },
        {
          id: "education_employment",
          title: { en: "Education & Employment", zh: "教育与工作", th: "การศึกษาและการทำงาน" },
          fields: [
            { id: "has_tertiary", type: "radio", label: { en: "Do you have any tertiary education qualifications above high school level?", zh: "是否拥有高中以上学历？", th: "คุณมีวุฒิการศึกษาระดับอุดมศึกษาหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
            { id: "currently_employed", type: "radio", label: { en: "Are you currently employed?", zh: "目前是否在职？", th: "คุณทำงานอยู่ในปัจจุบันหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
          ] as TemplateField[],
        },
        {
          id: "health",
          title: { en: "Health Information", zh: "健康信息", th: "ข้อมูลสุขภาพ" },
          fields: [
            { id: "has_tb", type: "radio", label: { en: "Do you have tuberculosis (TB)?", zh: "是否患有肺结核？", th: "คุณเป็นวัณโรค (TB) หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "renal_dialysis", type: "radio", label: { en: "Do you require renal dialysis?", zh: "是否需要肾透析？", th: "คุณต้องการการฟอกไตหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "hospital_care", type: "radio", label: { en: "Do you require hospital care?", zh: "是否需要住院治疗？", th: "คุณต้องการการรักษาในโรงพยาบาลหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "is_pregnant", type: "radio", label: { en: "Are you pregnant?", zh: "是否怀孕？", th: "คุณตั้งครรภ์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }, { value: "na", label: { en: "N/A", zh: "不适用", th: "ไม่เกี่ยวข้อง" } }] },
            { id: "health_details", type: "textarea", label: { en: "If you answered Yes to any above, please provide details", zh: "如果以上任何问题回答了【是】，请提供详情", th: "หากคุณตอบว่า ใช่ ในข้อใดข้างต้น กรุณาให้รายละเอียด" } },
          ] as TemplateField[],
        },
        {
          id: "character",
          title: { en: "Character Information", zh: "品格信息", th: "ข้อมูลเกี่ยวกับประวัติ" },
          fields: [
            { id: "deported", type: "radio", label: { en: "Have you ever been removed, deported, or expelled from any country?", zh: "是否曾被任何国家驱逐或遣返？", th: "คุณเคยถูกเนรเทศหรือขับออกจากประเทศใดหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "visa_refused", type: "radio", label: { en: "Have you ever been refused a visa for any country?", zh: "是否曾被任何国家拒签？", th: "คุณเคยถูกปฏิเสธวีซ่าจากประเทศใดหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "convicted", type: "radio", label: { en: "Have you ever been convicted of any offence?", zh: "是否曾有犯罪记录？", th: "คุณเคยถูกตัดสินว่ามีความผิดหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "false_info", type: "radio", label: { en: "Have you ever provided false or misleading information in a visa application?", zh: "是否曾在签证申请中提供虚假信息？", th: "คุณเคยให้ข้อมูลเท็จในการยื่นขอวีซ่าหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "character_details", type: "textarea", label: { en: "If you answered Yes to any above, please provide details", zh: "如果以上任何问题回答了【是】，请提供详情", th: "หากตอบว่า เคย ในข้อใดข้างต้น กรุณาให้รายละเอียด" } },
          ] as TemplateField[],
        },
        ACKNOWLEDGEMENT_SECTION,
      ],
    } as TemplateData,
  },

  // Template 2: Visa Application Full
  {
    name: "Visa Application - Full Information",
    category: "visa_personal",
    description: { en: "Complete visa application information collection form", zh: "完整签证申请信息采集表", th: "แบบฟอร์มรวบรวมข้อมูลสำหรับการยื่นวีซ่าฉบับเต็ม" },
    language_options: ["en", "zh", "th"],
    is_active: true,
    version: 1,
    fields: {
      sections: [
        GENERAL_INFO_SECTION,
        HEALTH_INFO_SECTION,
        CHARACTER_INFO_SECTION,
        EDUCATION_INFO_SECTION,
        EMPLOYMENT_INFO_SECTION,
        PARTNER_INFO_SECTION,
        FAMILY_INFO_SECTION,
        NZ_CONTACTS_SECTION,
        ACKNOWLEDGEMENT_SECTION,
      ],
    } as TemplateData,
  },

  // Template 3: Student Application Full
  {
    name: "Student Application - Full Information",
    category: "visa_student",
    description: { en: "Complete student visa application information collection form", zh: "完整学生签证申请信息采集表", th: "แบบฟอร์มรวบรวมข้อมูลสำหรับการยื่นวีซ่านักเรียนฉบับเต็ม" },
    language_options: ["en", "zh", "th"],
    is_active: true,
    version: 1,
    fields: {
      sections: [
        GENERAL_INFO_SECTION,
        {
          id: "emergency_contact",
          title: { en: "Emergency Contact", zh: "紧急联系人", th: "ผู้ติดต่อฉุกเฉิน" },
          fields: [
            { id: "emergency_name", type: "text", label: { en: "Emergency contact name", zh: "紧急联系人姓名", th: "ชื่อผู้ติดต่อฉุกเฉิน" }, required: true },
            { id: "emergency_dob", type: "date", label: { en: "Date of birth", zh: "出生日期", th: "วันเกิด" } },
            { id: "emergency_phone", type: "phone", label: { en: "Contact number", zh: "联系电话", th: "เบอร์โทร" }, required: true },
            { id: "emergency_email", type: "email", label: { en: "Email", zh: "邮箱", th: "อีเมล" } },
            { id: "emergency_address", type: "textarea", label: { en: "Address", zh: "地址", th: "ที่อยู่" } },
            { id: "emergency_relationship", type: "text", label: { en: "Relationship to you", zh: "与您的关系", th: "ความสัมพันธ์กับคุณ" }, required: true },
            { id: "emergency_gender", type: "radio", label: { en: "Gender", zh: "性别", th: "เพศ" }, options: [{ value: "male", label: { en: "Male", zh: "男", th: "ชาย" } }, { value: "female", label: { en: "Female", zh: "女", th: "หญิง" } }] },
          ] as TemplateField[],
        },
        {
          id: "father_info",
          title: { en: "Father's Information", zh: "父亲信息", th: "ข้อมูลบิดา" },
          fields: [
            { id: "father_name", type: "text", label: { en: "Father's full name", zh: "父亲全名", th: "ชื่อเต็มของบิดา" }, required: true },
            { id: "father_dob", type: "date", label: { en: "Date of birth", zh: "出生日期", th: "วันเกิด" } },
            { id: "father_marital", type: "select", label: { en: "Marital Status", zh: "婚姻状况", th: "สถานะภาพสมรส" }, options: [{ value: "single", label: { en: "Single", zh: "未婚", th: "โสด" } }, { value: "married", label: { en: "Married", zh: "已婚", th: "แต่งงาน" } }, { value: "divorced", label: { en: "Divorced", zh: "离异", th: "หย่าร้าง" } }, { value: "widowed", label: { en: "Widowed", zh: "丧偶", th: "หม้าย" } }] },
            { id: "father_occupation", type: "text", label: { en: "Occupation", zh: "职业", th: "อาชีพ" } },
            { id: "father_phone", type: "phone", label: { en: "Mobile number", zh: "手机号码", th: "เบอร์โทร" } },
            { id: "father_email", type: "email", label: { en: "Email", zh: "邮箱", th: "อีเมล" } },
            { id: "father_address", type: "textarea", label: { en: "Address", zh: "地址", th: "ที่อยู่" } },
          ] as TemplateField[],
        },
        {
          id: "mother_info",
          title: { en: "Mother's Information", zh: "母亲信息", th: "ข้อมูลมารดา" },
          fields: [
            { id: "mother_name", type: "text", label: { en: "Mother's full name", zh: "母亲全名", th: "ชื่อเต็มของมารดา" }, required: true },
            { id: "mother_dob", type: "date", label: { en: "Date of birth", zh: "出生日期", th: "วันเกิด" } },
            { id: "mother_marital", type: "select", label: { en: "Marital Status", zh: "婚姻状况", th: "สถานะภาพสมรส" }, options: [{ value: "single", label: { en: "Single", zh: "未婚", th: "โสด" } }, { value: "married", label: { en: "Married", zh: "已婚", th: "แต่งงาน" } }, { value: "divorced", label: { en: "Divorced", zh: "离异", th: "หย่าร้าง" } }, { value: "widowed", label: { en: "Widowed", zh: "丧偶", th: "หม้าย" } }] },
            { id: "mother_occupation", type: "text", label: { en: "Occupation", zh: "职业", th: "อาชีพ" } },
            { id: "mother_phone", type: "phone", label: { en: "Mobile number", zh: "手机号码", th: "เบอร์โทร" } },
            { id: "mother_email", type: "email", label: { en: "Email", zh: "邮箱", th: "อีเมล" } },
            { id: "mother_address", type: "textarea", label: { en: "Address", zh: "地址", th: "ที่อยู่" } },
          ] as TemplateField[],
        },
        {
          id: "school_application",
          title: { en: "School Application", zh: "学校申请", th: "การสมัครเรียน" },
          fields: [
            { id: "program_applying", type: "text", label: { en: "What program are you applying for in New Zealand?", zh: "您申请新西兰什么课程？", th: "คุณสมัครเรียนโปรแกรมใดในนิวซีแลนด์？" }, required: true },
            { id: "studied_other_nz_school", type: "radio", label: { en: "Have you ever studied at any other school in New Zealand?", zh: "是否曾在新西兰其他学校就读？", th: "คุณเคยเรียนที่โรงเรียนอื่นในนิวซีแลนด์หรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "previous_nz_schools", type: "textarea", label: { en: "Which school(s) have you studied at?", zh: "在哪些学校就读过？", th: "เรียนที่โรงเรียนใดบ้าง？" }, condition: { field: "studied_other_nz_school", value: "yes" } },
            { id: "siblings_at_school", type: "radio", label: { en: "Do you have siblings attending the school you are applying to?", zh: "是否有兄弟姐妹在您申请的学校就读？", th: "คุณมีพี่น้องที่เรียนอยู่ในโรงเรียนที่สมัครหรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
            { id: "current_grade", type: "text", label: { en: "What is your current grade/year level?", zh: "您目前的年级？", th: "คุณอยู่ชั้นปีอะไร？" } },
          ] as TemplateField[],
        },
        EDUCATION_INFO_SECTION,
        {
          id: "financial_support",
          title: { en: "Financial Support", zh: "经济担保", th: "การสนับสนุนทางการเงิน" },
          fields: [
            { id: "has_financial_support", type: "radio", label: { en: "Is there a person or organisation that will support you financially in New Zealand?", zh: "是否有人或组织将在新西兰为您提供经济支持？", th: "มีบุคคลหรือองค์กรที่จะสนับสนุนคุณทางการเงินในนิวซีแลนด์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
            { id: "sponsor_name", type: "text", label: { en: "Sponsor's full name", zh: "担保人全名", th: "ชื่อเต็มของผู้สนับสนุน" }, condition: { field: "has_financial_support", value: "yes" }, required: true },
            { id: "sponsor_relationship", type: "text", label: { en: "Relationship to the student", zh: "与学生的关系", th: "ความสัมพันธ์กับนักศึกษา" }, condition: { field: "has_financial_support", value: "yes" }, required: true },
            { id: "sponsor_dob", type: "date", label: { en: "Date of birth", zh: "出生日期", th: "วันเกิด" }, condition: { field: "has_financial_support", value: "yes" } },
            { id: "sponsor_nationality", type: "text", label: { en: "Country of citizenship", zh: "国籍", th: "สัญชาติ" }, condition: { field: "has_financial_support", value: "yes" } },
            { id: "sponsor_national_id", type: "text", label: { en: "National ID number", zh: "身份证号", th: "เลขประจำตัวประชาชน" }, condition: { field: "has_financial_support", value: "yes" } },
            { id: "sponsor_phone", type: "phone", label: { en: "Contact number", zh: "联系电话", th: "เบอร์โทร" }, condition: { field: "has_financial_support", value: "yes" } },
            { id: "sponsor_email", type: "email", label: { en: "Email", zh: "邮箱", th: "อีเมล" }, condition: { field: "has_financial_support", value: "yes" } },
            { id: "sponsor_address", type: "textarea", label: { en: "Address", zh: "地址", th: "ที่อยู่" }, condition: { field: "has_financial_support", value: "yes" } },
            { id: "sponsor_passport", type: "text", label: { en: "Passport number (if available)", zh: "护照号码（如有）", th: "หมายเลขหนังสือเดินทาง (ถ้ามี)" }, condition: { field: "has_financial_support", value: "yes" } },
          ] as TemplateField[],
        },
        NZ_CONTACTS_SECTION,
        HEALTH_INFO_SECTION,
        CHARACTER_INFO_SECTION,
        ACKNOWLEDGEMENT_SECTION,
      ],
    } as TemplateData,
  },

  // Template 4: PRV Supplement
  {
    name: "PRV Supplement Information",
    category: "visa_prv",
    description: { en: "Supplementary information for Permanent Resident Visa application", zh: "永久居民签证补充信息采集表", th: "ข้อมูลเพิ่มเติมสำหรับการยื่นขอวีซ่าถิ่นที่อยู่ถาวร" },
    language_options: ["en", "zh", "th"],
    is_active: true,
    version: 1,
    fields: {
      sections: [
        {
          id: "personal_supplement",
          title: { en: "Personal Supplement", zh: "个人补充信息", th: "ข้อมูลส่วนตัวเพิ่มเติม" },
          fields: [
            { id: "other_names_used", type: "radio", label: { en: "Have you ever used any other names?", zh: "是否曾使用过其他名字？", th: "คุณเคยใช้ชื่ออื่นหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "เคย" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่เคย" } }] },
            { id: "other_names_details", type: "text", label: { en: "Please provide other names used", zh: "请提供曾用名", th: "กรุณาระบุชื่ออื่นที่เคยใช้" }, condition: { field: "other_names_used", value: "yes" } },
            { id: "national_id", type: "text", label: { en: "National ID Number", zh: "身份证号码", th: "เลขประจำตัวประชาชน" } },
            { id: "country_when_submitting", type: "text", label: { en: "What country will you be in when this application is submitted?", zh: "提交申请时您将在哪个国家？", th: "คุณจะอยู่ในประเทศใดเมื่อยื่นคำร้องนี้？" }, required: true },
            { id: "current_address", type: "textarea", label: { en: "Your current physical address", zh: "您目前的住址", th: "ที่อยู่ปัจจุบันของคุณ" }, required: true },
            { id: "latest_offshore_address", type: "textarea", label: { en: "Latest offshore address", zh: "最近的海外地址", th: "ที่อยู่ต่างประเทศล่าสุด" } },
            { id: "other_citizenships", type: "radio", label: { en: "Do you hold any other citizenships?", zh: "是否持有其他国籍？", th: "คุณถือสัญชาติอื่นหรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
            { id: "other_citizenships_details", type: "text", label: { en: "Please specify", zh: "请说明", th: "กรุณาระบุ" }, condition: { field: "other_citizenships", value: "yes" } },
          ] as TemplateField[],
        },
        {
          id: "partnership_info",
          title: { en: "Partnership Information", zh: "伴侣信息", th: "ข้อมูลคู่สมรส" },
          fields: [
            { id: "partnership_status", type: "select", label: { en: "What is your partnership status?", zh: "您的伴侣关系状况？", th: "สถานะความสัมพันธ์ของคุณ？" }, required: true, options: [{ value: "single", label: { en: "Single", zh: "单身", th: "โสด" } }, { value: "married", label: { en: "Married", zh: "已婚", th: "แต่งงาน" } }, { value: "de_facto", label: { en: "De Facto", zh: "事实伴侣", th: "คู่ครอง" } }, { value: "divorced", label: { en: "Divorced", zh: "离异", th: "หย่าร้าง" } }, { value: "widowed", label: { en: "Widowed", zh: "丧偶", th: "หม้าย" } }] },
            { id: "include_partner", type: "radio", label: { en: "Do you intend to include your partner in this application?", zh: "是否将配偶包含在此申请中？", th: "คุณต้องการรวมคู่สมรสในคำร้องนี้หรือไม่？" }, condition: { field: "partnership_status", operator: "in", value: ["married", "de_facto"] }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "principal_applicant", type: "radio", label: { en: "Were you the principal applicant of your resident visa application?", zh: "您是否为居民签证申请的主申请人？", th: "คุณเป็นผู้สมัครหลักของการยื่นขอวีซ่าถิ่นที่อยู่หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "other_dependent_children", type: "radio", label: { en: "Do you have other dependent children not included in this application?", zh: "是否有未包含在此申请中的受抚养子女？", th: "คุณมีบุตรที่อยู่ในอุปการะที่ไม่ได้รวมอยู่ในคำร้องนี้หรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "มี" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่มี" } }] },
            { id: "dependent_children_details", type: "textarea", label: { en: "Please provide details of dependent children", zh: "请提供受抚养子女详情", th: "กรุณาให้รายละเอียดบุตรที่อยู่ในอุปการะ" }, condition: { field: "other_dependent_children", value: "yes" } },
          ] as TemplateField[],
        },
        CHARACTER_INFO_SECTION,
        ACKNOWLEDGEMENT_SECTION,
      ],
    } as TemplateData,
  },

  // Template 5: Employer Accreditation
  {
    name: "Employer Accreditation Questionnaire",
    category: "employer_accreditation",
    description: { en: "Employer accreditation application and renewal questionnaire", zh: "雇主认证申请和续期问卷", th: "แบบสอบถามสำหรับการขอรับรองและต่ออายุการรับรองนายจ้าง" },
    language_options: ["en", "zh", "th"],
    is_active: true,
    version: 1,
    fields: {
      sections: [
        {
          id: "application_type",
          title: { en: "Application Type", zh: "申请类型", th: "ประเภทคำร้อง" },
          fields: [
            { id: "accreditation_type", type: "radio", label: { en: "Is this a new application or a renewal?", zh: "这是新申请还是续期？", th: "นี่คือการสมัครใหม่หรือการต่ออายุ？" }, required: true, options: [{ value: "new", label: { en: "New Application", zh: "新申请", th: "สมัครใหม่" } }, { value: "renewal", label: { en: "Renewal", zh: "续期", th: "ต่ออายุ" } }] },
          ] as TemplateField[],
        },
        {
          id: "organisation_info",
          title: { en: "Organisation Information", zh: "公司信息", th: "ข้อมูลองค์กร" },
          fields: [
            { id: "legal_name", type: "text", label: { en: "Legal name of organisation", zh: "公司法定名称", th: "ชื่อทางกฎหมายขององค์กร" }, required: true },
            { id: "trading_name", type: "text", label: { en: "Trading name of organisation", zh: "公司商号", th: "ชื่อการค้าขององค์กร" } },
            { id: "business_address", type: "textarea", label: { en: "Business service address", zh: "公司地址", th: "ที่อยู่สำนักงาน" }, required: true },
            { id: "ird_number", type: "text", label: { en: "Organisation's IRD number", zh: "公司IRD税号", th: "หมายเลข IRD ขององค์กร" }, required: true },
            { id: "website", type: "text", label: { en: "Organisation's website address (if any)", zh: "公司网站（如有）", th: "เว็บไซต์ขององค์กร (ถ้ามี)" } },
            { id: "org_type", type: "select", label: { en: "Organisation type", zh: "公司类型", th: "ประเภทองค์กร" }, required: true, options: [{ value: "company", label: { en: "Company", zh: "公司", th: "บริษัท" } }, { value: "sole_trader", label: { en: "Sole Trader", zh: "个体经营", th: "ผู้ประกอบการรายเดียว" } }, { value: "partnership", label: { en: "Partnership", zh: "合伙企业", th: "ห้างหุ้นส่วน" } }, { value: "trust", label: { en: "Trust", zh: "信托", th: "ทรัสต์" } }, { value: "other", label: { en: "Other", zh: "其他", th: "อื่นๆ" } }] },
          ] as TemplateField[],
        },
        {
          id: "key_person",
          title: { en: "Key Person Details", zh: "关键人物信息", th: "รายละเอียดบุคคลสำคัญ" },
          fields: [
            { id: "key_person_name", type: "text", label: { en: "Key person's legal name", zh: "关键人物法定姓名", th: "ชื่อทางกฎหมายของบุคคลสำคัญ" }, required: true },
            { id: "key_person_dob", type: "date", label: { en: "Date of birth", zh: "出生日期", th: "วันเกิด" }, required: true },
            { id: "key_person_gender", type: "radio", label: { en: "Gender", zh: "性别", th: "เพศ" }, required: true, options: [{ value: "male", label: { en: "Male", zh: "男", th: "ชาย" } }, { value: "female", label: { en: "Female", zh: "女", th: "หญิง" } }] },
            { id: "key_person_birth_country", type: "text", label: { en: "Country or territory of birth", zh: "出生国家/地区", th: "ประเทศหรือดินแดนที่เกิด" }, required: true },
            { id: "key_person_citizenship", type: "text", label: { en: "Primary country of citizenship", zh: "主要国籍", th: "สัญชาติหลัก" }, required: true },
            { id: "key_person_passport", type: "text", label: { en: "Passport number", zh: "护照号码", th: "หมายเลขหนังสือเดินทาง" }, required: true },
            { id: "key_person_nz_citizen", type: "radio", label: { en: "Is the key person a New Zealand citizen or resident?", zh: "关键人物是否为新西兰公民或居民？", th: "บุคคลสำคัญเป็นพลเมืองหรือผู้อยู่อาศัยในนิวซีแลนด์หรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
          ] as TemplateField[],
        },
        {
          id: "business_questions",
          title: { en: "Business Questions", zh: "业务问题", th: "คำถามเกี่ยวกับธุรกิจ" },
          fields: [
            { id: "operating_12months", type: "radio", label: { en: "Has your organisation been operating for more than 12 months?", zh: "公司是否运营超过12个月？", th: "องค์กรของคุณดำเนินงานมากกว่า 12 เดือนหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "third_party_placement", type: "radio", label: { en: "Will your organisation place AEWV holders with a controlling third party?", zh: "公司是否将AEWV持有人派遣给第三方？", th: "องค์กรจะจัดให้ผู้ถือ AEWV ทำงานกับบุคคลที่สามหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "horticulture_viticulture", type: "radio", label: { en: "Does your business plan to recruit non-New Zealanders in horticulture or viticulture?", zh: "公司是否计划在园艺或葡萄种植业雇用非新西兰人？", th: "ธุรกิจของคุณวางแผนจะรับสมัครชาวต่างชาติในอุตสาหกรรมพืชสวนหรือองุ่นหรือไม่？" }, required: true, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "employ_6plus_aewv", type: "radio", label: { en: "Does/will your organisation employ six or more AEWV holders?", zh: "公司是否雇用6名或以上AEWV持有人？", th: "องค์กรจ้างหรือจะจ้างผู้ถือ AEWV หกคนขึ้นไปหรือไม่？" }, condition: { field: "accreditation_type", value: "renewal" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "operating_24months", type: "radio", label: { en: "Has your organisation been operating for at least 24 months?", zh: "公司是否运营至少24个月？", th: "องค์กรดำเนินงานอย่างน้อย 24 เดือนหรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "made_loss_24months", type: "radio", label: { en: "Has your organisation made a loss in the last 24 months?", zh: "公司在过去24个月内是否有亏损？", th: "องค์กรขาดทุนใน 24 เดือนที่ผ่านมาหรือไม่？" }, options: [{ value: "yes", label: { en: "Yes", zh: "是", th: "ใช่" } }, { value: "no", label: { en: "No", zh: "否", th: "ไม่" } }] },
            { id: "additional_info", type: "textarea", label: { en: "Any additional information relevant to your accreditation application", zh: "任何与认证申请相关的补充信息", th: "ข้อมูลเพิ่มเติมที่เกี่ยวข้องกับการขอรับรอง" } },
          ] as TemplateField[],
        },
        ACKNOWLEDGEMENT_SECTION,
      ],
    } as TemplateData,
  },

  // Template 6: Job Check Application
  {
    name: "Job Check Application Questionnaire",
    category: "employer_jobcheck",
    description: { en: "Job Check application questionnaire for employer services", zh: "职位审查申请问卷", th: "แบบสอบถามสำหรับการตรวจสอบตำแหน่งงาน" },
    language_options: ["en", "zh", "th"],
    is_active: true,
    version: 1,
    fields: {
      sections: [
        {
          id: "contact_info",
          title: { en: "Contact Information", zh: "联系信息", th: "ข้อมูลผู้ติดต่อ" },
          fields: [
            { id: "form_filler_name", type: "text", label: { en: "Full name of the person completing this form", zh: "填写此表的人员全名", th: "ชื่อเต็มของผู้กรอกแบบฟอร์มนี้" }, required: true },
            { id: "form_filler_position", type: "text", label: { en: "Position in the company", zh: "在公司的职位", th: "ตำแหน่งในบริษัท" }, required: true },
            { id: "company_trading_name", type: "text", label: { en: "Trading name of the company", zh: "公司商号", th: "ชื่อการค้าของบริษัท" }, required: true },
          ] as TemplateField[],
        },
        {
          id: "job_details",
          title: { en: "Job Details", zh: "职位详情", th: "รายละเอียดตำแหน่งงาน" },
          fields: [
            { id: "job_title", type: "text", label: { en: "Job title applied in this Job Check", zh: "此Job Check申请的职位名称", th: "ตำแหน่งงานที่ยื่นใน Job Check นี้" }, required: true },
            { id: "num_vacancies", type: "number", label: { en: "Number of vacancies", zh: "空缺职位数量", th: "จำนวนตำแหน่งงานว่าง" }, required: true },
            { id: "reason_for_positions", type: "textarea", label: { en: "Select the reason(s) the business requires these positions and explain in detail", zh: "请选择公司需要这些职位的原因并详细说明", th: "เลือกเหตุผลที่ธุรกิจต้องการตำแหน่งเหล่านี้และอธิบายโดยละเอียด" }, required: true },
            { id: "total_employees", type: "number", label: { en: "Total number of current employees", zh: "目前员工总数", th: "จำนวนพนักงานปัจจุบันทั้งหมด" }, required: true },
            { id: "nz_citizen_employees", type: "number", label: { en: "Number of NZ citizen/resident employees", zh: "新西兰公民/居民员工数量", th: "จำนวนพนักงานที่เป็นพลเมือง/ผู้อยู่อาศัยในนิวซีแลนด์" }, required: true },
          ] as TemplateField[],
        },
        {
          id: "employment_terms",
          title: { en: "Employment Terms", zh: "雇佣条件", th: "เงื่อนไขการจ้างงาน" },
          fields: [
            { id: "agreement_duration", type: "text", label: { en: "Duration and type of agreement (e.g., Permanent or Fixed term)", zh: "合同期限和类型（如永久或固定期限）", th: "ระยะเวลาและประเภทของข้อตกลง" }, required: true },
            { id: "job_region", type: "text", label: { en: "Region of the job (e.g., Auckland)", zh: "工作区域（如奥克兰）", th: "ภูมิภาคของงาน (เช่น โอ๊คแลนด์)" }, required: true },
            { id: "workplace_address", type: "textarea", label: { en: "Place of work (office address)", zh: "工作地点（办公地址）", th: "สถานที่ทำงาน (ที่อยู่สำนักงาน)" }, required: true },
            { id: "min_hours_week", type: "number", label: { en: "Minimum guaranteed hours of work per week", zh: "每周最低保证工时", th: "ชั่วโมงทำงานขั้นต่ำที่รับประกันต่อสัปดาห์" }, required: true },
            { id: "max_hours_week", type: "number", label: { en: "Maximum hours of work per week", zh: "每周最高工时", th: "ชั่วโมงทำงานสูงสุดต่อสัปดาห์" }, required: true },
            { id: "min_remuneration", type: "text", label: { en: "Minimum guaranteed remuneration ($ per hour or per year)", zh: "最低保证报酬（每小时或每年$）", th: "ค่าตอบแทนขั้นต่ำที่รับประกัน ($ ต่อชั่วโมง หรือ ต่อปี)" }, required: true },
            { id: "max_remuneration", type: "text", label: { en: "Maximum remuneration", zh: "最高报酬", th: "ค่าตอบแทนสูงสุด" } },
            { id: "additional_terms", type: "textarea", label: { en: "Additional employment terms and benefits", zh: "其他雇佣条件和福利", th: "เงื่อนไขและสวัสดิการเพิ่มเติม" } },
          ] as TemplateField[],
        },
        ACKNOWLEDGEMENT_SECTION,
      ],
    } as TemplateData,
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertIntakeTemplates(supabase: any) {
  const results = [];
  for (const tmpl of INTAKE_TEMPLATES) {
    const { data: existing } = await supabase
      .from("intake_form_templates")
      .select("id")
      .eq("category", tmpl.category)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("intake_form_templates").update({
        name: tmpl.name,
        description: tmpl.description,
        language_options: tmpl.language_options,
        fields: tmpl.fields,
        version: tmpl.version,
        is_active: tmpl.is_active,
      }).eq("id", existing.id);
      results.push({ category: tmpl.category, action: "updated", error: error?.message });
    } else {
      const { error } = await supabase.from("intake_form_templates").insert({
        name: tmpl.name,
        category: tmpl.category,
        description: tmpl.description,
        language_options: tmpl.language_options,
        fields: tmpl.fields,
        version: tmpl.version,
        is_active: tmpl.is_active,
      });
      results.push({ category: tmpl.category, action: "inserted", error: error?.message });
    }
  }
  return results;
}
