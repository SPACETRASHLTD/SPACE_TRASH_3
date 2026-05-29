"""LangGraph ``StateGraph`` assembly (§4).

Wires the circuit nodes in dependency order with the loop-back edge:

    START -> emit -> high_tier -> mid_tier -> low_tier
          -> truth_check -> prune -> warden -> conductor -> scout
          -> judge -> treasurer -> congeal -> compass -> integrate -> route
    route --halt--> END
          --japa % 9 == 0--> reconstitute -> emit   (new mala, human gate inside)
          --else--> emit                            (next japa)

A checkpointer is attached so ``reconstitute``'s human-gate ``interrupt`` can
pause and resume.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .circuit import Circuit
from .config import CircuitConfig
from .state import CircuitState

# Linear backbone of the integrity pipeline (dependency-ordered, §4).
_PIPELINE = [
    "emit",
    "high_tier",
    "mid_tier",
    "low_tier",
    "truth_check",
    "prune",
    "warden",
    "conductor",
    "scout",
    "judge",
    "treasurer",
    "congeal",
    "compass",
    "integrate",
    "route",
]


def build_graph(circuit: Circuit | None = None, *, config: CircuitConfig | None = None, checkpointer=None):
    """Build (and compile) the circuit graph. Returns ``(app, circuit)``."""
    circuit = circuit or Circuit(config=config)
    nodes = circuit.nodes()

    g = StateGraph(CircuitState)
    for name in _PIPELINE:
        g.add_node(name, nodes[name])
    g.add_node("reconstitute", nodes["reconstitute"])

    g.add_edge(START, "emit")
    # Linear backbone up to route.
    for a, b in zip(_PIPELINE, _PIPELINE[1:]):
        g.add_edge(a, b)

    # Conditional loop-back from route.
    g.add_conditional_edges(
        "route",
        circuit.route_decision,
        {"END": END, "reconstitute": "reconstitute", "emit": "emit"},
    )
    # After reconstitution (and its human gate), continue into the next mala.
    g.add_edge("reconstitute", "emit")

    if checkpointer is None:
        from langgraph.checkpoint.memory import InMemorySaver

        checkpointer = InMemorySaver()

    app = g.compile(checkpointer=checkpointer)
    return app, circuit


def initial_state(config: CircuitConfig) -> CircuitState:
    """Seed the immutable core and zeroed bookkeeping."""
    return CircuitState(
        goal=config.goal,
        constitution=config.constitution,
        identity={"summary": "nascent", "strategy_lib_ref": None, "version": 0},
        japa=0,
        mala=0,
        spend_usd=0.0,
        spend_cap_usd=config.spend_cap_usd,
        halt=False,
        halt_reason="",
        directives=[],
        jobs=[],
        trajectories=[],
        microcosm={},
        pending_permissions=[],
        mem_high=[],
        mem_mid=[],
        mem_low=[],
        audit_log_ref="",
        metrics=config.to_metrics(),
    )
