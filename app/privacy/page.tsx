import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "@/components/brand-mark";
import BrandSignature from "@/components/brand-signature";

export const metadata: Metadata = {
  title: "Privacy & cookies — Alex Bell Arts",
  description: "How I use and protect your information in ABA Studio.",
};

export default function Privacy() {
  return (
    <main className="auth-page privacy-page">
      <Link className="logo" href="/" aria-label="Alex Bell Arts home">
        <BrandMark />
      </Link>
      <article className="panel privacy-notice" aria-labelledby="privacy-title">
        <header>
          <span className="section-kicker">YOUR INFORMATION</span>
          <h1 id="privacy-title">Privacy & cookies.</h1>
          <p>
            This notice explains how I use your information when you enquire
            about my services or use ABA Studio, your client portal.
          </p>
          <p className="muted">Last updated: 2 November 2026</p>
        </header>
        <nav
          className="privacy-jump-links"
          aria-label="Privacy notice sections"
        >
          <a href="#privacy-contact">Contact</a>
          <a href="#privacy-use">Your information</a>
          <a href="#privacy-retention">Retention</a>
          <a href="#privacy-rights">Your rights</a>
          <a href="#cookies">Cookies & browser storage</a>
        </nav>

        <section id="privacy-contact">
          <h2>Who is responsible for your information?</h2>
          <p>
            I’m Alex Bell, trading as Alex Bell Arts (ABA). I am the data
            controller for the personal information I use to run my design
            business and this portal.
          </p>
          <p>
            For privacy questions or to exercise your rights, email me at{" "}
            <a href="mailto:Alex.bell.arts@outlook.com">
              Alex.bell.arts@outlook.com
            </a>
            . Please do not send passwords, sign-in links, authentication codes
            or bank-card details.
          </p>
        </section>

        <section id="privacy-use">
          <h2>What I collect and why</h2>
          <p>
            You provide information through enquiries, project correspondence,
            questionnaires, uploaded files and your portal account. This can
            include your name, business, contact details, project brief,
            feedback, approvals, contract returns and payment-verification
            records. Please only upload information you are entitled to share
            and avoid unnecessary sensitive personal information.
          </p>
          <dl className="privacy-purposes">
            <div>
              <dt>Enquiries and delivering your project</dt>
              <dd>
                I use the details needed to discuss your request, agree the
                work, communicate with you and deliver it. My lawful basis is
                taking steps at your request before a contract or performing my
                contract with you. Where you represent an organisation, my
                legitimate interest is managing that business relationship.
              </dd>
            </div>
            <div>
              <dt>Accounts, access and security</dt>
              <dd>
                I use account identifiers, sign-in information, technical
                request data such as IP addresses, and access/audit records to
                provide the portal, prevent unauthorised access and investigate
                problems. My lawful basis is my legitimate interest in running a
                reliable, secure service and protecting confidential work.
              </dd>
            </div>
            <div>
              <dt>Business records and legal obligations</dt>
              <dd>
                I retain necessary contract, financial and decision records to
                meet applicable accounting and legal obligations, and for my
                legitimate interests in handling queries, disputes and legal
                claims. Uploading a contract or recording a payment check does
                not itself process a payment or provide an electronic signature.
              </dd>
            </div>
          </dl>
          <p>
            If you do not provide information needed to respond to an enquiry,
            manage your account or deliver the agreed work, I may be unable to
            provide that part of the service. I do not use this portal to make
            solely automated decisions with legal or similarly significant
            effects about you.
          </p>
        </section>

        <section id="privacy-sharing">
          <h2>Who helps me provide the service?</h2>
          <ul>
            <li>
              <strong>Supabase</strong> provides account authentication, the
              project database and private file storage.
            </li>
            <li>
              <strong>Vercel</strong> hosts the portal and processes technical
              requests and operational logs.
            </li>
            <li>
              <strong>Tally</strong> processes your answers if you use my
              enquiry or feedback forms. Relevant enquiry answers are also
              received in my workspace.
            </li>
            <li>
              <strong>Email providers</strong> handle correspondence and account
              emails. My published contact address is hosted by Microsoft
              Outlook.
            </li>
          </ul>
          <p>
            Booking and other external links, such as Calendly or Framer, open
            separate services with their own privacy and cookie information.
            They are not embedded tracking tools on this page. I may also share
            necessary information with professional advisers or authorities
            where required by law or necessary to establish, exercise or defend
            legal claims.
          </p>
          <p>
            These providers operate internationally, so processing locations
            depend on the service and its configuration. Contact me for details
            of the locations and any applicable UK transfer safeguards for your
            information.
          </p>
        </section>

        <section id="privacy-retention">
          <h2>How long I keep information</h2>
          <p>
            Retention depends on the purpose of the record: whether an enquiry
            is still active, whether information is needed to deliver or support
            the agreed project, applicable accounting or legal obligations, and
            whether an unresolved complaint or legal claim requires it. Please
            contact me for the retention arrangements relevant to your project.
          </p>
          <p>
            Closing or archiving a project does not automatically delete its
            information. Removing portal access also does not erase every
            business record. Necessary financial, contract, audit and account
            records may need separate retention; backups follow their own
            retention arrangements. A deletion request is reviewed against these
            requirements rather than treated as an automatic removal of
            everything.
          </p>
        </section>

        <section id="privacy-protection">
          <h2>Protecting your information</h2>
          <p>
            Portal access is restricted to authorised accounts and project
            permissions. Files have sharing and release controls. Download links
            are sensitive: a signed link can remain usable for up to 60 seconds,
            and copies already downloaded cannot be recalled. Keep your account
            and any private links secure, and tell me if you suspect
            unauthorised access.
          </p>
        </section>

        <section id="privacy-rights">
          <h2>Your rights and how to ask</h2>
          <p>
            Depending on the circumstances, UK data protection law gives you
            rights to access your personal information, correct it, request
            erasure or restriction, object to processing based on legitimate
            interests, and receive certain information in a portable format.
            Where processing relies on consent, you can withdraw it without
            affecting the lawfulness of earlier processing.
          </p>
          <p>
            Email me using the contact above. I may need to confirm your
            identity without requesting more information than necessary. I
            normally respond within one month; if a lawful extension applies, I
            will explain it. Rights are subject to the applicable conditions and
            exemptions. You can also complain to the{" "}
            <a href="https://ico.org.uk/make-a-complaint/">
              Information Commissioner’s Office (ICO)
            </a>
            , the UK data protection regulator.
          </p>
        </section>

        <section id="cookies">
          <h2>Cookies and browser storage</h2>
          <p>
            The portal uses essential cookies to sign you in and protect the
            sign-in process. These are needed to provide the account service you
            request. The application does not include advertising cookies,
            tracking analytics or external font requests. There is no optional
            cookie consent banner because the current application does not offer
            those optional trackers.
          </p>
          <div className="privacy-storage">
            <section>
              <h3>Sign-in cookies</h3>
              <p>
                Supabase uses names starting with <code>sb-</code> and ending in
                <code>-auth-token</code>, sometimes split into numbered parts.
                They hold the session information needed to keep you signed in.
                The configured maximum browser lifetime is 400 days from a
                cookie update; your actual account session can expire sooner,
                and refreshing a session can renew its cookies. Signing out
                clears the current account session cookies in that browser.
              </p>
            </section>
            <section>
              <h3>Sign-in verification cookies</h3>
              <p>
                Names beginning <code>sb-</code> and containing
                <code>code-verifier</code> help complete email-link sign-in and
                recovery securely. They are removed during the authentication
                flow when no longer required, but unused cookies can remain
                until their browser expiry. That expiry may use the same 400-day
                maximum; it does not make a sign-in link valid for 400 days.
              </p>
            </section>
            <section>
              <h3>Fictional demo storage</h3>
              <p>
                If you open the fictional demo, <code>aba-demo-v1</code> in your
                browser’s local storage remembers demo edits. It has no
                automatic expiry and remains until you clear that site data.
                Demo records are not imported into connected client projects.
                Please use fictional information in the demo.
              </p>
            </section>
          </div>
          <p>
            You can remove cookies and site storage through your browser
            settings. Blocking essential cookies prevents sign-in from working;
            clearing demo storage removes your saved demo edits. If I introduce
            optional tracking in future, I will update this explanation and
            provide the choices required before using it. External services you
            choose to visit have their own controls.
          </p>
        </section>
        <section id="privacy-changes">
          <h2>Changes to this notice</h2>
          <p>
            I will update this page when the portal or relevant privacy
            arrangements change. The date above identifies this version.
          </p>
        </section>
        <Link className="secondary" href="/login">
          Return to sign in
        </Link>
      </article>
      <BrandSignature />
    </main>
  );
}
