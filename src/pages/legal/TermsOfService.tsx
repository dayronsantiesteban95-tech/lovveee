/**
 * -----------------------------------------------------------
 * TERMS OF SERVICE / EULA -- Public Legal Page
 *
 * Route: /legal/terms
 * No auth required. Fully public.
 * -----------------------------------------------------------
 */
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowLeft, Truck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const EFFECTIVE_DATE = "February 19, 2026";
const COMPANY = "Anika Logistics LLC";
const CONTACT_EMAIL = "info@anikalogistics.com";
const GOVERNING_STATE = "State of Arizona";

function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* -- Header -- */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="h-5 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Truck className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">{COMPANY}</span>
          </div>
        </div>
      </header>

      {/* -- Body -- */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Title block */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
              Legal
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Terms of Service &amp; End User License Agreement
          </h1>
          <p className="text-gray-500 text-sm">
            Effective Date: <strong>{EFFECTIVE_DATE}</strong>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Last updated: <strong>{EFFECTIVE_DATE}</strong>
          </p>
          <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
            <strong>PLEASE READ THESE TERMS CAREFULLY.</strong> By accessing or using the Anika
            Control OS platform ("Service"), you agree to be bound by these Terms of Service and
            End User License Agreement ("Agreement"). If you do not agree, do not use the Service.
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10 text-gray-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              1. Parties &amp; Agreement
            </h2>
            <p className="mb-3">
              This Agreement is entered into between <strong>{COMPANY}</strong> ("Company,"
              "we," "us," or "our"), a limited liability company, and you ("User," "you," or
              "your") -- whether an individual accessing the Service on your own behalf or an
              authorized representative accessing on behalf of an organization.
            </p>
            <p>
              By creating an account, accessing the platform, or using any feature of the
              Service, you represent that you have the legal authority to enter into this
              Agreement, either personally or on behalf of the organization you represent.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              2. Service Description
            </h2>
            <p className="mb-3">
              Anika Control OS is a proprietary logistics dispatch software platform that provides:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600 mb-4">
              <li>Real-time dispatch management and job assignment</li>
              <li>Driver location tracking and fleet monitoring</li>
              <li>Proof of delivery (POD) capture and management</li>
              <li>Time clock and driver performance tracking</li>
              <li>Rate calculation and billing management</li>
              <li>QuickBooks Online integration for invoicing</li>
              <li>Customer delivery tracking portal</li>
              <li>Standard operating procedure (SOP) documentation tools</li>
              <li>Team and role management</li>
            </ul>
            <p>
              We reserve the right to modify, enhance, suspend, or discontinue any feature of the
              Service at any time with reasonable notice to active users.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              3. License Grant
            </h2>
            <p className="mb-3">
              Subject to your compliance with this Agreement and timely payment of any applicable
              fees, {COMPANY} grants you a limited, non-exclusive, non-transferable,
              non-sublicensable, revocable license to access and use the Service solely for your
              internal business operations.
            </p>
            <p className="mb-3">This license does <strong>not</strong> permit you to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600">
              <li>Copy, modify, or create derivative works of the Service or its underlying code</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Resell, sublicense, or otherwise commercialize the Service to third parties</li>
              <li>Use the Service to build a competing product or service</li>
              <li>Remove or alter any proprietary notices within the Service</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              4. User Obligations
            </h2>
            <p className="mb-4">
              By using the Service, you agree to the following obligations:
            </p>

            <h3 className="font-semibold text-gray-900 mb-2">4.1 Accurate Information</h3>
            <p className="mb-4">
              You agree to provide accurate, current, and complete information when creating your
              account and using the Service. You are responsible for keeping your account
              information up to date.
            </p>

            <h3 className="font-semibold text-gray-900 mb-2">4.2 Account Security</h3>
            <p className="mb-4">
              You are responsible for maintaining the confidentiality of your account credentials.
              You must immediately notify us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                {CONTACT_EMAIL}
              </a>{" "}
              of any unauthorized access to or use of your account.
            </p>

            <h3 className="font-semibold text-gray-900 mb-2">4.3 Acceptable Use</h3>
            <p className="mb-3">You agree NOT to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600 mb-4">
              <li>Violate any applicable local, state, federal, or international law or regulation</li>
              <li>Transmit any unauthorized, unsolicited, or harmful data or communications</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its systems</li>
              <li>Upload or transmit malicious code, viruses, or destructive programs</li>
              <li>Harass, abuse, or harm any person in connection with use of the Service</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mb-2">4.4 Driver Consent</h3>
            <p>
              If you use the Service to track driver locations, you represent and warrant that you
              have obtained all necessary consents from your drivers in accordance with applicable
              employment and privacy laws. You bear sole responsibility for compliance with
              applicable labor and privacy regulations.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              5. Intellectual Property
            </h2>
            <p className="mb-3">
              All rights, title, and interest in and to the Service -- including but not limited to
              software code, algorithms, user interface design, branding, logos, documentation,
              and all related intellectual property -- are and will remain the exclusive property
              of <strong>{COMPANY}</strong> and its licensors.
            </p>
            <p className="mb-3">
              This Agreement does not transfer any ownership rights to you. The "Anika Control OS,"
              "Anika Logistics," and related marks are trademarks of {COMPANY}. You may not use
              these marks without our prior written consent.
            </p>
            <p>
              <strong>Your Data:</strong> You retain ownership of all data you input into the
              Service ("Customer Data"). You grant us a limited license to process and store your
              Customer Data solely to provide the Service. We do not claim ownership of your data.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              6. Fees &amp; Payment
            </h2>
            <p className="mb-3">
              Access to certain features of the Service may require payment of fees as described
              in a separate order form, subscription agreement, or as communicated at account
              setup. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600">
              <li>Pay all fees in accordance with the agreed billing schedule</li>
              <li>Provide accurate billing and payment information</li>
              <li>Pay applicable taxes unless you provide a valid tax exemption certificate</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate access for non-payment after reasonable
              notice. All fees are non-refundable except as required by applicable law or as
              explicitly stated in a separate written agreement.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              7. Confidentiality
            </h2>
            <p>
              Each party agrees to keep confidential all non-public, proprietary information
              disclosed by the other party in connection with this Agreement, and to use such
              information only as necessary to fulfill obligations under this Agreement. This
              obligation does not apply to information that is publicly known, independently
              developed, or required to be disclosed by law.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              8. Disclaimers &amp; Warranties
            </h2>
            <p className="mb-3 uppercase text-sm font-semibold tracking-wide text-gray-500">
              Important -- Please Read Carefully
            </p>
            <p className="mb-3">
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES
              OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p className="mb-3">
              {COMPANY} does not warrant that:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600">
              <li>The Service will be uninterrupted, error-free, or free of viruses or harmful components</li>
              <li>Results obtained from use of the Service will be accurate or reliable</li>
              <li>Any defects in the Service will be corrected within a specific timeframe</li>
            </ul>
            <p className="mt-3">
              You use the Service at your own risk. Some jurisdictions do not allow exclusion of
              implied warranties, so the above exclusions may not apply to you.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              9. Limitation of Liability
            </h2>
            <p className="mb-3 uppercase text-sm font-semibold tracking-wide text-gray-500">
              Important -- Please Read Carefully
            </p>
            <p className="mb-3">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL {COMPANY.toUpperCase()},
              ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600 mb-3">
              <li>Indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, goodwill, or business opportunities</li>
              <li>Business interruption or operational losses</li>
              <li>Damages arising from unauthorized access to or alteration of your data</li>
            </ul>
            <p>
              OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING UNDER OR RELATED TO
              THIS AGREEMENT SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES PAID BY YOU IN
              THE THREE (3) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              10. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend, and hold harmless {COMPANY} and its officers,
              directors, employees, and agents from and against any claims, liabilities, damages,
              losses, and expenses (including reasonable attorneys' fees) arising out of or in
              connection with: (a) your use of the Service; (b) your violation of this Agreement;
              (c) your violation of any third-party rights; or (d) your violation of any
              applicable law or regulation.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              11. Term &amp; Termination
            </h2>
            <p className="mb-3">
              This Agreement begins on the date you first access the Service and continues until
              terminated by either party.
            </p>
            <ul className="space-y-2">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong className="text-gray-900">By You:</strong> You may terminate your
                  account at any time by contacting us. Termination does not entitle you to a
                  refund of prepaid fees.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong className="text-gray-900">By Us:</strong> We may suspend or terminate
                  your access at any time, with or without cause, including for breach of this
                  Agreement, non-payment, or misuse of the Service.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong className="text-gray-900">Effect of Termination:</strong> Upon
                  termination, your license to use the Service ceases immediately. Sections related
                  to intellectual property, limitation of liability, indemnification, and governing
                  law survive termination.
                </span>
              </li>
            </ul>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              12. Governing Law &amp; Dispute Resolution
            </h2>
            <p className="mb-3">
              This Agreement shall be governed by and construed in accordance with the laws of
              the <strong>{GOVERNING_STATE}</strong>, without regard to its conflict of law
              principles.
            </p>
            <p className="mb-3">
              Any disputes arising under or in connection with this Agreement shall be resolved
              by binding arbitration conducted in {GOVERNING_STATE} under the rules of the
              American Arbitration Association (AAA), except that either party may seek
              injunctive or other equitable relief in any court of competent jurisdiction to
              protect its intellectual property rights.
            </p>
            <p>
              <strong>Class Action Waiver:</strong> You agree to resolve disputes with {COMPANY}{" "}
              only on an individual basis and waive any right to participate in a class action
              lawsuit or class-wide arbitration.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              13. Third-Party Integrations
            </h2>
            <p>
              The Service may integrate with third-party services such as QuickBooks Online
              (Intuit Inc.), mapping providers, and cloud infrastructure providers. Your use of
              such integrations is subject to the respective third-party's terms of service and
              privacy policies. {COMPANY} is not responsible for the availability, accuracy, or
              practices of any third-party services.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              14. Modifications to This Agreement
            </h2>
            <p>
              We reserve the right to modify this Agreement at any time. We will provide notice
              of material changes by posting the updated Agreement within the Service and/or
              by sending an email to the address on file. Your continued use of the Service
              after such notice constitutes your acceptance of the updated terms. If you do not
              agree to the modifications, you must discontinue use of the Service.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              15. Miscellaneous
            </h2>
            <ul className="space-y-3">
              {[
                {
                  title: "Entire Agreement",
                  desc: "This Agreement constitutes the entire agreement between you and us regarding the Service and supersedes all prior agreements, understandings, and negotiations.",
                },
                {
                  title: "Severability",
                  desc: "If any provision of this Agreement is found to be unenforceable, the remaining provisions will continue in full force and effect.",
                },
                {
                  title: "Waiver",
                  desc: "Our failure to enforce any right or provision of this Agreement will not constitute a waiver of that right or provision.",
                },
                {
                  title: "Assignment",
                  desc: "You may not assign or transfer this Agreement or any rights hereunder without our prior written consent. We may assign this Agreement freely in connection with a merger, acquisition, or sale of assets.",
                },
                {
                  title: "Force Majeure",
                  desc: "Neither party shall be liable for delays or failures in performance resulting from causes beyond their reasonable control, including natural disasters, acts of government, or internet infrastructure failures.",
                },
              ].map(({ title, desc }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <span>
                    <strong className="text-gray-900">{title}:</strong> {desc}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              16. Contact Us
            </h2>
            <p className="mb-3">
              If you have any questions about this Agreement or the Service, please contact us:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-1">
              <p className="font-semibold text-gray-900">{COMPANY}</p>
              <p className="text-gray-600">
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-gray-600">Governing Law: {GOVERNING_STATE}</p>
              <p className="text-gray-600">Effective Date: {EFFECTIVE_DATE}</p>
            </div>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="gap-2 w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <div className="flex gap-4 text-sm text-gray-500">
            <a href="/legal/privacy" className="hover:text-blue-600 hover:underline">
              Privacy Policy
            </a>
            <span>?</span>
            <span>? {new Date().getFullYear()} {COMPANY}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <ErrorBoundary>
      <TermsOfService />
    </ErrorBoundary>
  );
}
