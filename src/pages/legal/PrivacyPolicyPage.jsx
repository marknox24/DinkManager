import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';
import { Bullets, ContactEmail } from './legalParts';

const EFFECTIVE_DATE = 'September 29, 2026';
const mail = <ContactEmail />;

const SECTIONS = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          DinkManager (“DinkManager”, “we”, “us”) is an online platform that helps organizers create, publish and run pickleball and other sports
          tournaments, and helps players find events, register and follow their results. This Privacy Policy explains what personal information we
          collect, why we collect it, how we use and protect it, and the choices and rights you have.
        </p>
        <p>
          We handle personal information in accordance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules
          and Regulations, and issuances of the National Privacy Commission (NPC).
        </p>
      </>
    ),
  },
  {
    id: 'roles',
    title: 'Organizers, players and our role',
    body: (
      <>
        <p>DinkManager is used by different people in different ways:</p>
        <Bullets
          items={[
            <>
              <strong>Organizers</strong> create accounts to set up and manage events, and may invite helpers (“staff”) to assist with an event.
            </>,
            <>
              <strong>Players</strong> may create a player account, and may register for an organizer’s event — with or without an account.
            </>,
            <>
              <strong>Visitors</strong> may browse published events without signing in.
            </>,
          ]}
        />
        <p>
          For your own DinkManager account, we decide how your information is used. When you register for a tournament, the organizer of that
          event decides what information to ask for and how to use it to run their event. For that event data, we process it on the organizer’s
          behalf, and the organizer is responsible for how they use it. If you have questions about how an organizer uses your registration
          details, please contact the organizer directly — or contact us and we will help you reach them.
        </p>
      </>
    ),
  },
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    body: (
      <>
        <p>
          <strong>Account information.</strong> Your name or club name, email address, password (stored only in securely hashed form — we never see
          it), account type (organizer or player), and, if you turn it on, two-factor authentication settings.
        </p>
        <p>
          <strong>Tournament registration information.</strong> When you register for an event, the organizer may ask for details such as your name
          and your partner’s name, email address, phone number, address, club, a photo, answers to the organizer’s own custom questions, and a
          message to the organizer. We also record your registration status, check-in times, bracket placement, match scores and results.
        </p>
        <p>
          <strong>Event content.</strong> Information organizers add about their events — names, dates, venue, descriptions, rules, divisions, fees,
          prizes, contact details, cover photos, sponsor logos and payment QR codes.
        </p>
        <p>
          <strong>Payment information.</strong> Plans are paid outside DinkManager (for example, by bank transfer or e-wallet). When you buy or
          upgrade a plan, we collect the plan you chose, the amount, and the proof-of-payment screenshot you upload so we can confirm it. We do not
          collect or store card numbers or bank login details.
        </p>
        <p>
          <strong>Organizer records.</strong> If organizers use the accounting features, we store the earnings and expense entries and receipt images
          they upload.
        </p>
        <p>
          <strong>Support and communications.</strong> Messages you send us through support or change requests, and records of emails we send you
          (such as account verification, password reset and event updates).
        </p>
        <p>
          <strong>Technical information.</strong> Basic information your browser sends when you use the service (such as IP address, browser type
          and device information) that our hosting providers log for security and reliability.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use',
    title: 'How we use your information',
    body: (
      <Bullets
        items={[
          'To create and secure your account, verify your email address, and let you sign in.',
          'To let organizers publish events and manage registrations, check-in, brackets, scoring and results.',
          'To show players their registrations, statuses, brackets and results, and to notify them of updates (for example, when a registration is approved or an event is rescheduled).',
          'To confirm plan purchases, activate paid features on the right event, and keep financial records.',
          'To send you service emails — such as verification, password reset, invitations and important account or event notices.',
          'To respond to support requests and change requests.',
          'To keep the service secure, prevent fraud and abuse, and fix problems.',
          'To comply with our legal obligations.',
        ]}
      />
    ),
  },
  {
    id: 'legal-basis',
    title: 'Why we are allowed to use it',
    body: (
      <>
        <p>We process personal information only when we have a lawful basis to do so, including:</p>
        <Bullets
          items={[
            'to provide the service you requested and fulfil our agreement with you (our Terms of Service);',
            'your consent — for example, when you submit a registration to an organizer or choose to upload a photo (you may withdraw consent at any time, though this may affect your participation in an event);',
            'our legitimate interests in running, securing and improving DinkManager, where these are not overridden by your rights; and',
            'compliance with legal obligations.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'public-information',
    title: 'Information that is visible to others',
    body: (
      <>
        <p>DinkManager is built to run public tournaments, so some information is designed to be seen:</p>
        <Bullets
          items={[
            'Published events (name, dates, venue, divisions, fees, prizes, organizer name and contact details the organizer adds) are visible to anyone.',
            'Player and team names, bracket placements, match schedules, scores and results may be shown on public event pages and on the organizer’s on-site preview screens.',
            'Organizers — and staff they authorize — can see the full registration details submitted to their own event.',
          ]}
        />
        <p>
          Your email address, phone number, address, photo and answers to custom questions are not shown publicly. Registration photos and receipts
          are stored privately.
        </p>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'How we share information',
    body: (
      <>
        <p>We do not sell your personal information. We share it only:</p>
        <Bullets
          items={[
            'with the organizer (and their authorized staff) of an event you register for;',
            <>
              with service providers who help us run DinkManager, under agreements that require them to protect it: <strong>Supabase</strong>{' '}
              (database, authentication and file storage), <strong>Vercel</strong> (website hosting), <strong>Resend</strong> (email
              delivery) and <strong>Google Analytics</strong> (website usage statistics);
            </>,
            'when required by law, court order or a lawful request by public authorities, or to protect the rights, safety and security of our users, the public or DinkManager; and',
            'as part of a merger, acquisition or sale of the business, in which case we will notify you.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'international',
    title: 'International transfers',
    body: (
      <p>
        Our service providers may store and process information on servers located outside the Philippines. When this happens, we take reasonable
        steps — including contractual safeguards — to make sure your information receives a level of protection consistent with the Data Privacy
        Act.
      </p>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and browser storage',
    body: (
      <>
        <p>
          We use your browser’s local storage, session storage and offline storage to keep you signed in, remember preferences (such as pop-ups you
          have already seen), and let organizers keep working on event day if the internet connection drops.
        </p>
        <p>
          We use <strong>Google Analytics</strong> to understand how visitors use our website — for example, which pages are viewed, how people
          arrive, and roughly where they are (country or city). Google Analytics uses cookies and receives your IP address, device and browser
          information, but we do not send it your name, email address or registration details, and we remove private event links and other
          identifiers from the page addresses it receives. You can opt out with the{' '}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
            Google Analytics Opt-out Browser Add-on
          </a>{' '}
          or by blocking cookies in your browser. Learn more in{' '}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
            how Google uses information from sites that use its services
          </a>
          .
        </p>
        <p>We do not use advertising cookies, and we do not sell or share your information for advertising.</p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>
          We keep account information for as long as your account is active. Event and registration records are kept for as long as the organizer
          keeps the event on DinkManager, so results and history remain available. Payment and financial records may be kept longer where needed
          for accounting, tax or legal purposes.
        </p>
        <p>
          When you delete your account or ask us to delete your information, we will delete or anonymize it within a reasonable time, unless we
          need to keep it to meet a legal obligation, resolve a dispute or enforce our agreements.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <p>
        We use reasonable organizational, physical and technical measures to protect personal information — including encrypted connections
        (HTTPS), hashed passwords, optional two-factor authentication, access controls that limit each organizer and staff member to their own
        events, and private storage for sensitive files. No system is completely secure, so please use a strong password and keep it private. If a
        personal data breach occurs that is likely to put you at risk, we will notify you and the National Privacy Commission as required by law.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under the Data Privacy Act, you have the right to:</p>
        <Bullets
          items={[
            'be informed about how your personal information is processed;',
            'access the personal information we hold about you;',
            'correct inaccurate or incomplete information;',
            'object to processing, or withdraw consent where processing is based on consent;',
            'have your information erased or blocked when it is no longer needed or was unlawfully processed;',
            'obtain a copy of your information in a commonly used electronic format (data portability);',
            'be indemnified for damages caused by inaccurate, incomplete, outdated, false or unlawfully obtained information; and',
            'file a complaint with the National Privacy Commission.',
          ]}
        />
        <p>
          You can update much of your account information yourself on your account page. To exercise any other right, email us at {mail}. We may
          need to verify your identity before acting on a request. For registration details you submitted to an organizer, we may refer your
          request to that organizer.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        DinkManager accounts are intended for people aged 18 and over. Players under 18 may take part in events only with the consent of a parent or
        guardian, who should complete or approve the registration. Organizers are responsible for obtaining that consent for minors registering for
        their events. If you believe a child has given us personal information without appropriate consent, contact us and we will remove it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this Privacy Policy from time to time. When we make significant changes, we will update the effective date above and let you
        know by email or through a notice in DinkManager before the changes take effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: (
      <p>
        If you have questions or concerns about this Privacy Policy or how we handle your personal information, email us at {mail}. Please also
        read our{' '}
        <Link to="/terms" className="font-semibold text-brand-700 hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      effectiveDate={EFFECTIVE_DATE}
      otherDoc={{ to: '/terms', label: 'Terms of Service' }}
      seo={{ path: '/privacy', description: 'How DinkManager collects, uses and protects personal information, in line with the Philippine Data Privacy Act of 2012.' }}
      intro={
        <p>
          Your privacy matters to us. This policy describes how DinkManager collects, uses, shares and protects personal information when you use
          our website and tournament management platform.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
