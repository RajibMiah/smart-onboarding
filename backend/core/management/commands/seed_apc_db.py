"""Wipe-and-seed pipeline for local/dev APC databases.

    python manage.py seed_apc_db --wipe

Adapted to this project's actual schema rather than a hypothetical one:
notifications/media-share-requests/shared-content live in the `sharing` app,
clips live in `media` (table `apc_clips`, not `apc_clip_projects`), workspace
membership is `apc_workspace_memberships` (not `apc_workspace_members`), and
there's no `apc_shareable_links`/`apc_workspaces` table at all (organizations
are `apc_organizations`). Non-destructive edit metadata (cuts, zoom/blur/text
regions) is normalized across real tables tied to `TimelineTrack`, not a JSON
blob on the clip, so those are seeded as actual rows, matching exactly how
`useReviewWorkflow.ts` persists them from the real Studio.
"""

import random
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone
from django.utils.text import slugify

from collaboration.models import Playlist, PlaylistItem
from core.models import (
    CustomRole,
    Department,
    Organization,
    Team,
    TeamMembership,
    User,
    WorkspaceMembership,
)
from media.models import Clip, MediaAsset
from sharing.models import MediaShareRequest, Notification, SharedContent
from studio.models import BlurRegion, Cut, TextOverlay, TimelineTrack, ZoomRegion

SEED_PASSWORD = "Password123!"

# Deletion order matters even with FK checks off (some of these self-reference
# via SET_NULL, e.g. Organization.owner -> User) purely so the counts printed
# at the end reflect a clean run — FOREIGN_KEY_CHECKS=0 is what actually makes
# the order safe either way.
WIPE_TABLES = [
    "apc_notifications",
    "apc_media_share_requests",
    "apc_shared_content",
    "apc_page_clip_items",
    "apc_step_guides",
    "apc_pages",
    "apc_playlist_items",
    "apc_playlists",
    "apc_cuts",
    "apc_text_overlays",
    "apc_blur_regions",
    "apc_zoom_regions",
    "apc_timeline_tracks",
    "apc_clip_assets",
    "apc_clips",
    "apc_workspace_invitations",
    "apc_team_members",
    "apc_teams",
    "apc_custom_roles",
    "apc_workspace_memberships",
    "apc_departments",
    "apc_users",
    "apc_organizations",
]


