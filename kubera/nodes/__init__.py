"""Node implementations live as methods on ``kubera.circuit.Circuit``.

This package directory is reserved for future per-node splitting if the circuit
grows; for now the node bodies are colocated in ``kubera/circuit.py`` so the
shared dependencies (router, world, archive, ...) are bound once.
"""
