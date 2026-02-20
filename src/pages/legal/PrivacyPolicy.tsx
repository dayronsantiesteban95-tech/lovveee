/**
 * -----------------------------------------------------------
 * PRIVACY POLICY -- Public Legal Page
 *
 * Route: /legal/privacy
 * No auth required. Fully public.
 * -----------------------------------------------------------
 */
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ArrowLeft, Truck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const EFFECTIVE_DATE = "February 19, 2026";
const COMPANY = "Anika Logistics LLC";
const CONTACT_EMAIL = "info@anikalogistics.com";

function PrivacyPolicy() {
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
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
              Legal
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Privacy Policy
          </h1>
          <p className="text-gray-500 text-sm">
            Effective Date: <strong>{EFFECTIVE_DATE}</strong>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Last updated: <strong>{EFFECTIVE_DATE}</strong>
          </p>
          <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
            This Privacy Policy describes how <strong>{COMPANY}</strong> ("we," "us," or "our")
            collects, uses, and protects your personal information when you use the Anika Control OS
            logistics dispatch platform ("Service"). By using the Service, you agree to the terms
            described in this policy.
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10 text-gray-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              1. Information We Collect
            </h2>
            <p className="mb-4">
              We collect the following categories of personal information in connection with the
              operation of our logistics dispatch software:
            </p>

            <h3 className="font-semibold text-gray-900 mb-2">1.1 Account &amp; Identity Information</h3>
            <ul className="list-disc list-inside space-y-1 ml-2 mb-4 text-gray-600">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Job title and role within your organization</li>
              <li>Username and encrypted password credentials</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mb-2">1.2 Driver &amp; Operational Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2 mb-4 text-gray-600">
              <li>Real-time and historical GPS location data for drivers and vehicles</li>
              <li>Delivery status updates and proof of delivery (POD) records</li>
              <li>Route history and estimated arrival times</li>
              <li>Time clock records (clock-in/out timestamps)</li>
              <li>Driver performance metrics and task completion data</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mb-2">1.3 Business &amp; Billing Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2 mb-4 text-gray-600">
              <li>Company name and business address</li>
              <li>Service rate information and load details</li>
              <li>Invoice and billing records</li>
              <li>QuickBooks Online integration data (when connected)</li>
            </ul>

            <h3 className="font-semibold text-gray-900 mb-2">1.4 Technical &amp; Usage Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2 mb-4 text-gray-600">
              <li>IP address and browser/device type</li>
              <li>Pages visited and features used within the platform</li>
              <li>Error logs and diagnostic data</li>
              <li>Session timestamps</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              2. How We Use Your Information
            </h2>
            <p className="mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="space-y-3">
              {[
                {
                  title: "Dispatch & Operations",
                  desc: "To coordinate and manage delivery assignments, track driver locations, and optimize routes in real time.",
                },
                {
                  title: "Billing & Invoicing",
                  desc: "To generate invoices, calculate service rates, and integrate with accounting platforms such as QuickBooks Online.",
                },
                {
                  title: "Communication",
                  desc: "To send operational notifications, account alerts, and support responses via email or in-app messaging.",
                },
                {
                  title: "Performance & Analytics",
                  desc: "To measure driver performance, fleet efficiency, and overall operational metrics for internal reporting.",
                },
                {
                  title: "Platform Improvement",
                  desc: "To diagnose bugs, monitor system health, and improve the features and reliability of the Service.",
                },
                {
                  title: "Legal & Compliance",
                  desc: "To comply with applicable laws, regulations, and lawful government requests.",
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

          {/* 3 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              3. Data Storage &amp; Security
            </h2>
            <p className="mb-4">
              All data collected through the Service is stored securely using industry-standard
              cloud infrastructure:
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong className="text-gray-900">Supabase (PostgreSQL):</strong> Our primary
                  data store runs on Supabase, a SOC 2-compliant cloud database platform hosted
                  on AWS. All data is encrypted at rest (AES-256) and in transit (TLS 1.2+).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong className="text-gray-900">Access Controls:</strong> Access to personal
                  data is restricted to authorized personnel on a need-to-know basis. Row-level
                  security policies are enforced at the database level.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong className="text-gray-900">Authentication:</strong> User accounts are
                  protected by secure authentication managed through Supabase Auth, supporting
                  password policies and session management.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <span>
                  <strong className="text-gray-900">No Sale of Data:</strong> We do not sell,
                  rent, or trade your personal information to third parties for marketing purposes.
                </span>
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              4. Information Sharing &amp; Third Parties
            </h2>
            <p className="mb-4">
              We may share your information only in the following limited circumstances:
            </p>
            <ul className="space-y-3">
              {[
                {
                  title: "Service Providers",
                  desc: "Trusted third-party providers that support platform operations (e.g., Supabase for data hosting, Vercel for application delivery). These parties are contractually obligated to protect your data.",
                },
                {
                  title: "QuickBooks / Intuit",
                  desc: "If you connect your QuickBooks Online account, billing and invoicing data is exchanged with Intuit in accordance with Intuit's privacy policy and your authorization.",
                },
                {
                  title: "Legal Requirements",
                  desc: "If required by law, court order, or governmental authority, we may disclose information to comply with legal obligations.",
                },
                {
                  title: "Business Transfers",
                  desc: "In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction with appropriate notice.",
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

          {/* 5 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              5. Location Data
            </h2>
            <p className="mb-2">
              The Service uses real-time GPS location data from driver mobile devices to enable
              dispatch coordination, route tracking, and delivery verification. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600">
              <li>Location tracking is active only during active work sessions or when drivers opt in.</li>
              <li>Location data is stored with delivery records and retained for operational and audit purposes.</li>
              <li>Drivers are informed of location tracking as part of their onboarding and platform use.</li>
              <li>Customers may view approximate driver location on public-facing delivery tracking pages.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              6. Data Retention
            </h2>
            <p>
              We retain personal information for as long as necessary to provide the Service,
              comply with legal obligations, resolve disputes, and enforce our agreements.
              Operational records (deliveries, invoices, time records) may be retained for up to
              7 years in accordance with standard business and tax record requirements. You may
              request deletion of your personal data by contacting us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-blue-600 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              , subject to applicable legal obligations.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              7. Your Rights
            </h2>
            <p className="mb-4">
              Depending on your location, you may have certain rights with respect to your
              personal information, including:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 text-gray-600">
              <li>The right to access personal data we hold about you</li>
              <li>The right to request correction of inaccurate data</li>
              <li>The right to request deletion of your data (subject to legal retention requirements)</li>
              <li>The right to object to certain processing activities</li>
              <li>The right to data portability where technically feasible</li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, please contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              8. Cookies &amp; Tracking Technologies
            </h2>
            <p>
              The Service uses browser session storage and authentication tokens to maintain user
              sessions. We do not use third-party advertising cookies or cross-site trackers. Basic
              analytics may be collected for operational monitoring purposes only.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              9. Children's Privacy
            </h2>
            <p>
              The Service is intended for use by business professionals and is not directed at
              individuals under the age of 18. We do not knowingly collect personal information
              from minors. If you believe a minor has provided us with personal data, please
              contact us immediately at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              "Last updated" date at the top of this page. Continued use of the Service after any
              changes constitutes your acceptance of the revised policy. We encourage you to review
              this page periodically.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              11. Contact Us
            </h2>
            <p className="mb-3">
              If you have any questions, concerns, or requests regarding this Privacy Policy or
              our data practices, please contact us:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-1">
              <p className="font-semibold text-gray-900">{COMPANY}</p>
              <p className="text-gray-600">
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
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
            <a href="/legal/terms" className="hover:text-blue-600 hover:underline">
              Terms of Service
            </a>
            <span>?</span>
            <span>? {new Date().getFullYear()} {COMPANY}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <ErrorBoundary>
      <PrivacyPolicy />
    </ErrorBoundary>
  );
}
