// Contract Templates Data
// Contains 6 contract templates: EN/ZH/TH × Individual/Employer
// Placeholders: {{date}}, {{client_name}}, {{client_address}}, {{client_email}}, {{client_mobile}},
//   {{client_family_name}}, {{client_first_name}}, {{client_family_members}}, {{company_name}},
//   {{service_type}}, {{total_service_fee}}, {{currency}}, {{payment_stages_table}},
//   {{inz_application_fee}}, {{refund_percentage}}, {{lia_name}},
//   {{adviser_signature}}, {{client_signature}},
//   {{adviser_sign_date}}, {{client_sign_date}}

const STYLE = `<style>
body { font-family: Arial, sans-serif; color: #111; line-height: 1.6; }
h1 { text-align: center; font-size: 17px; font-weight: bold; text-transform: uppercase; margin-bottom: 24px; }
h2 { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-top: 20px; margin-bottom: 6px; }
p { margin: 4px 0 8px; font-size: 13px; }
.parties { margin: 16px 0; font-size: 13px; }
.whereas { margin: 12px 0; font-size: 13px; }
.clause { margin: 10px 0; font-size: 13px; }
.clause-title { font-weight: bold; margin-top: 14px; margin-bottom: 4px; font-size: 13px; }
.sub-clause { margin: 4px 0 4px 20px; font-size: 13px; }
.schedule { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 12px; }
.sig-block { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 40px; }
.sig-item { flex: 1; min-width: 240px; }
.sig-label { font-size: 13px; font-weight: bold; margin-bottom: 6px; }
.sig-box { border-bottom: 1px solid #333; min-height: 60px; width: 100%; display: flex; align-items: flex-end; padding: 4px 0; }
.sig-date { font-size: 12px; color: #555; margin-top: 4px; }
.note { font-size: 11px; color: #555; margin-top: 8px; font-style: italic; }
table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 8px 0; }
th { text-align: left; padding: 4px 8px; border-bottom: 2px solid #ccc; font-weight: 600; }
td { padding: 4px 8px; border-bottom: 1px solid #eee; }
</style>`;

// ─── ENGLISH INDIVIDUAL ───────────────────────────────────────────────────────

const EN_INDIVIDUAL = `${STYLE}
<h1>Immigration Service Agreement</h1>

<div class="parties">
<p>This Agreement is made on <strong>{{date}}</strong></p>
<p><strong>BETWEEN:</strong></p>
<p>PJ Immigration Services Ltd, Licensed Immigration Adviser: Jiale WAN; Xu ZHOU; Di WU<br>
<strong>AND</strong><br>
<strong>{{client_name}}</strong> of {{client_address}}</p>
<p>(Hereinafter referred to as "the Adviser(s)" and "the Client" respectively)</p>
</div>

<div class="whereas">
<p><strong>WHEREAS A:</strong> The Adviser(s) are a licensed immigration consultancy company practising in New Zealand.</p>
<p><strong>WHEREAS B:</strong> The Client has agreed to engage the Adviser(s) as their immigration consultant for the purposes specified in Schedule Two of this agreement.</p>
<p><strong>IT IS RECORDED AND AGREED THAT:</strong></p>
</div>

<p class="clause-title">1. THE ADVISER(S) UNDERTAKE:</p>
<p class="sub-clause">1.1 To provide immigration advice and related services to the Client for the purposes described in Schedule Two of this Agreement.</p>
<p class="sub-clause">1.2 To apply for the relevant visa category to maximise the Client's chances of success within New Zealand immigration law.</p>
<p class="sub-clause">1.3 To achieve an outcome that is in the best interests of the Client within the parameters of New Zealand immigration law.</p>
<p class="sub-clause">1.4 To keep the Client informed of progress in their matter on a regular basis.</p>
<p class="sub-clause">1.5 To act in compliance with the Immigration Advisers Authority Code of Conduct 2014.</p>
<p class="sub-clause">1.6 To provide professional and expedient service and advice to the Client.</p>
<p class="sub-clause">1.7 To notify the Client of any relevant changes in the laws, regulations or policies of New Zealand Immigration, which may affect the progress or success of the Client's application.</p>

<p class="clause-title">2. THE CLIENT UNDERTAKES AND WARRANTS THAT THEY:</p>
<p class="sub-clause">2.1 are not aware of anything adverse with regard to their character, health or visa/permit history that they have not disclosed to The Adviser(s);</p>
<p class="sub-clause">2.2 will provide The Adviser(s) with full information and documentation as needed or required;</p>
<p class="sub-clause">2.3 will inform us of any relevant change in their circumstances (which might affect their application or the delivery of the services they have contracted us to provide);</p>
<p class="sub-clause">2.4 will not engage other immigration advisers, solicitors, or lawyers to handle the matters covered by this agreement, for the duration of this contract, unless otherwise agreed in writing;</p>
<p class="sub-clause">2.5 will not act on any Immigration related matter, submit any Immigration form or document without the knowledge and agreement of The Adviser(s).</p>

<p class="clause-title">3. FEES:</p>
<p class="sub-clause">3.1 The Client agrees to pay service fees as set out in Schedule Three of this Agreement.</p>
<p class="sub-clause">3.2 The service fees payable are exclusive of GST unless otherwise stated.</p>
<p class="sub-clause">3.3 Fees will be invoiced to the Client either prior to the commencement of services or on a stage payment basis as outlined in Schedule Three.</p>

<p class="clause-title">4. DISBURSEMENTS:</p>
<p class="sub-clause">4.1 The following disbursements are not included in the service fee and will be charged separately where applicable:</p>
<p class="sub-clause">4.2 Any Government application fees required by Immigration New Zealand.</p>
<p class="sub-clause">4.3 Any fees payable for independent medical examinations, x-rays, reports, or certificates required for New Zealand Immigration purposes.</p>
<p class="sub-clause">4.4 Any fees payable for English language testing courses, examinations, or certificates required for New Zealand Immigration purposes.</p>
<p class="sub-clause">4.5 Any fees payable for verification of qualifications, or occupation registration if required for New Zealand Immigration purposes.</p>
<p class="sub-clause">4.6 Any fees for work carried out for the Client by The Adviser(s) other than immigration service, such as employment or income investigation and report, or training services.</p>

<p class="clause-title">5. REFUND POLICY — ADVISER OBLIGATIONS:</p>
<p class="clause">If The Adviser(s) are unable to provide the agreed services due to Adviser error or fault, a full refund of the service fee will be given.</p>

<p class="clause-title">6. OBLIGATIONS:</p>
<p class="clause">The Adviser(s) do not guarantee that the visa application can be obtained for the Client but will use their best endeavours to obtain the relevant visa.</p>

<p class="clause-title">7. LIMITATION OF LIABILITY:</p>
<p class="clause">If the Client fails the medical examination or is found to have inadequate English or a criminal record, the Adviser(s) shall be deemed to have discharged their obligations, and the Adviser(s) shall be entitled to the full amount of service fees.</p>

<p class="clause-title">8. TERMINATION:</p>
<p class="clause">Either party may terminate this agreement by giving fourteen (14) days written notice. In the event that the Client terminates the Agreement, the Client is liable to pay the Adviser(s) for all services rendered up to and including the date of termination.</p>

<p class="clause-title">9. REFUND POLICY — CLIENT OBLIGATIONS:</p>
<p class="sub-clause">9.1 If the visa application is declined:</p>
<p class="sub-clause">9.2 No refund will be given to the client if:</p>
<p class="sub-clause">a. The client provided incorrect information including omission by the Client.</p>
<p class="sub-clause">b. The client has previous records of visa refusal that have not been disclosed.</p>
<p class="sub-clause">c. The client's personal circumstances change after the commencement of service.</p>
<p class="sub-clause">d. The client is found by Immigration New Zealand to not meet the minimum standards for a visa application to proceed.</p>
<p class="sub-clause">e. The client changes their mind, withdraws their application or does not wish to proceed with the application.</p>
<p class="sub-clause">f. The client does not comply with requirements as outlined in Clause 2 of this Agreement.</p>
<p class="sub-clause">g. Circumstances beyond the control of PJ Immigration Services Ltd arising after the commencement of service.</p>
<p class="sub-clause">9.3 If the client wishes to terminate the agreement, a refund of <strong>{{refund_percentage}}%</strong> of the fees paid will be given:</p>
<p class="sub-clause">a. The client has no previous records of visa refusal not been disclosed.</p>
<p class="sub-clause">b. The client's personal circumstances remain unchanged.</p>
<p class="sub-clause">c. The client has not withdrawn their application.</p>
<p class="sub-clause">d. The client has complied with requirements as outlined in Clause 2 of this Agreement.</p>
<p class="sub-clause">e. The client has provided accurate information.</p>

<p class="clause-title">10. COMPLAINTS PROCEDURE:</p>
<p class="sub-clause">10.1 PJ Immigration Services Limited maintains an internal complaint handling procedure.</p>
<p class="sub-clause">10.2 Any formal complaint should be submitted directly to PJ Immigration Services in writing. PJ Immigration Services will acknowledge the complaint within 24 hours and investigate the matter within 14 days.</p>
<p class="sub-clause">10.3 If the client is unsatisfied with the response from PJ Immigration Services, the client may escalate the complaint to the Office of the Immigration Adviser Authority (IAA) at iaa.govt.nz.</p>
<p class="sub-clause">10.4 PJ Immigration Services Limited maintains an indemnity insurance policy with a reputable insurer for service compensation. If a complaint involves a compensation payment, PJ Immigration Services will contact its insurer for guidance.</p>

<p class="clause-title">11. CONFIDENTIALITY:</p>
<p class="sub-clause">11.1 The Adviser(s) may not disclose any client personal or financial information to any third party, unless authorised by the client or required by law.</p>
<p class="sub-clause">11.2 The client agrees to keep confidential all information and advice provided by the Adviser(s) and not disclose the information to a third party without the written permission of the Adviser(s).</p>
<p class="sub-clause">11.3 The client agrees to release any relevant personal information about themselves to the Adviser(s) for the purpose of providing advice.</p>
<p class="sub-clause">11.4 The client's personal information will be kept securely and in compliance with the New Zealand Privacy Act 2020.</p>

<p class="clause-title">12. DISPUTES:</p>
<p class="clause">Any disputes arising from this agreement, which cannot be resolved by both parties, may be referred to the Dispute Tribunal of New Zealand, or the Office of the Immigration Adviser Authority.</p>

<p class="clause-title">13. JURISDICTION:</p>
<p class="clause">This agreement shall be governed by and interpreted in accordance with the laws of New Zealand.</p>

<p class="clause-title">14. SIGNATURES:</p>
<p class="sub-clause">14.1 This agreement is the entire agreement between the parties and supersedes any prior agreements.</p>
<p class="sub-clause">14.2 The parties to this agreement confirm they have read and understood the provisions of this agreement.</p>
<p class="sub-clause">14.3 By signing this agreement, both parties confirm that they are agreeing to the terms and conditions stated herein.</p>
<p class="sub-clause">14.4 The Client confirms that they have received all the necessary information and documentation to make an informed decision about engaging the Adviser(s).</p>
<p class="sub-clause">14.5 If either party needs to modify or change the terms of the agreement, they must do so in writing, signed by both parties.</p>

<p class="clause">I <strong>{{client_name}}</strong> understand, agree and accept the terms all above of this entire agreement.</p>

<div class="sig-block">
  <div class="sig-item">
    <p class="sig-label">SIGNED BY THE CLIENT:</p>
    <div class="sig-box">{{client_signature}}</div>
    <p class="sig-date">Date: {{client_sign_date}}</p>
  </div>
  <div class="sig-item">
    <p class="sig-label">SIGNED BY ADVISER: {{lia_name}}</p>
    <div class="sig-box">{{adviser_signature}}</div>
    <p class="sig-date">Date: {{adviser_sign_date}}</p>
  </div>
</div>

<div class="schedule">
<h2>SCHEDULE ONE — CLIENT PARTICULARS</h2>
<p>Family name of Client: <strong>{{client_family_name}}</strong></p>
<p>First name(s) of Client: <strong>{{client_first_name}}</strong></p>
<p>Full names of client family members included: <strong>{{client_family_members}}</strong></p>
</div>

<div class="schedule">
<h2>SCHEDULE TWO — TYPE OF APPLICATION</h2>
<p>TYPE OF VISA TO BE APPLIED: <strong>{{service_type}}</strong></p>
</div>

<div class="schedule">
<h2>SCHEDULE THREE — FEES</h2>
<p>TOTAL SERVICE FEES is NZ$ <strong>{{total_service_fee}}</strong></p>
<p>TOTAL FEES to be paid as following:</p>
{{payment_stages_table}}
<br>
<p><strong>DISBURSEMENTS</strong></p>
<p>INZ Application Fee (GST Inclusive) &nbsp;&nbsp; {{currency}}$ {{inz_application_fee}}</p>
<p>Translation Fee &nbsp;&nbsp; TBA</p>
<p>Courier Fee &nbsp;&nbsp; TBA</p>
<p class="note">*Please note all fees charge by Immigration Services is in NZ Dollars and exclusive of GST, unless otherwise specified.</p>
</div>`;

