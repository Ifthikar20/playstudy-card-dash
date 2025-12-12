"""
Rate limiting utilities using SlowAPI.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_user_id_or_ip(request):
    """
    Get user ID from request if authenticated, otherwise use IP address.
    This allows for user-specific rate limiting.
    """
    # Try to get user ID from request state (set by auth middleware)
    if hasattr(request.state, "user_id"):
        return f"user:{request.state.user_id}"

    # Fallback to IP address
    return get_remote_address(request)


# Create limiter instance
limiter = Limiter(key_func=get_user_id_or_ip)
