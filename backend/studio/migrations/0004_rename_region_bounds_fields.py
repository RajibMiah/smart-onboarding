import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("studio", "0003_transcriptsegment"),
    ]

    operations = [
        migrations.RenameField(model_name="zoomregion", old_name="x", new_name="position_x"),
        migrations.RenameField(model_name="zoomregion", old_name="y", new_name="position_y"),
        migrations.RenameField(model_name="zoomregion", old_name="width", new_name="width_pct"),
        migrations.RenameField(model_name="zoomregion", old_name="height", new_name="height_pct"),
        migrations.RenameField(model_name="blurregion", old_name="x", new_name="position_x"),
        migrations.RenameField(model_name="blurregion", old_name="y", new_name="position_y"),
        migrations.RenameField(model_name="blurregion", old_name="width", new_name="width_pct"),
        migrations.RenameField(model_name="blurregion", old_name="height", new_name="height_pct"),
        migrations.AlterField(
            model_name="zoomregion",
            name="position_x",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box left edge, percent of frame width.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
        migrations.AlterField(
            model_name="zoomregion",
            name="position_y",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box top edge, percent of frame height.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
        migrations.AlterField(
            model_name="zoomregion",
            name="width_pct",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box width, percent of frame width.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
        migrations.AlterField(
            model_name="zoomregion",
            name="height_pct",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box height, percent of frame height.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
        migrations.AlterField(
            model_name="blurregion",
            name="position_x",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box left edge, percent of frame width.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
        migrations.AlterField(
            model_name="blurregion",
            name="position_y",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box top edge, percent of frame height.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
        migrations.AlterField(
            model_name="blurregion",
            name="width_pct",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box width, percent of frame width.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
        migrations.AlterField(
            model_name="blurregion",
            name="height_pct",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=5,
                help_text="Bounding box height, percent of frame height.",
                validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(100)],
            ),
        ),
    ]