// ─── ENGLISH EMPLOYER ─────────────────────────────────────────────────────────

const EN_EMPLOYER = `${STYLE}
<h1>Employer Immigration Services Agreement</h1>

<div class="parties">
<p>This Agreement is made on <strong>{{date}}</strong></p>
<p><strong>BETWEEN:</strong></p>
<p>PJ Immigration Services Ltd, Licensed Immigration Adviser: Jiale WAN; Xu ZHOU; Di WU<br>
<strong>AND</strong><br>
<strong>{{company_name}}</strong></p>
<p>(Hereinafter referred to as "the Adviser(s)" and "the Client" respectively)</p>
</div>

<div class="whereas">
<p><strong>WHEREAS A:</strong> The Adviser(s) are a licensed immigration consultancy company practising in New Zealand.</p>
<p><strong>WHEREAS B:</strong> The Client has agreed to engage the Adviser(s) as their immigration consultant for the purposes specified in Schedule Two of this agreement.</p>
<p><strong>IT IS RECORDED AND AGREED THAT:</strong></p>
</div>

<p class="clause-title">1. THE ADVISER(S) UNDERTAKE:</p>
<p class="sub-clause">1.1 To provide immigration advice and related services to the Client for the purposes described in Schedule Two of this Agreement.</p>
<p class="sub-clause">1.2 To obtain the accreditation/job check for the client listed in Schedule Two.</p>
<p class="sub-clause">1.3 To achieve an outcome that is in the best interests of the Client within the parameters of New Zealand immigration law.</p>
<p class="sub-clause">1.4 To keep the Client informed of progress in their matter on a regular basis.</p>
<p class="sub-clause">1.5 To act in compliance with the Immigration Advisers Authority Code of Conduct 2014.</p>
<p class="sub-clause">1.6 To provide professional and expedient service and advice to the Client.</p>
<p class="sub-clause">1.7 To notify the Client of any relevant changes in the laws, regulations or policies of New Zealand Immigration, which may affect the progress or success of the Client's application.</p>

<p class="clause-title">2. THE CLIENT UNDERTAKES AND WARRANTS THAT THEY:</p>
<p class="sub-clause">2.1 are a genuinely operating business in New Zealand;</p>
<p class="sub-clause">2.2 do not have any history of regulatory non-compliance with immigration and employment laws;</p>
<p class="sub-clause">2.3 are not aware of anything adverse with regard to their application that has not been disclosed to The Adviser(s);</p>
<p class="sub-clause">2.4 will ensure INZ to take steps to minimize the risk of exploitation;</p>
<p class="sub-clause">2.5 will inform Us of any relevant change in Your circumstances (which might affect Your application or the delivery of the services they have contracted us to provide).</p>

<p class="clause-title">3. FEES:</p>
<p class="sub-clause">3.1 The Client agrees to pay service fees as set out in Schedule Three of this Agreement.</p>
<p class="sub-clause">3.2 The service fees payable are exclusive of GST unless otherwise stated.</p>
<p class="sub-clause">3.3 Fees will be invoiced to the Client either prior to the commencement of services or on a stage payment basis as outlined in Schedule Three.</p>

<p class="clause-title">4. DISBURSEMENTS:</p>
<p class="sub-clause">4.1 The following disbursements are not included in the service fee and will be charged separately where applicable:</p>
<p class="sub-clause">4.2 Any costs incurred in obtaining job check or labour marketing, including human resourcing costs and job vacancy advertising.</p>
<p class="sub-clause">4.3 Any fees payable for independent human resource consultant or employment law related consultations.</p>
<p class="sub-clause">4.4 Any costs incurred in obtaining validation of industrial registration, or occupation registration if required for New Zealand Immigration purposes.</p>
<p class="sub-clause">4.5 Any fees for work carried out for the client by The Adviser(s) other than immigration service, such as business or job investigation and report, or training services.</p>

<p class="clause-title">5. REFUND POLICY — ADVISER OBLIGATIONS:</p>
<p class="clause">If The Adviser(s) are unable to provide the agreed services due to Adviser error or fault, a full refund of the service fee will be given.</p>

<p class="clause-title">6. OBLIGATIONS:</p>
<p class="clause">The Adviser(s) do not guarantee that the application(s) can be obtained for the client but will use their best endeavours to obtain the subscribed application.</p>

<p class="clause-title">7. LIMITATION OF LIABILITY:</p>
<p class="clause">If the Client fails the mandatory requirement or is found a non-compliance record, the Adviser(s) shall be deemed to have discharged their obligations, and the Adviser(s) shall be entitled to the full amount of service fees.</p>

<p class="clause-title">8. TERMINATION:</p>
<p class="clause">Either party may terminate this agreement by giving fourteen (14) days written notice. In the event that the Client terminates the Agreement, the Client is liable to pay the Adviser(s) for all services rendered up to and including the date of termination.</p>

<p class="clause-title">9. REFUND POLICY — CLIENT OBLIGATIONS:</p>
<p class="sub-clause">9.1 If application been declined:</p>
<p class="sub-clause">9.2 No refund will be given to the client if:</p>
<p class="sub-clause">a. The client provided incorrect information including omission by the Client.</p>
<p class="sub-clause">b. The client has previous records of visa refusal that have not been disclosed.</p>
<p class="sub-clause">c. The client's personal circumstances change after the commencement of service.</p>
<p class="sub-clause">d. The Client (represented business) is determined by Immigration New Zealand to be categorically unfit to meet Immigration standards.</p>
<p class="sub-clause">e. The client changes their mind, withdraws their application or does not wish to proceed with the application.</p>
<p class="sub-clause">f. The client does not comply with requirements as outlined in Clause 2 of this Agreement.</p>
<p class="sub-clause">g. Circumstances beyond the control of PJ Immigration Services Ltd arising after the commencement of service.</p>
<p class="sub-clause">9.3 If the client wishes to terminate the agreement, a refund of <strong>{{refund_percentage}}%</strong> of the fees paid will be given:</p>
<p class="sub-clause">a. The client has no previous records of visa refusal not been disclosed.</p>
<p class="sub-clause">b. The client's personal circumstances remain unchanged.</p>
<p class="sub-clause">c. The client has not withdrawn their application.</p>
<p class="sub-clause">d. The client has complied with requirements as outlined in Clause 2 of this Agreement.</p>
<p class="sub-clause">e. The client has provided accurate information.</p>

<p class="clause-title">10. COMPLAINTS PROCEDURE:</p>
<p class="sub-clause">10.1 PJ Immigration Services Limited maintains an internal complaint handling procedure.</p>
<p class="sub-clause">10.2 Any formal complaint should be submitted directly to PJ Immigration Services in writing. PJ Immigration Services will acknowledge the complaint within 24 hours and investigate the matter within 14 days.</p>
<p class="sub-clause">10.3 If the client is unsatisfied with the response from PJ Immigration Services, the client may escalate the complaint to the Office of the Immigration Adviser Authority (IAA) at iaa.govt.nz.</p>
<p class="sub-clause">10.4 PJ Immigration Services Limited maintains an indemnity insurance policy with a reputable insurer for service compensation. If a complaint involves a compensation payment, PJ Immigration Services will contact its insurer for guidance.</p>

<p class="clause-title">11. CONFIDENTIALITY:</p>
<p class="sub-clause">11.1 The Adviser(s) may not disclose any client company/personal information to any third party, unless authorised by the client or required by law.</p>
<p class="sub-clause">11.2 The client agrees to keep confidential all information and advice provided by the Adviser(s) and not disclose the information to a third party without the written permission of the Adviser(s).</p>
<p class="sub-clause">11.3 The client agrees to release any relevant personal information about themselves to the Adviser(s) for the purpose of providing advice.</p>
<p class="sub-clause">11.4 The client's personal information will be kept securely and in compliance with the New Zealand Privacy Act 2020.</p>

<p class="clause-title">12. DISPUTES:</p>
<p class="clause">Any disputes arising from this agreement, which cannot be resolved by both parties, may be referred to the Dispute Tribunal of New Zealand, or the Office of the Immigration Adviser Authority.</p>

<p class="clause-title">13. JURISDICTION:</p>
<p class="clause">This agreement shall be governed by and interpreted in accordance with the laws of New Zealand.</p>

<p class="clause-title">14. SIGNATURES:</p>
<p class="sub-clause">14.1 This agreement is the entire agreement between the parties and supersedes any prior agreements.</p>
<p class="sub-clause">14.2 The parties to this agreement confirm they have read and understood the provisions of this agreement.</p>
<p class="sub-clause">14.3 By signing this agreement, both parties confirm that they are agreeing to the terms and conditions stated herein.</p>
<p class="sub-clause">14.4 The Client confirms that they have received all the necessary information and documentation to make an informed decision about engaging the Adviser(s).</p>
<p class="sub-clause">14.5 If either party needs to modify or change the terms of the agreement, they must do so in writing, signed by both parties.</p>

<p class="clause">I <strong>{{company_name}}</strong> understand, agree and accept the terms all above of this entire agreement.</p>

<div class="sig-block">
  <div class="sig-item">
    <p class="sig-label">SIGNED BY {{client_name}} on behalf of {{company_name}}:</p>
    <div class="sig-box">{{client_signature}}</div>
    <p class="sig-date">Date: {{client_sign_date}}</p>
  </div>
  <div class="sig-item">
    <p class="sig-label">SIGNED BY ADVISER: {{lia_name}}</p>
    <div class="sig-box">{{adviser_signature}}</div>
    <p class="sig-date">Date: {{adviser_sign_date}}</p>
  </div>
</div>

<div class="schedule">
<h2>SCHEDULE ONE — CLIENT PARTICULARS</h2>
<p>Name of the Company: <strong>{{company_name}}</strong></p>
</div>

<div class="schedule">
<h2>SCHEDULE TWO — TYPE OF APPLICATION</h2>
<p>TYPE OF APPLICATION TO BE APPLIED: <strong>{{service_type}}</strong></p>
</div>

<div class="schedule">
<h2>SCHEDULE THREE — FEES</h2>
<p>TOTAL SERVICE FEES is $<strong>{{total_service_fee}}</strong> (GST excluded)</p>
<p>TOTAL SERVICE FEES to be paid as following:</p>
{{payment_stages_table}}
</div>`;

