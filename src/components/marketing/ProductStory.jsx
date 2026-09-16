import useActiveStep from '../../hooks/useActiveStep';
import BrowserFrame from './mockups/BrowserFrame';
import { BracketScreen, CategoriesScreen, MatchListScreen, RegistrationsScreen, ResultsScreen } from './mockups/OrganizerScreens';

const STEPS = [
  {
    n: '01',
    title: 'Registration',
    copy: "Give players a simple way to register and keep everything organized.",
    Screen: RegistrationsScreen,
  },
  {
    n: '02',
    title: 'Tournament Setup',
    copy: 'Create categories, brackets, rules, and tournament settings in minutes.',
    Screen: CategoriesScreen,
  },
  {
    n: '03',
    title: 'Match Management',
    copy: 'Generate and organize match schedules without spreadsheets.',
    Screen: MatchListScreen,
  },
  {
    n: '04',
    title: 'Live Tournament',
    copy: 'Keep organizers, players, and spectators informed as matches progress.',
    Screen: BracketScreen,
  },
  {
    n: '05',
    title: 'Results & Community',
    copy: 'Turn every tournament into a stronger sports community.',
    Screen: ResultsScreen,
  },
];

export default function ProductStory() {
  const { active, setStepRef } = useActiveStep(STEPS.length);

  return (
    <section className="bg-ink-50/40 py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:gap-16">
        <div>
          {STEPS.map((step, i) => (
            <div key={step.n} ref={setStepRef(i)} data-step-index={i} className="flex min-h-[70vh] flex-col justify-center lg:min-h-[80vh]">
              <p className="font-display text-sm font-bold text-accent-coral">{step.n}</p>
              <h3
                className={`mt-2 font-display text-2xl font-bold transition-colors duration-300 sm:text-3xl ${
                  active === i ? 'text-ink-950' : 'text-ink-300'
                }`}
              >
                {step.title}
              </h3>
              <p className={`mt-3 max-w-md text-base transition-colors duration-300 ${active === i ? 'text-ink-600' : 'text-ink-300'}`}>
                {step.copy}
              </p>

              {/* Mobile: the mockup rides along with its own step instead of
                  staying pinned — sticky panels don't work once the two
                  columns stack. */}
              <div className="mt-6 lg:hidden">
                <BrowserFrame>
                  <div className="h-72">
                    <step.Screen />
                  </div>
                </BrowserFrame>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden lg:block">
          <div className="sticky-story-panel">
            <BrowserFrame>
              <div className="relative h-[420px]">
                {STEPS.map((step, i) => (
                  <div
                    key={step.n}
                    className="absolute inset-0 transition-opacity duration-500 ease-out"
                    style={{ opacity: active === i ? 1 : 0, pointerEvents: active === i ? 'auto' : 'none' }}
                  >
                    <step.Screen />
                  </div>
                ))}
              </div>
            </BrowserFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
