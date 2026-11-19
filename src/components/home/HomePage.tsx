import Link from "next/link";
import weatherJson from "@/data/weather.json";
import { HeroChart } from "@/components/charts/HeroChart";
import { uncontrolledWeek } from "@/lib/model";
import { SOURCES } from "@/lib/sources";

type Bundle = Record<string, { times: string[]; temps: number[] }>;
const weather = weatherJson as Bundle;

const week = uncontrolledWeek(
  weather["des-moines__2025-07-08"].times,
  weather["des-moines__2025-07-08"].temps,
  weather["duluth__2025-07-08"].temps,
);

const gaps = [
  ["Zero-water cooling", "Removes evaporation on new campuses", "Pilots now, sites from late 2027. The existing fleet still evaporates, and it trades water for electricity."],
  ["Carbon-aware scheduling", "Moves flexible jobs toward low-carbon hours", "Optimises carbon. Following the sun can mean running in the hottest hours."],
  ["Electricity demand response", "Shifts ML load off grid peaks", "Proves AI load can flex. The water utility is not in the signal."],
  ["WaterWise", "Co-optimises carbon and total water", "Minimises litres. It does not cap the peak day that sizes pipes, and it has no utility signal."],
  ["Annual WUE", "Reports yearly litres per kWh", "Hides the peak. The research calls for a peak WUE."],
  ["Tanks alone", "Smooth a few hours", "They cannot cover a multi-day heatwave."],
];

const levers = [
  ["Time-shift", "Move batch jobs and checkpointed training into cooler hours, up to a day. Inference stays where it is."],
  ["Space-shift", "Send flexible work to a sister site only when that forecast is actually cooler. The gallons are not the same gallons."],
  ["Water↔power", "Switch to dry cooling when the grid has room. The brief's reference cost is +0.15 PUE."],
  ["Tank", "Fill before the heat and draw on the worst hours. Storage shaves a peak. It does not survive a week of it."],
];

const toy = [
  ["Des Moines, Iowa", "112", "13%", "11", "171 MWh/yr (0.03%)"],
  ["Phoenix, Arizona", "244", "4%", "88", "4,586 MWh/yr (0.68%)"],
  ["Lahore, Pakistan", "254", "6%", "34", "1,333 MWh/yr (0.20%)"],
  ["Karachi, Pakistan", "343", "7%", "115", "3,611 MWh/yr (0.54%)"],
];

function Fact({ kicker, figure, text, href }: { kicker: string; figure: string; text: string; href: string }) {
  return (
    <article className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-lagoon">{kicker}</p>
      <p className="mt-2 font-serif text-3xl">{figure}</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{text}</p>
      <a className="mt-3 inline-block text-sm font-semibold text-lagoon underline" href={href}>
        Source
      </a>
    </article>
  );
}