// ─── CHINESE INDIVIDUAL ───────────────────────────────────────────────────────

const ZH_INDIVIDUAL = `${STYLE}
<h1>签证移民服务合同</h1>

<div class="parties">
<p>本合同订立于 <strong>{{date}}</strong></p>
<p><strong>甲方：</strong></p>
<p>公司名称：PJ Immigration Services Ltd<br>
持牌移民顾问：Jiale WAN；Xu ZHOU；Di WU</p>
<p><strong>乙方（客户）：</strong></p>
<p><strong>{{client_name}}</strong>，地址：{{client_address}}</p>
<p>（以下分别简称"顾问"和"客户"）</p>
</div>

<div class="whereas">
<p><strong>鉴于 甲：</strong>顾问是在新西兰执业的持牌移民咨询公司。</p>
<p><strong>鉴于 乙：</strong>客户同意聘请顾问作为其移民顾问，为本合同附表二所规定的目的提供服务。</p>
<p><strong>双方特此记录并同意如下：</strong></p>
</div>

<p class="clause-title">1. 顾问承诺：</p>
<p class="sub-clause">1.1 根据本合同附表二所述目的，向客户提供移民建议及相关服务。</p>
<p class="sub-clause">1.2 在新西兰移民法律框架内，申请相关签证类别，以最大程度提高客户的成功率。</p>
<p class="sub-clause">1.3 在新西兰移民法律的范围内，实现最符合客户利益的结果。</p>
<p class="sub-clause">1.4 定期向客户通报其事务的进展情况。</p>
<p class="sub-clause">1.5 按照《2014年移民顾问管理局行为准则》行事。</p>
<p class="sub-clause">1.6 向客户提供专业及高效的服务与建议。</p>
<p class="sub-clause">1.7 告知客户新西兰移民法律、法规或政策的任何相关变化，这些变化可能影响客户申请的进展或成功。</p>

<p class="clause-title">2. 客户承诺并保证：</p>
<p class="sub-clause">2.1 据其所知，在品格、健康或签证/许可历史方面没有任何未向顾问披露的不利情况；</p>
<p class="sub-clause">2.2 将根据需要向顾问提供完整的信息和文件；</p>
<p class="sub-clause">2.3 将告知顾问其个人情况的任何相关变化（这些变化可能影响其申请或我们所提供服务的交付）；</p>
<p class="sub-clause">2.4 在合同有效期内，未经书面协议，不聘请其他移民顾问、律师或法律顾问处理本合同涵盖的事务；</p>
<p class="sub-clause">2.5 在未经顾问知晓和同意的情况下，不自行处理任何与移民相关的事务，不提交任何移民表格或文件。</p>

<p class="clause-title">3. 费用：</p>
<p class="sub-clause">3.1 客户同意按照本合同附表三的规定支付服务费。</p>
<p class="sub-clause">3.2 除非另有说明，应付服务费不含GST（商品及服务税）。</p>
<p class="sub-clause">3.3 费用将在服务开始前向客户开具发票，或按照附表三所述的分期付款方式开具发票。</p>

<p class="clause-title">4. 垫付费用：</p>
<p class="sub-clause">4.1 以下垫付费用不包含在服务费中，如适用，将单独收取：</p>
<p class="sub-clause">4.2 新西兰移民局要求的任何政府申请费。</p>
<p class="sub-clause">4.3 新西兰移民目的所需的独立体检、X光、报告或证明的费用。</p>
<p class="sub-clause">4.4 新西兰移民目的所需的英语语言培训课程、考试或证书的费用。</p>
<p class="sub-clause">4.5 新西兰移民目的所需的资质核验或职业登记费用。</p>
<p class="sub-clause">4.6 顾问为客户提供移民服务以外的其他工作所收取的费用，例如就业或收入调查报告或培训服务。</p>

<p class="clause-title">5. 退款政策——顾问义务：</p>
<p class="clause">如顾问因自身错误或过失无法提供约定服务，将全额退还服务费。</p>

<p class="clause-title">6. 义务：</p>
<p class="clause">顾问不保证能够为客户获得签证，但将尽最大努力为客户取得相关签证。</p>

<p class="clause-title">7. 责任限制：</p>
<p class="clause">如果客户未通过体检，或被发现英语水平不足，或有犯罪记录，顾问将被视为已履行其服务职责，并有权收取全额服务费。</p>

<p class="clause-title">8. 终止合同：</p>
<p class="clause">任何一方均可提前十四（14）天书面通知对方终止本合同。如客户终止合同，客户须向顾问支付截至终止日期已提供的所有服务费用。</p>

<p class="clause-title">9. 退款政策——客户义务：</p>
<p class="sub-clause">9.1 如签证申请被拒：</p>
<p class="sub-clause">9.2 在以下情况下，将不予退款：</p>
<p class="sub-clause">a. 客户提供了不正确的信息，包括遗漏。</p>
<p class="sub-clause">b. 客户有未披露的签证拒签记录。</p>
<p class="sub-clause">c. 客户个人情况在服务开始后发生变化。</p>
<p class="sub-clause">d. 客户被新西兰移民局认定不符合签证申请的最低标准。</p>
<p class="sub-clause">e. 客户改变主意、撤回申请或不愿继续办理申请。</p>
<p class="sub-clause">f. 客户未遵守本合同第2条所规定的要求。</p>
<p class="sub-clause">g. 服务开始后发生的超出PJ Immigration Services Ltd控制范围的情况。</p>
<p class="sub-clause">9.3 如客户希望终止合同，在以下情况下，将退还已付费用的 <strong>{{refund_percentage}}%</strong>：</p>
<p class="sub-clause">a. 客户没有未披露的签证拒签记录。</p>
<p class="sub-clause">b. 客户个人情况未发生变化。</p>
<p class="sub-clause">c. 客户未撤回其申请。</p>
<p class="sub-clause">d. 客户遵守了本合同第2条所规定的要求。</p>
<p class="sub-clause">e. 客户提供了准确的信息。</p>

<p class="clause-title">10. 投诉程序：</p>
<p class="sub-clause">10.1 PJ Immigration Services Limited建立了内部投诉处理程序。</p>
<p class="sub-clause">10.2 任何正式投诉应以书面形式直接提交给PJ Immigration Services。PJ Immigration Services将在24小时内确认收到投诉，并在14天内对事项进行调查。</p>
<p class="sub-clause">10.3 如果客户对PJ Immigration Services的答复不满意，可将投诉升级至移民顾问管理局（IAA）办公室，网址为iaa.govt.nz。</p>
<p class="sub-clause">10.4 PJ Immigration Services Limited向信誉良好的保险公司投保了赔偿保险。如投诉涉及赔偿，PJ Immigration Services将联系其保险公司寻求指导。</p>

<p class="clause-title">11. 保密：</p>
<p class="sub-clause">11.1 除非获得客户授权或法律要求，顾问不得向任何第三方披露客户的个人或财务信息。</p>
<p class="sub-clause">11.2 客户同意对顾问提供的所有信息和建议保密，未经顾问书面许可，不得向第三方披露。</p>
<p class="sub-clause">11.3 客户同意向顾问提供与其本人相关的必要个人信息，以便顾问提供咨询服务。</p>
<p class="sub-clause">11.4 客户的个人信息将根据《新西兰2020年隐私法》得到安全保管。</p>

<p class="clause-title">12. 争议：</p>
<p class="clause">因本合同引起的、双方无法协商解决的任何争议，可提交新西兰争议裁判所或移民顾问管理局办公室解决。</p>

<p class="clause-title">13. 司法管辖：</p>
<p class="clause">本合同应依据新西兰法律管辖和解释。</p>

<p class="clause-title">14. 签署：</p>
<p class="sub-clause">14.1 本合同是双方之间的完整协议，取代任何先前的协议。</p>
<p class="sub-clause">14.2 合同双方确认已阅读并理解本合同的各项条款。</p>
<p class="sub-clause">14.3 通过签署本合同，双方确认同意本合同所述的条款和条件。</p>
<p class="sub-clause">14.4 客户确认已收到所有必要的信息和文件，可以就聘请顾问作出知情决定。</p>
<p class="sub-clause">14.5 如任何一方需要修改或变更合同条款，须以书面形式进行，并由双方签署。</p>

<p class="clause">我，<strong>{{client_name}}</strong>，理解、同意并接受本协议的所有条款。</p>

<div class="sig-block">
  <div class="sig-item">
    <p class="sig-label">客户签名（SIGNED BY THE CLIENT）：</p>
    <div class="sig-box">{{client_signature}}</div>
    <p class="sig-date">日期：{{client_sign_date}}</p>
  </div>
  <div class="sig-item">
    <p class="sig-label">顾问签名（SIGNED BY ADVISER）：{{lia_name}}</p>
    <div class="sig-box">{{adviser_signature}}</div>
    <p class="sig-date">日期：{{adviser_sign_date}}</p>
  </div>
</div>

<div class="schedule">
<h2>附表一 — 客户信息</h2>
<p>客户姓氏：<strong>{{client_family_name}}</strong></p>
<p>客户名字：<strong>{{client_first_name}}</strong></p>
<p>包括在内的客户家庭成员全名：<strong>{{client_family_members}}</strong></p>
</div>

<div class="schedule">
<h2>附表二 — 申请签证类型</h2>
<p>申请签证类型：<strong>{{service_type}}</strong></p>
</div>

<div class="schedule">
<h2>附表三 — 费用</h2>
<p>总服务费用为 NZ$ <strong>{{total_service_fee}}</strong></p>
<p>费用分期付款如下：</p>
{{payment_stages_table}}
<br>
<p><strong>第三方费用</strong></p>
<p>签证费（含GST）&nbsp;&nbsp; NZ$ {{inz_application_fee}}</p>
<p>翻译费 &nbsp;&nbsp; 待定（如适用）</p>
<p>邮寄费 &nbsp;&nbsp; 待定（如适用）</p>
</div>`;

