import useActiveStep from '../../hooks/useActiveStep';
import PhoneFrame from './mockups/PhoneFrame';
import { ConfirmationScreen, DiscoverScreen, PlayerResultsScreen, RegisterScreen, ScheduleScreen } from './mockups/PlayerScreens';

const STEPS = [
  { title: 'Tournament discovery', copy: 'Players browse nearby tournaments and see open categories at a glance.', Screen: DiscoverScreen },
  { title: 'Registration', copy: 'Pick a category, add a partner, and register in under a minute.', Screen: RegisterScreen },
  { title: 'Confirmation', copy: 'Instant confirmation with everything they need to know before match day.', Screen: ConfirmationScreen },
  { title: 'Match schedule', copy: "Live match times, courts, and opponents — no more asking the front desk.", Screen: ScheduleScreen },
  { title: 'Results', copy: 'Final standings and bracket history, saved to their profile.', Screen: PlayerResultsScreen },
];

export default function ForPlayers() {
  const { active, setStepRef } = useActiveStep(STEPS.length);

  return (
    <section id="players" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-ink-950 sm:text-4xl">For players, everything feels simpler.</h2>
        </div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 hidden lg:order-1 lg:block">
            <div className="sticky-story-panel flex justify-center">
              <PhoneFrame>
                <div className="relative h-full">
                  {STEPS.map((step, i) => (
                    <div
                      key={step.title}
                      className="absolute inset-0 transition-opacity duration-500 ease-out"
                      style={{ opacity: active === i ? 1 : 0, pointerEvents: active === i ? 'auto' : 'none' }}
                    >
                      <step.Screen />
                    </div>
                  ))}
                </div>
              </PhoneFrame>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            {STEPS.map((step, i) => (
              <div key={step.title} ref={setStepRef(i)} data-step-index={i} className="flex min-h-[60vh] flex-col justify-center lg:min-h-[70vh]">
                <span className={`mb-3 h-1 w-10 rounded-full transition-colors duration-300 ${active === i ? 'bg-accent-coral' : 'bg-ink-200'}`} />
                <h3 className={`font-display text-2xl font-bold transition-colors duration-300 sm:text-3xl ${active === i ? 'text-ink-950' : 'text-ink-300'}`}>
                  {step.title}
                </h3>
                <p className={`mt-3 max-w-sm text-base transition-colors duration-300 ${active === i ? 'text-ink-600' : 'text-ink-300'}`}>{step.copy}</p>

                <div className="mt-6 flex justify-center lg:hidden">
                  <PhoneFrame className="scale-90">
                    <step.Screen />
                  </PhoneFrame>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
