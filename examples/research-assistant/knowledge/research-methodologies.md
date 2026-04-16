# Research Methodologies for AI & Technology Topics

## 1. Systematic Literature Review

A structured approach to synthesizing existing knowledge:

- **Define scope**: Formulate clear research questions (e.g., "What are the adoption drivers for multi-agent systems in enterprise?")
- **Source identification**: Search across academic databases (arXiv, Semantic Scholar, Google Scholar), industry reports (Gartner, McKinsey, a16z), and grey literature (blog posts, GitHub READMEs, conference talks)
- **Screening criteria**: Filter by recency (last 12-24 months for fast-moving AI topics), citation count, author credibility, and methodological rigor
- **Data extraction**: Pull key claims, data points, methodologies, and conclusions into a structured matrix
- **Synthesis**: Identify patterns, contradictions, and gaps across sources
- **Quality assessment**: Rate each source on a High/Medium/Low confidence scale

## 2. Competitive Analysis Frameworks

### Porter's Five Forces (Adapted for AI)
- **Rivalry among existing players**: Model provider competition (OpenAI vs Anthropic vs Google), framework wars (LangChain vs CrewAI)
- **Threat of new entrants**: Low barrier in open-source; high barrier for frontier models (compute moats)
- **Bargaining power of suppliers**: GPU/compute providers (NVIDIA, cloud providers) have outsized leverage
- **Bargaining power of buyers**: Enterprises increasingly demand interoperability, vendor lock-in resistance
- **Threat of substitutes**: Traditional automation (RPA, rule engines) vs AI agents; cost-performance trade-offs

### SWOT Analysis
Apply per-company or per-technology to map Strengths, Weaknesses, Opportunities, and Threats. Particularly useful when comparing open-source vs proprietary approaches.

### Technology Readiness Level (TRL)
Rate technologies on the 1-9 TRL scale to assess maturity. Most agent frameworks are at TRL 6-7 (system prototype demonstrated in operational environment), while agent-to-agent protocols are at TRL 3-4 (experimental proof of concept).

## 3. Trend Analysis Methods

- **Hype Cycle mapping**: Place technologies on the Gartner Hype Cycle (trigger → peak of inflated expectations → trough → slope of enlightenment → plateau)
- **Adoption curve analysis**: Classify adopters as innovators, early adopters, early majority, etc. Most enterprise agent adoption is still in the innovator/early adopter phase.
- **Time-series analysis**: Track GitHub stars, npm downloads, paper citations, and job postings over time to quantify momentum
- **Signal detection**: Monitor VC funding announcements, acquisitions, and talent movement as leading indicators

## 4. Key Data Sources

| Source | What It Provides | Update Frequency |
|--------|-----------------|------------------|
| **arXiv (cs.AI, cs.CL)** | Latest research papers | Daily |
| **HuggingFace** | Model benchmarks, trending models | Real-time |
| **GitHub Trending** | Framework adoption, community activity | Daily |
| **Crunchbase / PitchBook** | VC funding, valuations, M&A | Weekly |
| **State of AI Report** | Annual comprehensive landscape analysis | Annual (Oct) |
| **a16z / Sequoia blogs** | Market analysis, investment theses | Monthly |
| **Stack Overflow Trends** | Developer adoption signals | Quarterly |
| **Papers With Code** | SOTA benchmarks, reproducibility | Daily |

## 5. Best Practices

- **Triangulate**: Never rely on a single source. Cross-reference claims across 3+ independent sources.
- **Date-stamp everything**: AI moves fast. A 6-month-old claim may already be outdated.
- **Quantify uncertainty**: Use confidence levels (High: 3+ credible sources agree; Medium: 1-2 sources; Low: speculative/single anecdote).
- **Track methodology**: Note how data was collected — self-reported surveys vs observed metrics vs controlled experiments.