// ─── CHINESE EMPLOYER ────────────────────────────────────────────────────────

const ZH_EMPLOYER = `${STYLE}
<h1>雇主移民服务合同</h1>

<div class="parties">
<p>本合同订立于 <strong>{{date}}</strong></p>
<p><strong>甲方：</strong></p>
<p>公司名称：PJ Immigration Services Ltd<br>
持牌移民顾问：Jiale WAN；Xu ZHOU；Di WU</p>
<p><strong>乙方（客户）：</strong></p>
<p><strong>{{company_name}}</strong></p>
<p>（以下分别简称"顾问"和"客户"）</p>
</div>

<div class="whereas">
<p><strong>鉴于 甲：</strong>顾问是在新西兰执业的持牌移民咨询公司。</p>
<p><strong>鉴于 乙：</strong>客户同意聘请顾问作为其移民顾问，为本合同附表二所规定的目的提供服务。</p>
<p><strong>双方特此记录并同意如下：</strong></p>
</div>

<p class="clause-title">1. 顾问承诺：</p>
<p class="sub-clause">1.1 根据本合同附表二所述目的，向客户提供移民建议及相关服务。</p>
<p class="sub-clause">1.2 为附表二所列客户办理雇主资质认证/职位核查。</p>
<p class="sub-clause">1.3 在新西兰移民法律的范围内，实现最符合客户利益的结果。</p>
<p class="sub-clause">1.4 定期向客户通报其事务的进展情况。</p>
<p class="sub-clause">1.5 按照《2014年移民顾问管理局行为准则》行事。</p>
<p class="sub-clause">1.6 向客户提供专业及高效的服务与建议。</p>
<p class="sub-clause">1.7 告知客户新西兰移民法律、法规或政策的任何相关变化，这些变化可能影响客户申请的进展或成功。</p>

<p class="clause-title">2. 客户承诺并保证：</p>
<p class="sub-clause">2.1 其为在新西兰合法经营的企业；</p>
<p class="sub-clause">2.2 其在移民及劳工法律方面无任何违规历史；</p>
<p class="sub-clause">2.3 其对自身申请无任何未向顾问披露的不利信息；</p>
<p class="sub-clause">2.4 其将采取措施确保移民局（INZ）减少剥削风险；</p>
<p class="sub-clause">2.5 其将及时通知我们任何可能影响其申请结果或所委托服务交付的情况变化。</p>

<p class="clause-title">3. 费用：</p>
<p class="sub-clause">3.1 客户同意按照本合同附表三的规定支付服务费。</p>
<p class="sub-clause">3.2 除非另有说明，应付服务费不含GST（商品及服务税）。</p>
<p class="sub-clause">3.3 费用将在服务开始前向客户开具发票，或按照附表三所述的分期付款方式开具发票。</p>

<p class="clause-title">4. 垫付费用：</p>
<p class="sub-clause">4.1 以下垫付费用不包含在服务费中，如适用，将单独收取：</p>
<p class="sub-clause">4.2 获得职位核查或劳动力市场推广所产生的任何费用，包括人力资源成本和职位广告费用。</p>
<p class="sub-clause">4.3 独立人力资源顾问或劳动法相关咨询所需支付的费用。</p>
<p class="sub-clause">4.4 获取行业登记验证或新西兰移民目的所需职业登记的费用。</p>
<p class="sub-clause">4.5 顾问为客户提供移民服务以外的其他工作所收取的费用，例如商业或职位调查报告或培训服务。</p>

<p class="clause-title">5. 退款政策——顾问义务：</p>
<p class="clause">如顾问因自身错误或过失无法提供约定服务，将全额退还服务费。</p>

<p class="clause-title">6. 义务：</p>
<p class="clause">顾问不保证能够为客户获得相关申请，但将尽最大努力为客户取得所申请的认证。</p>

<p class="clause-title">7. 责任限制：</p>
<p class="clause">如果客户取消本协议、未满足强制性要求或被发现有违规记录，顾问仍被视为已履行其服务职责，并有权收取全部费用。</p>

<p class="clause-title">8. 终止合同：</p>
<p class="clause">任何一方均可提前十四（14）天书面通知对方终止本合同。如客户终止合同，客户须向顾问支付截至终止日期已提供的所有服务费用。</p>

<p class="clause-title">9. 退款政策——客户义务：</p>
<p class="sub-clause">9.1 如申请被拒：</p>
<p class="sub-clause">9.2 在以下情况下，将不予退款：</p>
<p class="sub-clause">a. 客户提供了不正确的信息，包括遗漏。</p>
<p class="sub-clause">b. 客户有未披露的拒签记录。</p>
<p class="sub-clause">c. 客户个人情况在服务开始后发生变化。</p>
<p class="sub-clause">d. 客户（所代表的企业）被新西兰移民局认定完全不符合移民标准。</p>
<p class="sub-clause">e. 客户改变主意、撤回申请或不愿继续办理申请。</p>
<p class="sub-clause">f. 客户未遵守本合同第2条所规定的要求。</p>
<p class="sub-clause">g. 服务开始后发生的超出PJ Immigration Services Ltd控制范围的情况。</p>
<p class="sub-clause">9.3 如客户希望终止合同，在以下情况下，将退还已付费用的 <strong>{{refund_percentage}}%</strong>：</p>
<p class="sub-clause">a. 客户没有未披露的拒签记录。</p>
<p class="sub-clause">b. 客户个人情况未发生变化。</p>
<p class="sub-clause">c. 客户未撤回其申请。</p>
<p class="sub-clause">d. 客户遵守了本合同第2条所规定的要求。</p>
<p class="sub-clause">e. 客户提供了准确的信息。</p>

<p class="clause-title">10. 投诉程序：</p>
<p class="sub-clause">10.1 PJ Immigration Services Limited建立了内部投诉处理程序。</p>
<p class="sub-clause">10.2 任何正式投诉应以书面形式直接提交给PJ Immigration Services。PJ Immigration Services将在24小时内确认收到投诉，并在14天内对事项进行调查。</p>
<p class="sub-clause">10.3 如果客户对PJ Immigration Services的答复不满意，可将投诉升级至移民顾问管理局（IAA）办公室，网址为iaa.govt.nz。</p>
<p class="sub-clause">10.4 PJ Immigration Services Limited向信誉良好的保险公司投保了赔偿保险。如投诉涉及赔偿，PJ Immigration Services将联系其保险公司寻求指导。</p>

<p class="clause-title">11. 保密：</p>
<p class="sub-clause">11.1 除非获得客户授权或法律要求，顾问不得向任何第三方披露客户的公司/个人信息。</p>
<p class="sub-clause">11.2 客户同意对顾问提供的所有信息和建议保密，未经顾问书面许可，不得向第三方披露。</p>
<p class="sub-clause">11.3 客户同意向顾问提供与其本人相关的必要个人信息，以便顾问提供咨询服务。</p>
<p class="sub-clause">11.4 客户的个人信息将根据《新西兰2020年隐私法》得到安全保管。</p>

<p class="clause-title">12. 争议：</p>
<p class="clause">因本合同引起的、双方无法协商解决的任何争议，可提交新西兰争议裁判所或移民顾问管理局办公室解决。</p>

<p class="clause-title">13. 司法管辖：</p>
<p class="clause">本合同应依据新西兰法律管辖和解释。</p>

<p class="clause-title">14. 签署：</p>
<p class="sub-clause">14.1 本合同是双方之间的完整协议，取代任何先前的协议。</p>
<p class="sub-clause">14.2 合同双方确认已阅读并理解本合同的各项条款。</p>
<p class="sub-clause">14.3 通过签署本合同，双方确认同意本合同所述的条款和条件。</p>
<p class="sub-clause">14.4 客户确认已收到所有必要的信息和文件，可以就聘请顾问作出知情决定。</p>
<p class="sub-clause">14.5 如任何一方需要修改或变更合同条款，须以书面形式进行，并由双方签署。</p>

<p class="clause">我，<strong>{{company_name}}</strong>，理解、同意并接受本协议的所有条款。</p>

<div class="sig-block">
  <div class="sig-item">
    <p class="sig-label">由 {{client_name}} 代表 {{company_name}} 签署：</p>
    <div class="sig-box">{{client_signature}}</div>
    <p class="sig-date">日期：{{client_sign_date}}</p>
  </div>
  <div class="sig-item">
    <p class="sig-label">顾问签名（SIGNED BY ADVISER）：{{lia_name}}</p>
    <div class="sig-box">{{adviser_signature}}</div>
    <p class="sig-date">日期：{{adviser_sign_date}}</p>
  </div>
</div>

<div class="schedule">
<h2>附表一 — 客户信息</h2>
<p>公司名称：<strong>{{company_name}}</strong></p>
</div>

<div class="schedule">
<h2>附表二 — 申请类型</h2>
<p>申请类型：<strong>{{service_type}}</strong></p>
</div>

<div class="schedule">
<h2>附表三 — 费用</h2>
<p>总服务费用为 $<strong>{{total_service_fee}}</strong>（不含GST）</p>
<p>费用分期付款如下：</p>
{{payment_stages_table}}
</div>`;

