"""The Kubera Circuit — a self-improving, value-bounded multi-agent control loop.

A fixed objective (Bindu) drives a 3-tier agent hierarchy whose outputs pass
through an 8-stage, dependency-ordered integrity pipeline, producing one
distilled state-update (Agni microcosm) that seeds the next cycle. Implemented as
a LangGraph ``StateGraph`` with a loop-back edge.

See BUILD_BRIEF / README for the full specification. Everything mythic is an alias
for an engineering function; the engineering meaning leads in the docs and code.
"""

from .circuit import Circuit
from .config import CircuitConfig
from .graph import build_graph, initial_state
from .state import CircuitState, Trajectory

__all__ = [
    "Circuit",
    "CircuitConfig",
    "CircuitState",
    "Trajectory",
    "build_graph",
    "initial_state",
]
