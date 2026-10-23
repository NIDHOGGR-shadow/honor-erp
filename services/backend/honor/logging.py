import json
import logging
from datetime import datetime, timezone


class SafeFormatter(logging.Formatter):
    def format(self, record):
        data = {
            "time": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        for field in ("request_id", "method", "path", "status", "elapsed_ms", "job_id", "error_type"):
            if hasattr(record, field):
                data[field] = getattr(record, field)
        return json.dumps(data)


def logger(name):
    target = logging.getLogger(name)
    if not target.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(SafeFormatter())
        target.addHandler(handler)
        target.setLevel(logging.INFO)
        target.propagate = False
    return target