// ─── THAI INDIVIDUAL ──────────────────────────────────────────────────────────

const TH_INDIVIDUAL = `${STYLE}
<h1>สัญญาบริการด้านคำปรึกษาและดำเนินการวีซ่า</h1>

<div class="parties">
<p>สัญญานี้ทำขึ้นเมื่อวันที่ <strong>{{date}}</strong></p>
<p><strong>ระหว่าง:</strong></p>
<p>PJ Immigration Services Ltd, ที่ปรึกษาการตรวจคนเข้าเมืองที่มีใบอนุญาต: Jiale WAN; Xu ZHOU; Di WU<br>
<strong>และ</strong><br>
<strong>{{client_name}}</strong> ที่อยู่: {{client_address}}</p>
<p>(ต่อไปนี้เรียกว่า "ที่ปรึกษา" และ "ลูกค้า" ตามลำดับ)</p>
</div>

<div class="whereas">
<p><strong>ในขณะที่ ก:</strong> ที่ปรึกษาเป็นบริษัทที่ปรึกษาการตรวจคนเข้าเมืองที่มีใบอนุญาตซึ่งประกอบอาชีพในนิวซีแลนด์</p>
<p><strong>ในขณะที่ ข:</strong> ลูกค้าตกลงที่จะว่าจ้างที่ปรึกษาเป็นที่ปรึกษาการตรวจคนเข้าเมืองเพื่อวัตถุประสงค์ที่ระบุไว้ในตารางที่สองของสัญญานี้</p>
<p><strong>บันทึกไว้ว่าและตกลงกันว่า:</strong></p>
</div>

<p class="clause-title">1. ที่ปรึกษาตกลงจะดำเนินการ:</p>
<p class="sub-clause">1.1 ให้คำแนะนำด้านการตรวจคนเข้าเมืองและบริการที่เกี่ยวข้องแก่ลูกค้าตามวัตถุประสงค์ที่อธิบายไว้ในตารางที่สองของสัญญานี้</p>
<p class="sub-clause">1.2 ยื่นขอประเภทวีซ่าที่เกี่ยวข้องเพื่อเพิ่มโอกาสความสำเร็จของลูกค้าภายใต้กฎหมายตรวจคนเข้าเมืองของนิวซีแลนด์</p>
<p class="sub-clause">1.3 บรรลุผลลัพธ์ที่เป็นประโยชน์ต่อลูกค้ามากที่สุดภายใต้กรอบกฎหมายตรวจคนเข้าเมืองของนิวซีแลนด์</p>
<p class="sub-clause">1.4 แจ้งให้ลูกค้าทราบความคืบหน้าในเรื่องของตนเป็นประจำ</p>
<p class="sub-clause">1.5 ดำเนินการตามจรรยาบรรณของสำนักงานที่ปรึกษาการตรวจคนเข้าเมือง พ.ศ. 2557</p>
<p class="sub-clause">1.6 ให้บริการและคำแนะนำที่เป็นมืออาชีพและรวดเร็วแก่ลูกค้า</p>
<p class="sub-clause">1.7 แจ้งให้ลูกค้าทราบเกี่ยวกับการเปลี่ยนแปลงที่เกี่ยวข้องในกฎหมาย กฎระเบียบ หรือนโยบายของการตรวจคนเข้าเมืองนิวซีแลนด์ ซึ่งอาจส่งผลต่อความก้าวหน้าหรือความสำเร็จของการยื่นคำขอของลูกค้า</p>

<p class="clause-title">2. ลูกค้าให้คำมั่นสัญญาและรับประกันว่า:</p>
<p class="sub-clause">2.1 ไม่ทราบว่ามีสิ่งใดที่ไม่เป็นผลดีเกี่ยวกับลักษณะนิสัย สุขภาพ หรือประวัติวีซ่า/ใบอนุญาตที่ยังไม่ได้เปิดเผยให้ที่ปรึกษาทราบ</p>
<p class="sub-clause">2.2 จะให้ข้อมูลและเอกสารที่ครบถ้วนแก่ที่ปรึกษาตามที่จำเป็นหรือต้องการ</p>
<p class="sub-clause">2.3 จะแจ้งให้ที่ปรึกษาทราบเกี่ยวกับการเปลี่ยนแปลงที่เกี่ยวข้องในสถานการณ์ของตน (ซึ่งอาจส่งผลต่อการยื่นคำขอหรือการให้บริการตามที่ว่าจ้าง)</p>
<p class="sub-clause">2.4 จะไม่ว่าจ้างที่ปรึกษาการตรวจคนเข้าเมือง ทนายความ หรือนักกฎหมายรายอื่นเพื่อจัดการเรื่องที่ครอบคลุมโดยสัญญานี้ตลอดระยะเวลาของสัญญา เว้นแต่จะตกลงกันเป็นลายลักษณ์อักษร</p>
<p class="sub-clause">2.5 จะไม่ดำเนินการใดๆ เกี่ยวกับการตรวจคนเข้าเมือง หรือยื่นแบบฟอร์มหรือเอกสารการตรวจคนเข้าเมืองใดๆ โดยไม่แจ้งให้ที่ปรึกษาทราบและได้รับความยินยอม</p>

<p class="clause-title">3. ค่าธรรมเนียม:</p>
<p class="sub-clause">3.1 ลูกค้าตกลงชำระค่าธรรมเนียมบริการตามที่กำหนดไว้ในตารางที่สามของสัญญานี้</p>
<p class="sub-clause">3.2 ค่าธรรมเนียมบริการที่ต้องชำระไม่รวม GST เว้นแต่จะระบุไว้เป็นอย่างอื่น</p>
<p class="sub-clause">3.3 ค่าธรรมเนียมจะออกใบแจ้งหนี้ให้ลูกค้าก่อนเริ่มให้บริการหรือตามแผนการชำระเงินเป็นงวดตามที่ระบุไว้ในตารางที่สาม</p>

<p class="clause-title">4. ค่าใช้จ่ายเพิ่มเติม:</p>
<p class="sub-clause">4.1 ค่าใช้จ่ายเพิ่มเติมต่อไปนี้ไม่รวมอยู่ในค่าธรรมเนียมบริการและจะเรียกเก็บแยกต่างหากหากมีการใช้บริการ:</p>
<p class="sub-clause">4.2 ค่าธรรมเนียมการยื่นขอที่รัฐบาลที่ Immigration New Zealand กำหนด</p>
<p class="sub-clause">4.3 ค่าธรรมเนียมสำหรับการตรวจร่างกาย เอกซ์เรย์ รายงาน หรือใบรับรองอิสระที่จำเป็นสำหรับการตรวจคนเข้าเมืองของนิวซีแลนด์</p>
<p class="sub-clause">4.4 ค่าธรรมเนียมสำหรับหลักสูตรการทดสอบภาษาอังกฤษ การสอบ หรือใบรับรองที่จำเป็นสำหรับการตรวจคนเข้าเมืองของนิวซีแลนด์</p>
<p class="sub-clause">4.5 ค่าธรรมเนียมสำหรับการตรวจสอบคุณสมบัติ หรือการลงทะเบียนอาชีพหากจำเป็นสำหรับการตรวจคนเข้าเมืองของนิวซีแลนด์</p>
<p class="sub-clause">4.6 ค่าธรรมเนียมสำหรับงานที่ที่ปรึกษาดำเนินการให้ลูกค้านอกเหนือจากบริการตรวจคนเข้าเมือง เช่น การสืบสวนและรายงานการจ้างงานหรือรายได้ หรือบริการฝึกอบรม</p>

<p class="clause-title">5. นโยบายการคืนเงิน — ภาระหน้าที่ของที่ปรึกษา:</p>
<p class="clause">หากที่ปรึกษาไม่สามารถให้บริการตามที่ตกลงกันเนื่องจากข้อผิดพลาดหรือความผิดของที่ปรึกษา จะคืนเงินค่าธรรมเนียมบริการทั้งหมด</p>

<p class="clause-title">6. ภาระผูกพัน:</p>
<p class="clause">ที่ปรึกษาไม่รับประกันว่าการยื่นขอวีซ่าจะได้รับการอนุมัติสำหรับลูกค้า แต่จะใช้ความพยายามอย่างดีที่สุดเพื่อให้ได้วีซ่าที่เกี่ยวข้อง</p>

<p class="clause-title">7. การจำกัดความรับผิด:</p>
<p class="clause">หากลูกค้าไม่ผ่านการตรวจสุขภาพ หรือพบว่ามีความสามารถทางภาษาอังกฤษไม่เพียงพอ หรือมีประวัติอาชญากรรม ที่ปรึกษาจะถือว่าได้ปฏิบัติหน้าที่ครบถ้วนแล้ว และมีสิทธิ์รับค่าธรรมเนียมบริการเต็มจำนวน</p>

<p class="clause-title">8. การบอกเลิกสัญญา:</p>
<p class="clause">ฝ่ายใดฝ่ายหนึ่งสามารถบอกเลิกสัญญานี้ได้โดยแจ้งเป็นลายลักษณ์อักษรล่วงหน้าสิบสี่ (14) วัน หากลูกค้าบอกเลิกสัญญา ลูกค้าต้องรับผิดชอบชำระค่าบริการทั้งหมดที่ได้ให้บริการไปจนถึงวันที่บอกเลิก</p>

<p class="clause-title">9. นโยบายการคืนเงิน — ภาระหน้าที่ของลูกค้า:</p>
<p class="sub-clause">9.1 หากการยื่นขอวีซ่าถูกปฏิเสธ:</p>
<p class="sub-clause">9.2 จะไม่คืนเงินให้ลูกค้าหาก:</p>
<p class="sub-clause">ก. ลูกค้าให้ข้อมูลที่ไม่ถูกต้อง รวมถึงการละเว้นข้อมูลโดยลูกค้า</p>
<p class="sub-clause">ข. ลูกค้ามีประวัติการปฏิเสธวีซ่าที่ยังไม่ได้เปิดเผย</p>
<p class="sub-clause">ค. สถานการณ์ส่วนตัวของลูกค้าเปลี่ยนแปลงหลังจากเริ่มให้บริการ</p>
<p class="sub-clause">ง. ลูกค้าได้รับการพิจารณาจาก Immigration New Zealand ว่าไม่ผ่านมาตรฐานขั้นต่ำสำหรับการยื่นขอวีซ่า</p>
<p class="sub-clause">จ. ลูกค้าเปลี่ยนใจ ถอนคำขอ หรือไม่ต้องการดำเนินการยื่นขอต่อ</p>
<p class="sub-clause">ฉ. ลูกค้าไม่ปฏิบัติตามข้อกำหนดตามที่ระบุไว้ในข้อ 2 ของสัญญานี้</p>
<p class="sub-clause">ช. สถานการณ์ที่อยู่นอกเหนือการควบคุมของ PJ Immigration Services Ltd ที่เกิดขึ้นหลังจากเริ่มให้บริการ</p>
<p class="sub-clause">9.3 หากลูกค้าต้องการบอกเลิกสัญญา จะคืนเงิน <strong>{{refund_percentage}}%</strong> ของค่าธรรมเนียมที่ชำระแล้วหาก:</p>
<p class="sub-clause">ก. ลูกค้าไม่มีประวัติการปฏิเสธวีซ่าที่ยังไม่ได้เปิดเผย</p>
<p class="sub-clause">ข. สถานการณ์ส่วนตัวของลูกค้าไม่มีการเปลี่ยนแปลง</p>
<p class="sub-clause">ค. ลูกค้าไม่ได้ถอนคำขอ</p>
<p class="sub-clause">ง. ลูกค้าปฏิบัติตามข้อกำหนดตามที่ระบุไว้ในข้อ 2 ของสัญญานี้</p>
<p class="sub-clause">จ. ลูกค้าให้ข้อมูลที่ถูกต้อง</p>

<p class="clause-title">10. ขั้นตอนการร้องเรียน:</p>
<p class="sub-clause">10.1 PJ Immigration Services Limited มีขั้นตอนการจัดการข้อร้องเรียนภายใน</p>
<p class="sub-clause">10.2 ข้อร้องเรียนอย่างเป็นทางการควรส่งเป็นลายลักษณ์อักษรโดยตรงถึง PJ Immigration Services PJ Immigration Services จะรับทราบข้อร้องเรียนภายใน 24 ชั่วโมงและสอบสวนเรื่องดังกล่าวภายใน 14 วัน</p>
<p class="sub-clause">10.3 หากลูกค้าไม่พอใจกับคำตอบจาก PJ Immigration Services ลูกค้าสามารถยกระดับข้อร้องเรียนไปยังสำนักงาน Immigration Adviser Authority (IAA) ที่ iaa.govt.nz</p>
<p class="sub-clause">10.4 PJ Immigration Services Limited มีกรมธรรม์ประกันภัยค่าชดเชยกับบริษัทประกันภัยที่มีชื่อเสียง หากข้อร้องเรียนเกี่ยวข้องกับการชำระค่าชดเชย PJ Immigration Services จะติดต่อบริษัทประกันภัยเพื่อขอคำแนะนำ</p>

<p class="clause-title">11. การรักษาความลับ:</p>
<p class="sub-clause">11.1 ที่ปรึกษาต้องไม่เปิดเผยข้อมูลส่วนตัวหรือข้อมูลทางการเงินของลูกค้าต่อบุคคลที่สาม เว้นแต่จะได้รับอนุญาตจากลูกค้าหรือกฎหมายกำหนด</p>
<p class="sub-clause">11.2 ลูกค้าตกลงที่จะเก็บรักษาข้อมูลและคำแนะนำทั้งหมดที่ที่ปรึกษาให้ไว้เป็นความลับ และจะไม่เปิดเผยข้อมูลดังกล่าวต่อบุคคลที่สามโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษรจากที่ปรึกษา</p>
<p class="sub-clause">11.3 ลูกค้าตกลงที่จะเปิดเผยข้อมูลส่วนตัวที่เกี่ยวข้องเกี่ยวกับตนเองต่อที่ปรึกษาเพื่อวัตถุประสงค์ในการให้คำแนะนำ</p>
<p class="sub-clause">11.4 ข้อมูลส่วนตัวของลูกค้าจะถูกเก็บรักษาอย่างปลอดภัยและสอดคล้องกับพระราชบัญญัติความเป็นส่วนตัวของนิวซีแลนด์ พ.ศ. 2563</p>

<p class="clause-title">12. ข้อพิพาท:</p>
<p class="clause">ข้อพิพาทใดๆ ที่เกิดจากสัญญานี้ซึ่งทั้งสองฝ่ายไม่สามารถแก้ไขได้ อาจส่งไปยังศาลพิพาทของนิวซีแลนด์ หรือสำนักงาน Immigration Adviser Authority</p>

<p class="clause-title">13. เขตอำนาจศาล:</p>
<p class="clause">สัญญานี้จะอยู่ภายใต้การควบคุมและตีความตามกฎหมายของนิวซีแลนด์</p>

<p class="clause-title">14. ลายเซ็น:</p>
<p class="sub-clause">14.1 สัญญานี้เป็นข้อตกลงทั้งหมดระหว่างคู่สัญญาและมีผลเหนือข้อตกลงก่อนหน้าใดๆ</p>
<p class="sub-clause">14.2 คู่สัญญาในสัญญานี้ยืนยันว่าได้อ่านและเข้าใจข้อกำหนดของสัญญานี้แล้ว</p>
<p class="sub-clause">14.3 โดยการลงนามในสัญญานี้ ทั้งสองฝ่ายยืนยันว่าตกลงตามข้อกำหนดและเงื่อนไขที่ระบุไว้ในนี้</p>
<p class="sub-clause">14.4 ลูกค้ายืนยันว่าได้รับข้อมูลและเอกสารที่จำเป็นทั้งหมดเพื่อตัดสินใจอย่างรอบรู้เกี่ยวกับการว่าจ้างที่ปรึกษา</p>
<p class="sub-clause">14.5 หากฝ่ายใดฝ่ายหนึ่งต้องการแก้ไขหรือเปลี่ยนแปลงข้อกำหนดของสัญญา ต้องดำเนินการเป็นลายลักษณ์อักษรและลงนามโดยทั้งสองฝ่าย</p>

<p class="clause">ข้าพเจ้า <strong>{{client_name}}</strong> เข้าใจ ยอมรับ และตกลงตามเงื่อนไขทั้งหมดที่ระบุในสัญญาข้อตกลงฉบับนี้</p>

<div class="sig-block">
  <div class="sig-item">
    <p class="sig-label">ลงนามโดยลูกค้า (SIGNED BY THE CLIENT):</p>
    <div class="sig-box">{{client_signature}}</div>
    <p class="sig-date">วันที่: {{client_sign_date}}</p>
  </div>
  <div class="sig-item">
    <p class="sig-label">ลงนามโดยที่ปรึกษา (SIGNED BY ADVISER): {{lia_name}}</p>
    <div class="sig-box">{{adviser_signature}}</div>
    <p class="sig-date">วันที่: {{adviser_sign_date}}</p>
  </div>
</div>

<div class="schedule">
<h2>ตารางที่หนึ่ง — ข้อมูลส่วนบุคคลของลูกค้า</h2>
<p>นามสกุลของลูกค้า: <strong>{{client_family_name}}</strong></p>
<p>ชื่อจริงของลูกค้า: <strong>{{client_first_name}}</strong></p>
<p>ชื่อเต็มของสมาชิกครอบครัวของลูกค้าที่รวมอยู่ในใบสมัคร: <strong>{{client_family_members}}</strong></p>
</div>

<div class="schedule">
<h2>ตารางที่สอง — ประเภทของวีซ่าที่ต้องการยื่น</h2>
<p>ประเภทของวีซ่าที่ต้องการยื่น: <strong>{{service_type}}</strong></p>
</div>

<div class="schedule">
<h2>ตารางที่สาม — ค่าธรรมเนียม</h2>
<p>ค่าธรรมเนียมบริการทั้งหมดคือ NZ$ <strong>{{total_service_fee}}</strong></p>
<p>ค่าธรรมเนียมทั้งหมดจะชำระดังต่อไปนี้:</p>
{{payment_stages_table}}
<br>
<p><strong>ค่าใช้จ่ายเพิ่มเติมที่เกี่ยวข้อง</strong></p>
<p>ค่าธรรมเนียมการยื่นใบสมัครกับ INZ (รวมภาษี GST) &nbsp;&nbsp; NZ$ {{inz_application_fee}}</p>
<p>ค่าบริการแปลเอกสาร &nbsp;&nbsp; รายละเอียดจะแจ้งให้ทราบภายหลัง</p>
<p>ค่าจัดส่งเอกสาร &nbsp;&nbsp; รายละเอียดจะแจ้งให้ทราบภายหลัง</p>
</div>`;