export function HomePage() {
  return (
    <>
      <section className="topo bg-lagoon-deep text-sand">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-20">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-lagoon-mist">
              Xylem 2026 · University Track · Water Quantity
            </p>
            <h1 className="mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-6xl">
              Let AI grow without making the hottest day worse.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-sand/85 sm:text-lg">
              Water systems are built for the peak day, not the yearly average. Data-center cooling spikes on that
              same day. ThirstCap reads a 72-hour forecast and plans flexible jobs, the cooling mode, and a tank so
              withdrawal stays under a cap the utility can rely on.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-full bg-sand px-5 py-2.5 text-sm font-semibold text-ink">
                Open the demo
              </Link>
              <a href="#problem" className="rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-sand">
                The hidden peak
              </a>
            </div>
            <p className="mt-6 text-sm text-sand/70">
              Asim, Maira, Malaika, Tayyab · NUTECH, Islamabad
            </p>
          </div>
          <div className="rounded-3xl bg-sand-card p-5 text-ink shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-heat">Sample · Des Moines</p>
            <p className="mt-2 font-serif text-2xl leading-snug">8–14 July 2025, uncontrolled</p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              Real archive temperatures. Water is the toy curve, not a meter. 10 July is the day a pipe is sized for.
              11 July barely needs evaporation.
            </p>
            <div className="mt-3">
              <HeroChart days={week.days} />
            </div>
            <p className="text-xs text-ink-faint">Open-Meteo hourly archive, toy withdrawal at a flat 70 MW.</p>
          </div>
        </div>
      </section>

      <section id="problem" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon">The problem</p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl">The bill is the peak day.</h2>
            <p className="mt-4 text-base leading-7 text-ink-soft">
              Yearly water-use effectiveness hides the day that sets the pipe, the pump, and the treatment plant.
              Researchers put data-center daily peaking factors — peak day divided by average day — at 6, sometimes
              above 10, and above 30 for some planned sites. Other large users usually sit between 1.5 and 2.5.
            </p>
            <blockquote className="mt-6 border-l-2 border-heat pl-4">
              <p className="font-serif text-2xl leading-snug">“We just don’t have the water.”</p>
              <p className="mt-2 text-sm text-ink-faint">
                A Newton County, Georgia water official, as cited in{" "}
                <a className="text-lagoon underline" href="https://arxiv.org/abs/2603.02705">
                  Han, Li, Wierman, and Ren (2026)
                </a>
                . West Des Moines Water Works said in 2022 it would only consider future data centers that
                significantly reduce peak use. Thames Water has discussed restricting peak use in the hottest periods.
              </p>
            </blockquote>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact
              kicker="Xylem / GWI"
              figure="23.7 km³"
              text="withdrawn by the AI value chain in 2025, up 38% since 2020, with another 129% expected by 2050. Nearly 40% of existing data centers sit in high or extremely high water stress."
              href="https://www.xylem.com/en-us/info/watering-the-new-economy/"
            />
            <Fact
              kicker="IEA, 2025"
              figure="560 → 1,200"
              text="billion litres a year. That is the IEA base-case range for global data-center water consumption today and in 2030. The total is not the constraint. The peak day is."
              href="https://iea.blob.core.windows.net/assets/b3a8b37f-32d1-4873-9eca-31cec5895264/EnergyandAI.pdf"
            />
            <Fact
              kicker="Peak capacity"
              figure="$10–58B"
              text="U.S. data centers could need 697–1,451 million gallons per day of new peak water capacity by 2030, on the order of New York City’s supply, at $10–40 million per million gallons a day."
              href="https://arxiv.org/abs/2603.02705"
            />
            <Fact
              kicker="Where it is growing"
              figure="25 countries"
              text="A quarter of the world’s population already lives with extremely high water stress, including India, Saudi Arabia, and the UAE. Pakistan set aside 2,000 MW in May 2025 for mining and AI data centers."
              href="https://www.wri.org/insights/highest-water-stressed-countries"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-sand-line bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon">Why today’s fixes miss it</p>
          <h2 className="mt-2 max-w-2xl font-serif text-3xl sm:text-4xl">
            The tools we have optimise a total. Utilities build a maximum.
          </h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Existing approaches and the gap ThirstCap is aimed at</caption>
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-faint">
                <tr>
                  <th className="py-2 pr-4 font-medium">What exists</th>
                  <th className="py-2 pr-4 font-medium">What it does</th>
                  <th className="py-2 font-medium">What it leaves open</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map(([name, does, gap]) => (
                  <tr key={name} className="border-t border-sand-line align-top">
                    <th className="py-3 pr-4 font-serif text-base font-medium">{name}</th>
                    <td className="py-3 pr-4 text-ink-soft">{does}</td>
                    <td className="py-3 text-ink-soft">{gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-faint">
            The researchers’ own recommendation: water-aware computing together with tanks, and coordinated
            water-power planning. They recommend it. ThirstCap is the scheduler that treats the peak day as the
            objective, and gives the utility a signal when that day is coming.
          </p>
        </div>
      </section>

      <section id="levers" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon">The idea</p>
        <h2 className="mt-2 max-w-2xl font-serif text-3xl sm:text-4xl">
          A lot of AI work does not have to run at 3pm on a heatwave.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
          ThirstCap is a rolling 72-hour controller. Every hour it re-solves a plan whose first term is the worst
          day’s withdrawal. Four levers move together, under a grid-peak penalty so the water save is not quietly
          dumped onto the power peak.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {levers.map(([title, body], index) => (
            <article key={title} className="rounded-3xl border border-sand-line bg-sand-card p-4 shadow-card">
              <p className="text-xs font-semibold text-lagoon">0{index + 1}</p>
              <h3 className="mt-2 font-serif text-2xl">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-ink-soft">
          A utility flex event — a heatwave or a drought stage — tightens the cap the way a power demand-response
          call tightens a load. The demo button does that cut at 30% and solves again. The product this is aiming at
          is a “pipe neutral” commitment: a firm peak the town does not have to build, in exchange for a faster
          connection. That commercial wrapper is an assumption, not a signed contract.
        </p>
      </section>

      <section id="method" className="bg-ink text-sand">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon-mist">How a plan is made</p>
          <h2 className="mt-2 font-serif text-3xl sm:text-4xl">Forecast, plant, optimizer, cap.</h2>
          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {[
              ["Forecast", "Hourly dry-bulb and wet-bulb from Open-Meteo. Backtests use the historical forecast, so the error is real."],
              ["Plant", "Evaporation from latent heat, make-up from cycles of concentration, and a mode for dry, evaporative, or chiller."],
              ["Workload", "Fixed inference, deferrable batch, pausable training. Flexible share is tested from 5% to 30%."],
              ["Optimizer", "Minimise the peak day plus extra electricity, grid-peak megawatts, and job delay."],
              ["Cap", "A 72-hour plan the utility can read, and a flex event when the town needs it tighter."],
            ].map(([title, body], index) => (
              <li key={title} className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs text-lagoon-mist">0{index + 1}</p>
                <h3 className="mt-2 font-serif text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-sand/75">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-sm leading-6 text-sand/70">
            The screens you can click today run a labelled sample of that pipeline: real temperatures, the brief’s
            toy curve, and a heuristic in place of the MILP. The FastAPI service that replaces the heuristic is
            specified in BACKEND.md so the same screens light up against the solver.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon">Toy check, 11 Nov 2026</p>
            <h2 className="mt-2 font-serif text-3xl">Time-shifting alone is not enough.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-ink-faint">
            The team’s one-day sanity check on 2025 weather. These are not the dashboard, and they are not the
            calibrated model. They are why the four levers exist.
          </p>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Toy model sanity check by city</caption>
            <thead className="text-xs uppercase tracking-[0.12em] text-ink-faint">
              <tr>
                <th className="py-2 pr-3 font-medium">Site</th>
                <th className="py-2 pr-3 font-medium">Days needing evaporative assist</th>
                <th className="py-2 pr-3 font-medium">Peak cut, time-shift only</th>
                <th className="py-2 pr-3 font-medium">Days that need a swap to halve the peak</th>
                <th className="py-2 font-medium">Extra electricity</th>
              </tr>
            </thead>
            <tbody>
              {toy.map((row) => (
                <tr key={row[0]} className="border-t border-sand-line">
                  {row.map((cell) => (
                    <td key={cell} className="py-3 pr-3">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-soft">
          In that check, 66% of Des Moines hours above 25°C fell between noon and 8pm, so moving work helped. Phoenix
          and Lahore stay hot at night, and the electricity you spend to kill evaporation lands in the same afternoon
          the grid is already stressed. That conflict is the reason for a joint plan. The demo is built so you can
          see which lever actually moves in each city.
        </p>
        <div className="mt-8">
          <Link href="/dashboard" className="rounded-full bg-lagoon px-5 py-2.5 text-sm font-semibold text-white">
            Run the Iowa week
          </Link>
          <Link
            href="/dashboard?site=lahore&preset=lhe-2025-06-08"
            className="ml-3 inline-block text-sm font-semibold text-lagoon underline"
          >
            Or open Lahore
          </Link>
        </div>
      </section>

      <section className="border-y border-sand-line bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lagoon">What a judge can see</p>
          <h2 className="mt-2 font-serif text-3xl">Impact, fit, and a new objective.</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <article className="rounded-3xl border border-sand-line bg-sand-card p-5">
              <h3 className="font-serif text-2xl">Impact</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Every million gallons a day kept off the peak is a pipe, pump, or plant a town does not have to
                finance. The demo reports that peak in gallons and as a sample Water Capacity Impact, for a fleet that
                already exists. About 40% of data centers are in water-stressed regions. The Pakistan weeks are the
                case for planning before the build-out, not after a refusal.
              </p>
            </article>
            <article className="rounded-3xl border border-sand-line bg-sand-card p-5">
              <h3 className="font-serif text-2xl">Challenge fit</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Water Quantity, stated as efficiency and responsible growth. No new cooling hardware. The controls are
                a job scheduler, a cooling mode, and a tank, which sites already have, plus a flex signal copied from
                electricity demand response. The weather on screen is the 2025 archive, not a drawn heatwave.
              </p>
            </article>
            <article className="rounded-3xl border border-sand-line bg-sand-card p-5">
              <h3 className="font-serif text-2xl">Innovation</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Past Ignite winners won with a local, data-backed problem, a water–energy link, and a prototype
                someone could use. None of them scheduled water for digital infrastructure. ThirstCap keeps that
                pattern and aims it at the peak day: joint control of compute, cooling, and storage, and a utility
                signal with a firm cap.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl">Real, simulated, and not claimed.</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl bg-lagoon-mist p-5">
            <h3 className="font-serif text-xl">Real</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Open-Meteo hours for eight weeks in 2025. The physics constants the brief published. The interaction: a
              cap, a flex event, four levers, and a before/after a person can operate.
            </p>
          </article>
          <article className="rounded-3xl bg-heat-mist p-5">
            <h3 className="font-serif text-xl">Simulated</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              The campus itself. A flat 70 MW load. The flexible share. The sister pairing. The tank. The sample grid
              shape. In the browser, a heuristic stands in for the MILP. The UI says so on every plan.
            </p>
          </article>
          <article className="rounded-3xl bg-sand-card p-5 shadow-card">
            <h3 className="font-serif text-xl">Not claimed</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              A saving at any operating facility. A forecast-error backtest — the noisy curve in the demo is synthetic
              on purpose. Video numbers. Those wait for the calibrated solver.
            </p>
          </article>
        </div>
        <div className="mt-10">
          <h2 className="font-serif text-3xl">Team</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            Asim, Maira, Malaika, and Tayyab are software engineering students at NUTECH in Islamabad, Pakistan. This
            is their University Track entry on Problem Statement 1, Water Quantity. Mentors and teachers who help
            during the final review should be credited on the project page. The build uses free data and free tools.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {["Asim", "Maira", "Malaika", "Tayyab"].map((name) => (
              <li key={name} className="rounded-full border border-sand-line bg-white px-4 py-1.5">
                {name}
              </li>
            ))}
            <li className="rounded-full bg-ink px-4 py-1.5 text-sand">NUTECH Islamabad</li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-sand-line">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="font-serif text-2xl">Sources</h2>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {SOURCES.map((source) => (
              <li key={source.id}>
                <a className="text-lagoon underline" href={source.href}>
                  {source.label}
                </a>
                <span className="text-ink-faint"> — {source.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ink-faint">
            ThirstCap · prepared from the team brief of 11 Nov 2026 · sample numbers are not for the video
          </p>
        </div>
      </footer>
    </>
  );
}