class Command(BaseCommand):
    help = "Wipes all APC tables and reseeds a rich, multi-tenant test dataset."

    def add_arguments(self, parser):
        parser.add_argument("--wipe", action="store_true", help="Delete all existing data before seeding.")

    def handle(self, *args, **options):
        if options["wipe"]:
            self.wipe()
        with transaction.atomic():
            self.seed()
        self.stdout.write(self.style.SUCCESS("APC database seeded."))

    # ------------------------------------------------------------------
    # Wipe
    # ------------------------------------------------------------------

    def wipe(self):
        self.stdout.write("Wiping existing APC data...")
        with connection.cursor() as cursor:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            for table in WIPE_TABLES:
                cursor.execute(f"TRUNCATE TABLE `{table}`;")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
        self.stdout.write(self.style.WARNING(f"Truncated {len(WIPE_TABLES)} tables."))

    # ------------------------------------------------------------------
    # Seed
    # ------------------------------------------------------------------

    def seed(self):
        acme = self.create_workspace_a()
        self.create_workspace_b()
        self.create_media_and_clips(acme)

    def create_workspace_a(self) -> Organization:
        org = Organization.objects.create(name="Acme Global Technologies", slug="acme-tech")

        eng = Department.objects.create(organization=org, name="Engineering & Architecture")
        people_ops = Department.objects.create(organization=org, name="Product Operations & HR")

        backend_team = Team.objects.create(organization=org, department=eng, name="Backend Core")
        frontend_team = Team.objects.create(organization=org, department=eng, name="Frontend & Canvas Systems")
        people_team = Team.objects.create(organization=org, department=people_ops, name="People Operations")
        success_team = Team.objects.create(organization=org, department=people_ops, name="Customer Success")

        def make_user(email, first, last):
            return User.objects.create(
                organization=org, email=email, first_name=first, last_name=last, password=make_password(SEED_PASSWORD)
            )

        owner = make_user("owner@apc.local", "Alex", "Vance")
        org.owner = owner
        org.save(update_fields=["owner"])
        WorkspaceMembership.objects.create(
            user=owner, organization=org, is_creator=True, is_global_admin=True, role_tier="owner"
        )

        admin = make_user("admin@apc.local", "Elena", "Rostova")
        WorkspaceMembership.objects.create(
            user=admin, organization=org, is_creator=True, is_global_admin=True, role_tier="global_admin"
        )

        # `User` has no direct department/team FK — both are only derivable
        # through `TeamMembership` (see core.serializers.OrgMemberSerializer,
        # which reads `user.team_memberships.first().team[.department]`), so
        # "department only, no specific team" isn't directly expressible.
        # PM and Viewer get a TeamMembership on a representative team in
        # their intended department so it still surfaces correctly in the
        # Manage Users table.
        hr = make_user("hr@apc.local", "Marcus", "Brody")
        WorkspaceMembership.objects.create(user=hr, organization=org, is_creator=True, role_tier="hr_manager")
        TeamMembership.objects.create(team=people_team, user=hr, role=TeamMembership.Role.LEAD)

        pm = make_user("pm.eng@apc.local", "Sarah", "Jenkins")
        WorkspaceMembership.objects.create(user=pm, organization=org, is_creator=True, role_tier="project_manager")
        TeamMembership.objects.create(team=backend_team, user=pm, role=TeamMembership.Role.LEAD)

        lead = make_user("lead.backend@apc.local", "David", "Kim")
        WorkspaceMembership.objects.create(user=lead, organization=org, is_creator=True, role_tier="team_lead")
        TeamMembership.objects.create(team=backend_team, user=lead, role=TeamMembership.Role.LEAD)

        creator = make_user("creator@apc.local", "Rajib", "Ahmed")
        WorkspaceMembership.objects.create(user=creator, organization=org, is_creator=True, role_tier="creator")
        TeamMembership.objects.create(team=frontend_team, user=creator, role=TeamMembership.Role.EDITOR)

        viewer = make_user("viewer@apc.local", "Chloe", "Bennett")
        WorkspaceMembership.objects.create(user=viewer, organization=org, is_creator=False, role_tier="viewer")
        TeamMembership.objects.create(team=success_team, user=viewer, role=TeamMembership.Role.MEMBER)

        auditor_role = CustomRole.objects.create(
            organization=org,
            name="Compliance Auditor",
            description="Reviews requests and analytics without publishing rights.",
            created_by=owner,
            can_view_analytics=True,
            can_approve_requests=True,
            can_publish_public_clips=False,
        )
        auditor = make_user("auditor@apc.local", "Victor", "Stone")
        WorkspaceMembership.objects.create(
            user=auditor, organization=org, is_creator=False, role_tier="custom", custom_role=auditor_role
        )

        revoked = make_user("revoked@apc.local", "Frank", "Castle")
        WorkspaceMembership.objects.create(
            user=revoked,
            organization=org,
            is_creator=True,
            role_tier="creator",
            is_authorized=False,
            revoked_at=timezone.now(),
            revoked_by=admin,
        )

        self.stdout.write(
            self.style.SUCCESS(f"Workspace A '{org.name}': 8 users, 2 departments, 4 teams, 1 custom role.")
        )

        self._workspace_a_users = {
            "owner": owner,
            "admin": admin,
            "hr": hr,
            "pm": pm,
            "lead": lead,
            "creator": creator,
            "viewer": viewer,
            "auditor": auditor,
        }
        self._workspace_a_teams = {"backend": backend_team, "frontend": frontend_team, "people": people_team}
        self._workspace_a_departments = {"eng": eng, "people_ops": people_ops}
        return org

    def create_workspace_b(self) -> Organization:
        """An isolated second tenant — used to verify no query ever leaks across organizations."""
        org = Organization.objects.create(name="Stark Industries", slug="stark-ind")
        owner = User.objects.create(
            organization=org,
            email="owner@stark-ind.local",
            first_name="Tony",
            last_name="Stark",
            password=make_password(SEED_PASSWORD),
        )
        org.owner = owner
        org.save(update_fields=["owner"])
        WorkspaceMembership.objects.create(
            user=owner, organization=org, is_creator=True, is_global_admin=True, role_tier="owner"
        )
        rd = Department.objects.create(organization=org, name="Research & Development")
        Team.objects.create(organization=org, department=rd, name="Arc Reactor Lab")

        clip = Clip.objects.create(
            organization=org,
            author=owner,
            title="Stark Industries — Confidential Demo",
            slug="stark-confidential-demo",
            description="Isolation-check clip — must never appear in an Acme Tech query.",
            duration_seconds=42,
            status=Clip.Status.COMPLETED,
            visibility=Clip.Visibility.PRIVATE,
            thumbnail_url="https://picsum.photos/seed/stark/640/360",
        )
        MediaAsset.objects.create(
            organization=org,
            uploader=owner,
            clip=clip,
            title="stark-demo.mp4",
            asset_type=MediaAsset.AssetType.VIDEO,
            # No file_url: this is metadata-only seed data (no real video
            # bytes exist for it), and a fake domain here used to make the
            # frontend player try to resolve `cdn.apc.local` — a host that
            # was never real — hanging/erroring instead of showing the
            # player's own honest "couldn't be loaded" state.
            mime_type="video/mp4",
            file_size_bytes=52_428_800,
            resolution="1920x1080",
            width=1920,
            height=1080,
            duration=42.0,
            status=MediaAsset.Status.READY,
        )
        self.stdout.write(self.style.SUCCESS(f"Workspace B '{org.name}': isolation-verification tenant seeded."))
        return org

    def create_media_and_clips(self, org: Organization):
        users = self._workspace_a_users
        teams = self._workspace_a_teams
        departments = self._workspace_a_departments

        clip_specs = [
            {
                "title": "Docker Deployment Guide",
                "status": Clip.Status.COMPLETED,
                "visibility": Clip.Visibility.PUBLISHED,
                "duration": 180.5,
                "author": users["creator"],
            },
            {
                "title": "Q3 Onboarding Walkthrough",
                "status": Clip.Status.COMPLETED,
                "visibility": Clip.Visibility.DRAFT,
                "duration": 312.0,
                "author": users["lead"],
            },
            {
                "title": "API Authentication Flow",
                "status": Clip.Status.PROCESSING,
                "visibility": Clip.Visibility.DRAFT,
                "duration": 45.2,
                "author": users["creator"],
            },
            {
                "title": "HR Policy Update — Remote Work",
                "status": Clip.Status.COMPLETED,
                "visibility": Clip.Visibility.PUBLISHED,
                "duration": 98.4,
                "author": users["hr"],
            },
        ]

        clips = []
        for index, spec in enumerate(clip_specs):
            clip = Clip.objects.create(
                organization=org,
                author=spec["author"],
                title=spec["title"],
                slug=slugify(spec["title"]),
                description=f"Seed data for {spec['title']}.",
                duration_seconds=spec["duration"],
                status=spec["status"],
                visibility=spec["visibility"],
                thumbnail_url=f"https://picsum.photos/seed/apc-clip-{index}/640/360",
                filter_settings={
                    "brightness": 105,
                    "contrast": 100,
                    "saturation": 110,
                    "volumeGain": 1.2,
                    "noiseSuppression": True,
                },
            )
            MediaAsset.objects.create(
                organization=org,
                uploader=spec["author"],
                clip=clip,
                title=f"{clip.slug}.webm",
                asset_type=MediaAsset.AssetType.VIDEO,
                # No file_url — see the identical note on the Stark Industries
                # seed clip above; `cdn.apc.local` was never a real host.
                mime_type="video/webm",
                file_size_bytes=random.randint(8_000_000, 60_000_000),
                resolution="1920x1080",
                width=1920,
                height=1080,
                duration=spec["duration"],
                framerate="30.00",
                status=MediaAsset.Status.READY,
            )
            self._seed_studio_metadata(clip)
            clips.append(clip)

        self.stdout.write(self.style.SUCCESS(f"{len(clips)} clips + media assets + studio metadata seeded."))

        # Playlists
        onboarding_playlist = Playlist.objects.create(
            organization=org,
            owner=users["lead"],
            title="Core Engineering Onboarding 2026",
            description="Everything a new engineer watches in week one.",
            visibility=Playlist.Visibility.PUBLIC,
        )
        for position, clip in enumerate(clips[:3]):
            PlaylistItem.objects.create(playlist=onboarding_playlist, clip=clip, position=position)

        hr_playlist = Playlist.objects.create(
            organization=org,
            owner=users["hr"],
            title="HR & People Policies",
            description="Internal policy explainers.",
            visibility=Playlist.Visibility.PRIVATE,
        )
        PlaylistItem.objects.create(playlist=hr_playlist, clip=clips[3], position=0)

        self.stdout.write(self.style.SUCCESS("2 playlists seeded."))

        # Requests
        MediaShareRequest.objects.create(
            organization=org,
            created_by=users["creator"],
            content_type=MediaShareRequest.ContentType.CLIP,
            object_id=clips[0].id,
            target_user=users["lead"],
            request_type=MediaShareRequest.RequestType.FEEDBACK,
            priority=MediaShareRequest.Priority.HIGH,
            status=MediaShareRequest.Status.PENDING,
            message="Can you check the Docker setup steps before we publish this?",
            due_date=timezone.now() + timedelta(days=3),
        )
        MediaShareRequest.objects.create(
            organization=org,
            created_by=users["lead"],
            content_type=MediaShareRequest.ContentType.CLIP,
            object_id=clips[1].id,
            target_user=users["pm"],
            request_type=MediaShareRequest.RequestType.APPROVAL,
            priority=MediaShareRequest.Priority.MEDIUM,
            status=MediaShareRequest.Status.APPROVED,
            message="Ready for sign-off on the Q3 onboarding walkthrough.",
            resolved_by=users["pm"],
            resolution_note="Looks great, approved.",
            resolved_at=timezone.now(),
        )
        self.stdout.write(self.style.SUCCESS("2 share requests seeded."))

        # Shared content
        SharedContent.objects.create(
            organization=org,
            shared_by=users["lead"],
            content_type=SharedContent.ContentType.CLIP,
            object_id=clips[0].id,
            target_team=teams["backend"],
            permission=SharedContent.Permission.VIEW,
        )
        SharedContent.objects.create(
            organization=org,
            shared_by=users["hr"],
            content_type=SharedContent.ContentType.CLIP,
            object_id=clips[3].id,
            target_department=departments["people_ops"],
            permission=SharedContent.Permission.COMMENT,
        )
        self.stdout.write(self.style.SUCCESS("2 shared-content entries seeded."))

        # Notifications
        Notification.objects.bulk_create(
            [
                Notification(
                    recipient=users["creator"],
                    sender=users["lead"],
                    notification_type=Notification.NotificationType.REQUEST_CREATED,
                    title="David Kim sent you a Review & Feedback request",
                    message="Can you check the Docker setup steps before we publish this?",
                    action_url="/requests",
                ),
                Notification(
                    recipient=users["creator"],
                    sender=users["hr"],
                    notification_type=Notification.NotificationType.CONTENT_SHARED,
                    title="Marcus Brody shared a clip with you",
                    message="HR Policy Update — Remote Work",
                    action_url="/shared",
                ),
                Notification(
                    recipient=users["creator"],
                    sender=users["pm"],
                    notification_type=Notification.NotificationType.REQUEST_RESOLVED,
                    title="Sarah Jenkins approved your request",
                    message="Looks great, approved.",
                    action_url="/requests",
                ),
            ]
        )
        self.stdout.write(self.style.SUCCESS("3 unread notifications seeded for creator@apc.local."))

    def _seed_studio_metadata(self, clip: Clip) -> None:
        """One zoom track (2 regions), one blur track (1 region), one text
        track (2 overlays), one cut track (2 cuts) — each on its own `order`
        per clip, matching the (clip, order) uniqueness this app enforces."""
        zoom_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.ZOOM, order=0)
        ZoomRegion.objects.create(
            track=zoom_track,
            position_x=20.00,
            position_y=15.00,
            width_pct=60.00,
            height_pct=60.00,
            scale_factor=1.50,
            start_time=2.000,
            end_time=6.000,
        )
        ZoomRegion.objects.create(
            track=zoom_track,
            position_x=10.00,
            position_y=10.00,
            width_pct=50.00,
            height_pct=50.00,
            scale_factor=1.75,
            start_time=12.000,
            end_time=16.000,
        )

        blur_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.BLUR, order=1)
        BlurRegion.objects.create(
            track=blur_track,
            position_x=5.00,
            position_y=5.00,
            width_pct=25.00,
            height_pct=15.00,
            shape=BlurRegion.Shape.RECTANGLE,
            blur_radius=16,
            start_time=0.500,
            end_time=4.000,
        )

        text_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.TEXT, order=2)
        TextOverlay.objects.create(
            track=text_track,
            content="Welcome to APC",
            position_x=10.00,
            position_y=80.00,
            font_size=32,
            color="#FFFFFF",
            background_color="#000000",
            start_time=0.000,
            end_time=3.000,
        )
        TextOverlay.objects.create(
            track=text_track,
            content="Step 1: Environment Setup",
            position_x=10.00,
            position_y=85.00,
            font_size=24,
            color="#FFD200",
            background_color="",
            start_time=5.000,
            end_time=10.000,
        )

        cut_track = TimelineTrack.objects.create(clip=clip, track_type=TimelineTrack.TrackType.CUT, order=3)
        Cut.objects.create(track=cut_track, cut_type=Cut.CutType.CUT, start_time=20.000, end_time=24.500)
        Cut.objects.create(
            track=cut_track,
            cut_type=Cut.CutType.SILENCE_SPEEDUP,
            speed_multiplier=3.00,
            start_time=30.000,
            end_time=32.800,
        )