// ─── THAI EMPLOYER ────────────────────────────────────────────────────────────

const TH_EMPLOYER = `${STYLE}
<h1>สัญญาบริการด้านคำปรึกษาและดำเนินการสำหรับนายจ้าง</h1>

<div class="parties">
<p>สัญญานี้ทำขึ้นเมื่อวันที่ <strong>{{date}}</strong></p>
<p><strong>ระหว่าง:</strong></p>
<p>PJ Immigration Services Ltd, ที่ปรึกษาการตรวจคนเข้าเมืองที่มีใบอนุญาต: Jiale WAN; Xu ZHOU; Di WU<br>
<strong>และ</strong><br>
<strong>{{company_name}}</strong></p>
<p>(ต่อไปนี้เรียกว่า "ที่ปรึกษา" และ "ลูกค้า" ตามลำดับ)</p>
</div>

<div class="whereas">
<p><strong>ในขณะที่ ก:</strong> ที่ปรึกษาเป็นบริษัทที่ปรึกษาการตรวจคนเข้าเมืองที่มีใบอนุญาตซึ่งประกอบอาชีพในนิวซีแลนด์</p>
<p><strong>ในขณะที่ ข:</strong> ลูกค้าตกลงที่จะว่าจ้างที่ปรึกษาเป็นที่ปรึกษาการตรวจคนเข้าเมืองเพื่อวัตถุประสงค์ที่ระบุไว้ในตารางที่สองของสัญญานี้</p>
<p><strong>บันทึกไว้ว่าและตกลงกันว่า:</strong></p>
</div>

<p class="clause-title">1. ที่ปรึกษาตกลงจะดำเนินการ:</p>
<p class="sub-clause">1.1 ให้คำแนะนำด้านการตรวจคนเข้าเมืองและบริการที่เกี่ยวข้องแก่ลูกค้าตามวัตถุประสงค์ที่อธิบายไว้ในตารางที่สองของสัญญานี้</p>
<p class="sub-clause">1.2 ดำเนินการขอการรับรองนายจ้าง/ตรวจสอบงานสำหรับลูกค้าที่ระบุไว้ในตารางที่สอง</p>
<p class="sub-clause">1.3 บรรลุผลลัพธ์ที่เป็นประโยชน์ต่อลูกค้ามากที่สุดภายใต้กรอบกฎหมายตรวจคนเข้าเมืองของนิวซีแลนด์</p>
<p class="sub-clause">1.4 แจ้งให้ลูกค้าทราบความคืบหน้าในเรื่องของตนเป็นประจำ</p>
<p class="sub-clause">1.5 ดำเนินการตามจรรยาบรรณของสำนักงานที่ปรึกษาการตรวจคนเข้าเมือง พ.ศ. 2557</p>
<p class="sub-clause">1.6 ให้บริการและคำแนะนำที่เป็นมืออาชีพและรวดเร็วแก่ลูกค้า</p>
<p class="sub-clause">1.7 แจ้งให้ลูกค้าทราบเกี่ยวกับการเปลี่ยนแปลงที่เกี่ยวข้องในกฎหมาย กฎระเบียบ หรือนโยบายของการตรวจคนเข้าเมืองนิวซีแลนด์</p>

<p class="clause-title">2. ลูกค้าให้คำมั่นสัญญาและรับประกันว่า:</p>
<p class="sub-clause">2.1 พวกเขาเป็นธุรกิจที่ดำเนินการอย่างถูกต้องตามกฎหมายในประเทศนิวซีแลนด์</p>
<p class="sub-clause">2.2 พวกเขาไม่มีประวัติการไม่ปฏิบัติตามกฎหมายด้านตรวจคนเข้าเมืองและกฎหมายแรงงาน</p>
<p class="sub-clause">2.3 พวกเขาไม่ทราบว่ามีสิ่งใดที่ไม่เป็นผลดีเกี่ยวกับการยื่นขอที่ยังไม่ได้เปิดเผยให้ที่ปรึกษาทราบ</p>
<p class="sub-clause">2.4 พวกเขาจะดำเนินการเพื่อให้ INZ ลดความเสี่ยงในการแสวงประโยชน์</p>
<p class="sub-clause">2.5 พวกเขาจะแจ้งให้เราทราบเกี่ยวกับการเปลี่ยนแปลงที่เกี่ยวข้องในสถานการณ์ซึ่งอาจส่งผลต่อการยื่นขอหรือการให้บริการ</p>

<p class="clause-title">3. ค่าธรรมเนียม:</p>
<p class="sub-clause">3.1 ลูกค้าตกลงชำระค่าธรรมเนียมบริการตามที่กำหนดไว้ในตารางที่สามของสัญญานี้</p>
<p class="sub-clause">3.2 ค่าธรรมเนียมบริการที่ต้องชำระไม่รวม GST เว้นแต่จะระบุไว้เป็นอย่างอื่น</p>
<p class="sub-clause">3.3 ค่าธรรมเนียมจะออกใบแจ้งหนี้ให้ลูกค้าก่อนเริ่มให้บริการหรือตามแผนการชำระเงินเป็นงวด</p>

<p class="clause-title">4. ค่าใช้จ่ายเพิ่มเติม:</p>
<p class="sub-clause">4.1 ค่าใช้จ่ายเพิ่มเติมต่อไปนี้ไม่รวมอยู่ในค่าธรรมเนียมบริการและจะเรียกเก็บแยกต่างหาก:</p>
<p class="sub-clause">4.2 ค่าใช้จ่ายในการขอตรวจสอบงานหรือการตลาดแรงงาน รวมถึงค่าใช้จ่ายด้านทรัพยากรมนุษย์และการโฆษณาตำแหน่งงานว่าง</p>
<p class="sub-clause">4.3 ค่าธรรมเนียมสำหรับที่ปรึกษาทรัพยากรมนุษย์อิสระหรือการปรึกษาที่เกี่ยวข้องกับกฎหมายการจ้างงาน</p>
<p class="sub-clause">4.4 ค่าใช้จ่ายในการตรวจสอบการจดทะเบียนอุตสาหกรรม หรือการลงทะเบียนอาชีพ</p>
<p class="sub-clause">4.5 ค่าธรรมเนียมสำหรับงานที่ที่ปรึกษาดำเนินการให้ลูกค้านอกเหนือจากบริการตรวจคนเข้าเมือง เช่น การสืบสวนธุรกิจหรืองาน รายงาน หรือบริการฝึกอบรม</p>

<p class="clause-title">5. นโยบายการคืนเงิน — ภาระหน้าที่ของที่ปรึกษา:</p>
<p class="clause">หากที่ปรึกษาไม่สามารถให้บริการตามที่ตกลงกันเนื่องจากข้อผิดพลาดหรือความผิดของที่ปรึกษา จะคืนเงินค่าธรรมเนียมบริการทั้งหมด</p>

<p class="clause-title">6. ภาระผูกพัน:</p>
<p class="clause">ที่ปรึกษาไม่รับประกันว่าการยื่นขอจะได้รับการอนุมัติสำหรับลูกค้า แต่จะใช้ความพยายามอย่างดีที่สุดเพื่อให้ได้รับการอนุมัติ</p>

<p class="clause-title">7. การจำกัดความรับผิด:</p>
<p class="clause">หากลูกค้ายกเลิกข้อตกลงฉบับนี้ หรือล้มเหลวในการผ่านเงื่อนไขข้อกำหนดที่จำเป็น หรือถูกพบว่ามีประวัติการไม่ปฏิบัติตามกฎหมาย ที่ปรึกษายังถือว่าได้ให้บริการตามที่ตกลงไว้อย่างครบถ้วน และมีสิทธิ์เรียกเก็บค่าบริการเต็มจำนวน</p>

<p class="clause-title">8. การบอกเลิกสัญญา:</p>
<p class="clause">ฝ่ายใดฝ่ายหนึ่งสามารถบอกเลิกสัญญานี้ได้โดยแจ้งเป็นลายลักษณ์อักษรล่วงหน้าสิบสี่ (14) วัน หากลูกค้าบอกเลิกสัญญา ลูกค้าต้องรับผิดชอบชำระค่าบริการทั้งหมดที่ได้ให้บริการไปจนถึงวันที่บอกเลิก</p>

<p class="clause-title">9. นโยบายการคืนเงิน — ภาระหน้าที่ของลูกค้า:</p>
<p class="sub-clause">9.1 หากการยื่นขอถูกปฏิเสธ:</p>
<p class="sub-clause">9.2 จะไม่คืนเงินให้ลูกค้าหาก:</p>
<p class="sub-clause">ก. ลูกค้าให้ข้อมูลที่ไม่ถูกต้อง รวมถึงการละเว้นข้อมูล</p>
<p class="sub-clause">ข. ลูกค้ามีประวัติที่ยังไม่ได้เปิดเผย</p>
<p class="sub-clause">ค. สถานการณ์ของลูกค้าเปลี่ยนแปลงหลังจากเริ่มให้บริการ</p>
<p class="sub-clause">ง. ลูกค้า (ธุรกิจที่เป็นตัวแทน) ถูกพิจารณาโดย Immigration New Zealand ว่าไม่เหมาะสมที่จะผ่านมาตรฐานการตรวจคนเข้าเมือง</p>
<p class="sub-clause">จ. ลูกค้าเปลี่ยนใจ ถอนคำขอ หรือไม่ต้องการดำเนินการต่อ</p>
<p class="sub-clause">ฉ. ลูกค้าไม่ปฏิบัติตามข้อกำหนดตามที่ระบุไว้ในข้อ 2 ของสัญญานี้</p>
<p class="sub-clause">ช. สถานการณ์ที่อยู่นอกเหนือการควบคุมของ PJ Immigration Services Ltd ที่เกิดขึ้นหลังจากเริ่มให้บริการ</p>
<p class="sub-clause">9.3 หากลูกค้าต้องการบอกเลิกสัญญา จะคืนเงิน <strong>{{refund_percentage}}%</strong> ของค่าธรรมเนียมที่ชำระแล้วหาก:</p>
<p class="sub-clause">ก. ลูกค้าไม่มีประวัติที่ยังไม่ได้เปิดเผย</p>
<p class="sub-clause">ข. สถานการณ์ของลูกค้าไม่มีการเปลี่ยนแปลง</p>
<p class="sub-clause">ค. ลูกค้าไม่ได้ถอนคำขอ</p>
<p class="sub-clause">ง. ลูกค้าปฏิบัติตามข้อกำหนดตามที่ระบุไว้ในข้อ 2 ของสัญญานี้</p>
<p class="sub-clause">จ. ลูกค้าให้ข้อมูลที่ถูกต้อง</p>

<p class="clause-title">10. ขั้นตอนการร้องเรียน:</p>
<p class="sub-clause">10.1 PJ Immigration Services Limited มีขั้นตอนการจัดการข้อร้องเรียนภายใน</p>
<p class="sub-clause">10.2 ข้อร้องเรียนอย่างเป็นทางการควรส่งเป็นลายลักษณ์อักษรโดยตรงถึง PJ Immigration Services และจะได้รับการตอบรับภายใน 24 ชั่วโมงและสอบสวนภายใน 14 วัน</p>
<p class="sub-clause">10.3 หากลูกค้าไม่พอใจ สามารถยกระดับไปยัง IAA ที่ iaa.govt.nz</p>
<p class="sub-clause">10.4 PJ Immigration Services Limited มีกรมธรรม์ประกันภัยค่าชดเชยกับบริษัทประกันภัยที่มีชื่อเสียง</p>

<p class="clause-title">11. การรักษาความลับ:</p>
<p class="sub-clause">11.1 ที่ปรึกษาต้องไม่เปิดเผยข้อมูลส่วนตัวหรือข้อมูลทางการเงินของลูกค้าต่อบุคคลที่สาม เว้นแต่จะได้รับอนุญาตหรือกฎหมายกำหนด</p>
<p class="sub-clause">11.2 ลูกค้าตกลงที่จะเก็บรักษาข้อมูลและคำแนะนำทั้งหมดเป็นความลับ</p>
<p class="sub-clause">11.3 ลูกค้าตกลงที่จะเปิดเผยข้อมูลส่วนตัวที่เกี่ยวข้องต่อที่ปรึกษาเพื่อวัตถุประสงค์ในการให้คำแนะนำ</p>
<p class="sub-clause">11.4 ข้อมูลส่วนตัวของลูกค้าจะถูกเก็บรักษาอย่างปลอดภัยตามพระราชบัญญัติความเป็นส่วนตัวของนิวซีแลนด์ พ.ศ. 2563</p>

<p class="clause-title">12. ข้อพิพาท:</p>
<p class="clause">ข้อพิพาทใดๆ ที่เกิดจากสัญญานี้ซึ่งทั้งสองฝ่ายไม่สามารถแก้ไขได้ อาจส่งไปยังศาลพิพาทของนิวซีแลนด์ หรือสำนักงาน Immigration Adviser Authority</p>

<p class="clause-title">13. เขตอำนาจศาล:</p>
<p class="clause">สัญญานี้จะอยู่ภายใต้การควบคุมและตีความตามกฎหมายของนิวซีแลนด์</p>

<p class="clause-title">14. ลายเซ็น:</p>
<p class="sub-clause">14.1 สัญญานี้เป็นข้อตกลงทั้งหมดระหว่างคู่สัญญาและมีผลเหนือข้อตกลงก่อนหน้าใดๆ</p>
<p class="sub-clause">14.2 คู่สัญญาในสัญญานี้ยืนยันว่าได้อ่านและเข้าใจข้อกำหนดของสัญญานี้แล้ว</p>
<p class="sub-clause">14.3 โดยการลงนามในสัญญานี้ ทั้งสองฝ่ายยืนยันว่าตกลงตามข้อกำหนดและเงื่อนไข</p>
<p class="sub-clause">14.4 ลูกค้ายืนยันว่าได้รับข้อมูลและเอกสารที่จำเป็นทั้งหมดเพื่อตัดสินใจอย่างรอบรู้</p>
<p class="sub-clause">14.5 หากฝ่ายใดฝ่ายหนึ่งต้องการแก้ไขข้อกำหนด ต้องดำเนินการเป็นลายลักษณ์อักษรและลงนามโดยทั้งสองฝ่าย</p>

<p class="clause">ข้าพเจ้า <strong>{{company_name}}</strong> เข้าใจ ยอมรับ และตกลงตามเงื่อนไขทั้งหมดที่ระบุในสัญญาข้อตกลงฉบับนี้</p>

<div class="sig-block">
  <div class="sig-item">
    <p class="sig-label">ลงนามโดย {{client_name}} ในนามของ {{company_name}}:</p>
    <div class="sig-box">{{client_signature}}</div>
    <p class="sig-date">วันที่: {{client_sign_date}}</p>
  </div>
  <div class="sig-item">
    <p class="sig-label">ลงนามโดยที่ปรึกษา (SIGNED BY ADVISER): {{lia_name}}</p>
    <div class="sig-box">{{adviser_signature}}</div>
    <p class="sig-date">วันที่: {{adviser_sign_date}}</p>
  </div>
</div>

<div class="schedule">
<h2>ตารางที่หนึ่ง — ข้อมูลของลูกค้า</h2>
<p>ชื่อบริษัท: <strong>{{company_name}}</strong></p>
</div>

<div class="schedule">
<h2>ตารางที่สอง — ประเภทของใบสมัครที่ต้องยื่น</h2>
<p>ประเภทของใบสมัครที่ต้องยื่น: <strong>{{service_type}}</strong></p>
</div>

<div class="schedule">
<h2>ตารางที่สาม — ค่าธรรมเนียม</h2>
<p>ค่าบริการทั้งหมด $<strong>{{total_service_fee}}</strong> (ไม่รวมภาษี GST)</p>
<p>ค่าธรรมเนียมทั้งหมดจะชำระดังต่อไปนี้:</p>
{{payment_stages_table}}
</div>`;

