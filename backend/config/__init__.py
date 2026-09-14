import pymysql

pymysql.install_as_MySQLdb()

# Makes `@shared_task`-decorated functions (studio/tasks.py) bind to this
# app whenever Django is loaded — standard Django+Celery wiring.
from .celery import app as celery_app  # noqa: E402

__all__ = ("celery_app",)
