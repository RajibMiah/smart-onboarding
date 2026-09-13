"""Isolated /api/v1/ route registry: every ModelViewSet, DRF DefaultRouter."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from collaboration.views import (
    DocumentationPageViewSet,
    PlaylistItemViewSet,
    PlaylistViewSet,
    StepGuideViewSet,
)
from core.views import (
    CustomRoleViewSet,
    DepartmentViewSet,
    OrganizationViewSet,
    OrgUserViewSet,
    TeamViewSet,
    WorkspaceInvitationViewSet,
)
from media.views import ClipViewSet, MediaAssetViewSet
from sharing.views import MediaShareRequestViewSet, NotificationViewSet, SharedContentViewSet, SharedFeedView
from studio.views import (
    BlurRegionViewSet,
    CutViewSet,
    TextOverlayViewSet,
    TimelineTrackViewSet,
    ZoomRegionViewSet,
)

router = DefaultRouter()
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("departments", DepartmentViewSet, basename="department")
router.register("teams", TeamViewSet, basename="team")
router.register("users", OrgUserViewSet, basename="org-user")
router.register("custom-roles", CustomRoleViewSet, basename="custom-role")
router.register("invitations", WorkspaceInvitationViewSet, basename="invitation")
router.register("clips", ClipViewSet, basename="clip")
router.register("media-assets", MediaAssetViewSet, basename="media-asset")
router.register("timeline-tracks", TimelineTrackViewSet, basename="timeline-track")
router.register("zoom-regions", ZoomRegionViewSet, basename="zoom-region")
router.register("blur-regions", BlurRegionViewSet, basename="blur-region")
router.register("text-overlays", TextOverlayViewSet, basename="text-overlay")
router.register("cuts", CutViewSet, basename="cut")
router.register("playlists", PlaylistViewSet, basename="playlist")
router.register("playlist-items", PlaylistItemViewSet, basename="playlist-item")
router.register("pages", DocumentationPageViewSet, basename="page")
router.register("step-guides", StepGuideViewSet, basename="step-guide")
router.register("requests", MediaShareRequestViewSet, basename="media-request")
router.register("shared-content", SharedContentViewSet, basename="shared-content")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path("auth/", include("core.urls")),
    path("sharing/feed/", SharedFeedView.as_view(), name="shared-feed"),
    path("", include(router.urls)),
]