// ─── Template records ─────────────────────────────────────────────────────────

export const CONTRACT_TEMPLATES = [
  {
    name: "Individual Visa Service Agreement (English)",
    language: "en",
    target_type: "individual",
    content: EN_INDIVIDUAL,
    is_active: true,
  },
  {
    name: "Employer Immigration Services Agreement (English)",
    language: "en",
    target_type: "company",
    content: EN_EMPLOYER,
    is_active: true,
  },
  {
    name: "签证移民服务合同（个人）",
    language: "zh",
    target_type: "individual",
    content: ZH_INDIVIDUAL,
    is_active: true,
  },
  {
    name: "雇主移民服务合同（公司）",
    language: "zh",
    target_type: "company",
    content: ZH_EMPLOYER,
    is_active: true,
  },
  {
    name: "สัญญาบริการวีซ่า (บุคคลธรรมดา)",
    language: "th",
    target_type: "individual",
    content: TH_INDIVIDUAL,
    is_active: true,
  },
  {
    name: "สัญญาบริการสำหรับนายจ้าง",
    language: "th",
    target_type: "company",
    content: TH_EMPLOYER,
    is_active: true,
  },
];

// Insert function for use in seed route
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertContractTemplates(supabase: any) {
  // Delete all existing templates to avoid duplicates on re-seed
  await supabase.from("contract_templates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase.from("contract_templates").insert(CONTRACT_TEMPLATES);
  return error;
}
