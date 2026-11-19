export type Source = { id: string; label: string; href: string; detail: string };

export const SOURCES: Source[] = [
  {
    id: "xylem-gwi",
    label: "Xylem and GWI, Watering the New Economy",
    href: "https://www.xylem.com/en-us/info/watering-the-new-economy/",
    detail: "23.7 km³ withdrawn by the AI value chain in 2025.",
  },
  {
    id: "iea",
    label: "IEA, Energy and AI (2025), Box 5.4",
    href: "https://iea.blob.core.windows.net/assets/b3a8b37f-32d1-4873-9eca-31cec5895264/EnergyandAI.pdf",
    detail: "Data-center water consumption, today and 2030.",
  },
  {
    id: "small-bottle",
    label: "Han, Li, Wierman, Ren — Small Bottle, Big Pipe (2026)",
    href: "https://arxiv.org/abs/2603.02705",
    detail: "Peak-day water, peaking factors, and the capacity cost.",
  },
  {
    id: "ucr",
    label: "UC Riverside news, 9 Mar 2026",
    href: "https://news.ucr.edu/articles/2026/03/09/data-center-water-spikes-could-cost-billions",
    detail: "Plain-language account of the peak-capacity paper.",
  },
  {
    id: "wri",
    label: "WRI Aqueduct, 25 countries",
    href: "https://www.wri.org/insights/highest-water-stressed-countries",
    detail: "A quarter of the world lives with extremely high water stress.",
  },
  {
    id: "reuters-pk",
    label: "Reuters, Pakistan allocates 2,000 MW",
    href: "https://www.reuters.com/sustainability/boards-policy-regulation/pakistan-allocates-2000-megawatts-electricity-bitcoin-mining-ai-data-centres-2025-05-25/",
    detail: "Electricity set aside for mining and AI data centers, May 2025.",
  },
  {
    id: "dalles",
    label: "AP, Google in The Dalles",
    href: "https://apnews.com/article/technology-business-oregon-the-dalles-climate-and-environment-f63f313b0ebde0d60aeb3dd58f51991c",
    detail: "One city's water, one company's data centers.",
  },
  {
    id: "waterwise",
    label: "Jiang et al., WaterWise (PPoPP 2025)",
    href: "https://arxiv.org/abs/2501.17944",
    detail: "Co-optimises carbon and total water. Does not cap the peak day.",
  },
  {
    id: "thirsty",
    label: "Li et al., Making AI Less Thirsty",
    href: "https://arxiv.org/abs/2304.03271",
    detail: "Why chasing solar can land jobs in the hottest hours.",
  },
  {
    id: "lbnl",
    label: "LBNL 2024 U.S. Data Center Energy Usage Report",
    href: "https://eta-publications.lbl.gov/sites/default/files/2024-12/lbnl-2024-united-states-data-center-energy-usage-report_1.pdf",
    detail: "Inference was about 60% of U.S. AI server energy in 2023.",
  },
  {
    id: "google-dr",
    label: "Reuters, Google demand response (Aug 2025)",
    href: "https://www.reuters.com/sustainability/boards-policy-regulation/google-agrees-curb-power-use-ai-data-centers-ease-strain-us-grid-when-demand-2025-08-04/",
    detail: "AI load can flex for the grid. Water utilities get no signal today.",
  },
  {
    id: "msft",
    label: "Microsoft, zero-water cooling design",
    href: "https://www.microsoft.com/en-us/microsoft-cloud/blog/2024/12/09/sustainable-by-design-next-generation-datacenters-consume-zero-water-for-cooling/",
    detail: "New builds. The existing fleet still evaporates.",
  },
  {
    id: "open-meteo",
    label: "Open-Meteo archive",
    href: "https://open-meteo.com/en/docs/historical-weather-api",
    detail: "Hourly temperatures behind every chart in the demo.",
  },
  {
    id: "alibaba",
    label: "Alibaba cluster trace",
    href: "https://github.com/alibaba/clusterdata",
    detail: "Public GPU jobs the backend workload model is built to read.",
  },
  {
    id: "winners",
    label: "Xylem Ignite winner videos",
    href: "https://www.xylem.com/en-us/sustainability/community/xylem-ignite/innovation-challenge/videos/",
    detail: "Past winners paired a water–energy story with a working demo.",
  },
  {
    id: "challenge",
    label: "Xylem Global Student Innovation Challenge 2026",
    href: "https://xyleminnovationchallenge-platform.bemyapp.com/",
    detail: "University Track, Problem Statement 1, Water Quantity.",
  },
];
