"""
Routes package - exports all API routers
"""

from .input import router as input_router
from .run import router as run_router
from .sources import router as sources_router
from .compare import router as compare_router

__all__ = [
    'input_router',
    'run_router', 
    'sources_router',
    'compare_router'
]

# Made with Bob
