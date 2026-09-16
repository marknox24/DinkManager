import Reveal from './Reveal';
import FaqAccordion from '../ui/FaqAccordion';

const FAQS = [
  { q: 'Is this a monthly subscription?', a: 'No. Our plans are priced per event — you choose a plan and pay only for the tournament you’re running.' },
  { q: 'What counts as an event?', a: 'One event is one tournament — from the day you open registration through publishing final results. Run it once, and that’s what you pay for.' },
  { q: 'Can I try the platform for free?', a: 'Yes. The Free Trial plan lets you run a small tournament — 1 category, up to 10 players/pairs, 1 court — at no cost.' },
  { q: 'What happens when I reach the Free Trial limits?', a: 'You’ll see a friendly prompt to upgrade to a paid plan that fits your tournament’s size. Nothing is deleted or locked without warning.' },
  { q: 'Can players register themselves?', a: 'Yes. Players browse open tournaments, pick a category, and register online without an organizer entering anything manually.' },
  { q: 'Can I import players using CSV?', a: 'Yes, on Starter plans and above. Import your existing player list instead of entering everyone by hand.' },
  { q: 'Can I create multiple categories?', a: 'Yes. Create as many categories as your plan allows — by skill level, age group, or format — within a single tournament.' },
  { q: 'Can I manage multiple courts?', a: 'Yes. Assign matches across as many courts as your plan supports, and the schedule keeps them all in sync.' },
  { q: 'Can I print score sheets?', a: 'Yes. Score sheets are generated per match and category, ready to print or fill in digitally.' },
  { q: 'Can players see their tournament status?', a: 'Yes. Players get a live view of their registration status, match schedule, and results.' },
  { q: 'Can multiple organizers manage an event?', a: 'Yes, on Pro plans and above. Invite co-organizers or event staff with specific permissions for registration, brackets, or check-in.' },
  { q: 'Can I use it for sports other than pickleball?', a: 'DinkManager is built pickleball-first, but the same registration, bracket, and scheduling tools work for other racket and community sports.' },
];

export default function FAQ() {
  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-4">
        <Reveal className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">Frequently asked questions.</h2>
        </Reveal>

        <FaqAccordion items={FAQS} variant="divided" />
      </div>
    </section>
  );
}
