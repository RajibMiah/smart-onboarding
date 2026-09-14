import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")
# Reads every CELERY_* setting from Django's settings module (CELERY_BROKER_URL
# etc., config/settings.py) rather than a separate celeryconfig.py.
app.config_from_object("django.conf:settings", namespace="CELERY")
# Finds each installed app's tasks.py automatically (studio/tasks.py) — new
# task modules in other apps need no registration beyond just existing.
app.autodiscover_tasks()
