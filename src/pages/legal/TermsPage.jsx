import { Link } from 'react-router-dom';
import LegalLayout from './LegalLayout';
import { Bullets, ContactEmail } from './legalParts';

const EFFECTIVE_DATE = 'September 29, 2026';
const mail = <ContactEmail />;

const privacyLink = (
  <Link to="/privacy" className="font-semibold text-brand-700 hover:underline">
    Privacy Policy
  </Link>
);

const SECTIONS = [
  {
    id: 'acceptance',
    title: 'Accepting these terms',
    body: (
      <>
        <p>
          These Terms of Service (“Terms”) govern your use of the DinkManager website and tournament management platform (the “Service”),
          operated by DinkManager (“DinkManager”, “we”, “us”). By creating an account, registering for an event, or otherwise using the Service,
          you agree to these Terms and to our {privacyLink}. If you do not agree, please do not use the Service.
        </p>
        <p>
          If you use the Service on behalf of a club, league or other organization, you confirm that you are authorized to accept these Terms on
          its behalf.
        </p>
      </>
    ),
  },
  {
    id: 'the-service',
    title: 'What DinkManager does',
    body: (
      <p>
        DinkManager provides tools for organizers to create and publish sports tournaments, accept player registrations, manage check-in, draw
        brackets, schedule matches, record scores, display live results and keep event finances. Players can discover published events, register,
        and follow their registrations, brackets and results. DinkManager is a software provider only: we do not organize, host, supervise or
        officiate any event, and we are not a party to any arrangement between organizers and players.
      </p>
    ),
  },
  {
    id: 'accounts',
    title: 'Your account',
    body: (
      <Bullets
        items={[
          'You must be at least 18 years old to create an account. Players under 18 may take part in events only with the consent of a parent or guardian.',
          'Provide accurate information, verify your email address, and keep your details up to date.',
          'Keep your password confidential. You are responsible for all activity on your account, including by staff you invite to help with your events. Tell us right away if you suspect unauthorized use.',
          'Each person or organization may use only one Free Trial. Creating extra accounts to obtain additional trials is not allowed.',
        ]}
      />
    ),
  },
  {
    id: 'plans-payments',
    title: 'Plans and payments',
    body: (
      <>
        <Bullets
          items={[
            <>
              <strong>Per-event plans.</strong> Paid plans are purchased for a single event. Each plan’s limits (such as the number of divisions,
              players per division and courts) apply to that event only and cannot be moved to another event.
            </>,
            <>
              <strong>How to pay.</strong> Payments are made outside DinkManager (for example, by bank transfer or e-wallet), and you upload proof of
              payment. A plan is activated once we have reviewed and approved your payment. We may decline or reverse an approval if a payment
              cannot be confirmed.
            </>,
            <>
              <strong>Upgrades.</strong> You may upgrade an event to a higher plan before it takes place by paying the price difference shown at the
              time of the upgrade.
            </>,
            <>
              <strong>Prices.</strong> Prices are shown in Philippine pesos (₱) on our pricing page and may change from time to time. A price change
              never affects a plan you have already paid for.
            </>,
          ]}
        />
        <p>
          <strong>Refunds.</strong> Because a plan is activated for a specific event as soon as payment is approved, fees are generally
          non-refundable. If you were charged in error, paid twice, or could not use the Service because of a problem on our side, email {mail}{' '}
          within 7 days and we will review your request in good faith. Nothing in these Terms limits any refund rights you have under applicable
          law.
        </p>
      </>
    ),
  },
  {
    id: 'organizers',
    title: 'Responsibilities of organizers',
    body: (
      <>
        <p>If you organize events on DinkManager, you are solely responsible for your events, including:</p>
        <Bullets
          items={[
            'the accuracy of your event details, dates, venue, rules, divisions, fees and prizes;',
            'running the event safely and lawfully, including any permits, venue arrangements, insurance and waivers you need;',
            'registration fees you collect from players, and any refunds, cancellations or disputes with players — these are between you and your players, not DinkManager;',
            'awarding prizes as advertised; and',
            'handling players’ personal information lawfully — collecting only what you need, obtaining any required consent (including parental consent for minors), using it only to run your event, and keeping it confidential in line with the Data Privacy Act of 2012.',
          ]}
        />
        <p>
          To protect the integrity of results, an event’s dates and status lock automatically 48 hours after its end date, and registration closes
          once an event is finished. If you need a change after that, submit a request through DinkManager and we will review it.
        </p>
      </>
    ),
  },
  {
    id: 'players',
    title: 'Responsibilities of players',
    body: (
      <Bullets
        items={[
          'Provide accurate registration information and only register yourself — or a partner — with their permission.',
          'Follow the organizer’s rules, eligibility requirements and codes of conduct. Organizers decide whether to approve, waitlist or decline a registration.',
          'Questions about registration fees, refunds, schedules or results should be directed to the event organizer.',
          'Participation in sports involves a risk of injury. You take part in events at your own risk and should make sure you are fit to play.',
        ]}
      />
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <Bullets
          items={[
            'use the Service for anything unlawful, fraudulent or misleading, including fake events or false payment proofs;',
            'upload content that infringes others’ rights, or that is offensive, hateful, harassing or sexually explicit;',
            'collect or misuse other users’ personal information, or send spam;',
            'try to access accounts, events or data you are not authorized to access, or bypass plan limits or security controls;',
            'interfere with or overload the Service, or introduce malware; or',
            'copy, resell or reverse engineer the Service, except where the law allows.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <>
        <p>
          You keep ownership of the content you add to DinkManager, such as event details, photos, logos and registrations (“Your Content”). You
          give DinkManager a non-exclusive, worldwide, royalty-free license to host, store, copy, display and share Your Content only as needed to
          operate and provide the Service — for example, displaying a published event, its divisions and its results publicly.
        </p>
        <p>
          You confirm that you have the rights and permissions needed for Your Content, including consent from people shown in photos. We may
          remove content that breaks these Terms.
        </p>
      </>
    ),
  },
  {
    id: 'our-property',
    title: 'Our intellectual property',
    body: (
      <p>
        The Service, including its software, design, logos and the DinkManager name, belongs to DinkManager and is protected by law. These Terms
        give you a limited, personal, non-transferable right to use the Service as intended — they do not transfer any ownership to you.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        We work to keep DinkManager reliable, including offline support for event day, but we cannot promise the Service will always be available,
        uninterrupted or error-free. We may improve, change or discontinue features. If we discontinue a paid feature you are actively using for an
        upcoming event, we will give you reasonable notice. Keep your own copies of important event information, such as exported registration
        lists.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p>
        The Service is provided “as is” and “as available”. To the fullest extent permitted by law, we make no warranties, express or implied,
        including warranties of merchantability, fitness for a particular purpose and non-infringement. We are not responsible for events
        themselves — including their organization, cancellation, conduct, safety, results, prizes or any injury, loss or damage that happens at
        an event — or for any dealings between organizers and players.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the fullest extent permitted by law, DinkManager will not be liable for any indirect, incidental, special, consequential or punitive
        damages, or for lost profits, revenue or data. Our total liability for any claim relating to the Service is limited to the amount you paid
        us for the Service in the 12 months before the claim arose. Nothing in these Terms excludes liability that cannot be excluded by law.
      </p>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnity',
    body: (
      <p>
        You agree to indemnify and hold DinkManager harmless from any claims, losses and expenses (including reasonable legal fees) arising from
        your events, Your Content, your use of the Service, or your breach of these Terms or of any law.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Suspension and termination',
    body: (
      <p>
        You may stop using the Service and ask us to delete your account at any time by emailing {mail}. We may suspend or close an account that
        breaks these Terms, puts other users at risk, or is involved in fraud — where appropriate, we will tell you why. Sections that by their
        nature should continue (such as payments owed, content licenses needed to wind down, disclaimers, limitation of liability and indemnity)
        survive termination.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    body: (
      <p>
        These Terms are governed by the laws of the Republic of the Philippines. We encourage you to contact us first so we can try to resolve any
        concern informally. Any dispute that cannot be resolved informally will be brought exclusively before the proper courts of the
        Philippines.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these Terms from time to time. When we make significant changes, we will update the effective date above and notify you by
        email or through a notice in DinkManager before they take effect. Continuing to use the Service after that means you accept the updated
        Terms.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: <p>Questions about these Terms? Email us at {mail}.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
      otherDoc={{ to: '/privacy', label: 'Privacy Policy' }}
      seo={{ path: '/terms', description: 'The terms for using DinkManager as a tournament organizer, player or visitor — plans, payments, responsibilities and more.' }}
      intro={
        <p>
          Please read these terms carefully. They explain the rules for using DinkManager as an organizer, a player or a visitor, and what you can
          expect from us.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
