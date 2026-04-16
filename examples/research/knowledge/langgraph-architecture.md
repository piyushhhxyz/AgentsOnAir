# LangGraph Multi-Agent Architecture

## Graph Structure
DeepResearch uses a cyclic LangGraph workflow with 4 specialized agents:

### Planner Agent (Entry Point)
- Receives raw user query
- Decomposes into 3-5 atomic research sub-questions
- Assigns priority and search strategy per sub-question
- Outputs: structured research plan with sub-tasks

### Researcher Agent
- Executes search queries across multiple sources
- Reads and extracts key information from documents
- Handles: web search, academic papers, news articles, technical docs
- Outputs: raw findings with source URLs and timestamps

### Analyst Agent
- Cross-references findings from multiple sources
- Identifies patterns, contradictions, and knowledge gaps
- Scores source credibility (High/Medium/Low)
- Can route back to Researcher if gaps detected (cyclic edge)
- Outputs: analyzed findings with confidence scores

### Writer Agent (Terminal Node)
- Synthesizes analyzed findings into structured brief
- Formats with executive summary, key findings, analysis
- Includes source citations and credibility ratings
- Outputs: final research brief

## State Management
- Shared state object passed between agents
- Each agent reads from and writes to specific state keys
- State includes: query, plan, raw_findings, analyzed_findings, brief
- LangGraph handles state persistence and checkpointing

## Conditional Routing
- Analyst → Researcher: triggered when confidence < 0.7 or gaps detected
- Maximum 2 research loops to prevent infinite cycles
- After max loops, Writer proceeds with available data + flags gaps
