from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health_check(request):
    db_status = "ok"
    db_error = None

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:
        db_status = "error"
        db_error = str(exc)

    payload = {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": {
            "status": db_status,
            "vendor": connection.vendor,
            "name": connection.settings_dict.get("NAME"),
            "error": db_error,
        },
    }

    return Response(payload, status=200 if db_status == "ok" else 503)
