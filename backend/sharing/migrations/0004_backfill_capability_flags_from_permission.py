"""Backfills the new can_edit/can_reorder/can_reshare booleans for every
SharedContent row created before they existed, from that row's existing
`permission` tier — without this, an already-granted "Can Edit" share would
silently lose its edit/reorder/reshare access the moment the permission
helpers in core/permissions.py switch from reading `permission` to reading
these booleans directly.
"""

from django.db import migrations


def backfill_capabilities(apps, schema_editor):
    SharedContent = apps.get_model("sharing", "SharedContent")
    SharedContent.objects.filter(permission="edit").update(can_view=True, can_edit=True, can_reorder=True, can_reshare=True)
    SharedContent.objects.filter(permission__in=["view", "comment"]).update(can_view=True)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("sharing", "0003_sharedcontent_delegation_and_capabilities"),
    ]

    operations = [
        migrations.RunPython(backfill_capabilities, noop_reverse),
    ]
